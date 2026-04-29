/**
 * Backfill structured tracker tables from legacy tracker_entries JSONB.
 *
 * Reads each tracker_entries row whose tracker.type is supported by
 * StructuredTrackerWriter and writes it into the matching per-category
 * table (tracker_lifts, tracker_meals, …). Idempotent: rows whose
 * tracker_entry_id already exists in the target table are skipped.
 *
 * Usage:
 *   ts-node scripts/backfill-trackers.ts --user-id=all
 *   ts-node scripts/backfill-trackers.ts --user-id=<uuid>
 *   ts-node scripts/backfill-trackers.ts --user-id=all --type=lift
 *   ts-node scripts/backfill-trackers.ts --user-id=all --dry-run
 *
 * Flags:
 *   --user-id=<uuid|all>  Target a single user or every user (required).
 *   --type=<tracker_type> Only backfill one tracker type (optional).
 *   --batch-size=<N>      Pagination size for tracker_entries (default 500).
 *   --dry-run             Print what would happen without writing.
 */

import { supabase } from '../src/lib/supabaseClient';
import { writeStructured, isStructuredType } from '../src/services/StructuredTrackerWriter';

type Args = {
  userId: string | null;
  type: string | null;
  batchSize: number;
  dryRun: boolean;
};

const TYPE_TO_TABLE: Record<string, string> = {
  lift: 'tracker_lifts',
  meal: 'tracker_meals',
  cardio: 'tracker_cardio',
  steps: 'tracker_steps',
  sleep: 'tracker_sleep',
  meditation: 'tracker_meditation',
  study: 'tracker_study',
  books: 'tracker_books',
  budget: 'tracker_expenses',
  expenses: 'tracker_expenses',
  investments: 'tracker_investments',
  music: 'tracker_music',
  journal: 'tracker_journal',
  gaming: 'tracker_gaming',
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { userId: null, type: null, batchSize: 500, dryRun: false };

  for (const a of args) {
    if (a.startsWith('--user-id=')) out.userId = a.split('=')[1];
    else if (a.startsWith('--type=')) out.type = a.split('=')[1];
    else if (a.startsWith('--batch-size=')) out.batchSize = Math.max(1, parseInt(a.split('=')[1], 10));
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`[backfill] Unknown arg: ${a}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!out.userId) {
    console.error('[backfill] --user-id=<uuid|all> is required.');
    printHelp();
    process.exit(1);
  }
  if (out.type && !isStructuredType(out.type)) {
    console.error(`[backfill] --type=${out.type} is not a structured type.`);
    process.exit(1);
  }
  return out;
}

function printHelp() {
  console.log(`
Backfill structured tracker tables from legacy tracker_entries JSONB.

  --user-id=<uuid|all>   Target one user or every user (required)
  --type=<tracker_type>  Limit to one type (lift, meal, cardio, …)
  --batch-size=<N>       Pagination size (default 500)
  --dry-run              Print plan without writing
`);
}

async function loadExistingEntryIds(table: string, entryIds: string[]): Promise<Set<string>> {
  const seen = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < entryIds.length; i += CHUNK) {
    const slice = entryIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from(table)
      .select('tracker_entry_id')
      .in('tracker_entry_id', slice);
    if (error) {
      console.warn(`[backfill] dedupe lookup failed for ${table}: ${error.message}`);
      return seen;
    }
    for (const row of data ?? []) {
      if (row.tracker_entry_id) seen.add(row.tracker_entry_id);
    }
  }
  return seen;
}

async function backfillBatch(
  rows: Array<{ id: string; tracker_id: string; data: any; logged_at: string; user_id: string; type: string; node_id: string | null }>,
  args: Args,
): Promise<{ written: number; skipped: number; errored: number }> {
  // Group by type so we can de-dupe per target table.
  const byType: Record<string, typeof rows> = {};
  for (const r of rows) {
    if (!byType[r.type]) byType[r.type] = [];
    byType[r.type].push(r);
  }

  let written = 0;
  let skipped = 0;
  let errored = 0;

  for (const [type, group] of Object.entries(byType)) {
    const table = TYPE_TO_TABLE[type];
    if (!table) {
      skipped += group.length;
      continue;
    }
    const entryIds = group.map(r => r.id);
    const existing = await loadExistingEntryIds(table, entryIds);

    for (const row of group) {
      if (existing.has(row.id)) {
        skipped++;
        continue;
      }
      if (args.dryRun) {
        written++;
        continue;
      }
      try {
        await writeStructured(type, row.data ?? {}, {
          userId: row.user_id,
          trackerId: row.tracker_id,
          trackerEntryId: row.id,
          nodeId: row.node_id,
          loggedAt: row.logged_at,
        });
        written++;
      } catch (err: any) {
        errored++;
        console.warn(`[backfill] write failed entry=${row.id} type=${type}: ${err?.message ?? err}`);
      }
    }
  }

  return { written, skipped, errored };
}

async function main() {
  const args = parseArgs();
  console.log(`[backfill] starting — user=${args.userId} type=${args.type ?? 'all'} batch=${args.batchSize} dryRun=${args.dryRun}`);

  // Build a map of tracker_id → { type, user_id, node_id } once.
  let trackersQuery = supabase.from('trackers').select('id, type, user_id, node_id');
  if (args.userId !== 'all') trackersQuery = trackersQuery.eq('user_id', args.userId);
  if (args.type) trackersQuery = trackersQuery.eq('type', args.type);
  const { data: trackers, error: tErr } = await trackersQuery;
  if (tErr) {
    console.error(`[backfill] failed to load trackers: ${tErr.message}`);
    process.exit(1);
  }
  const trackerMeta = new Map<string, { type: string; user_id: string; node_id: string | null }>();
  for (const t of trackers ?? []) {
    if (isStructuredType(t.type)) {
      trackerMeta.set(t.id, { type: t.type, user_id: t.user_id, node_id: t.node_id ?? null });
    }
  }
  const trackerIds = Array.from(trackerMeta.keys());
  console.log(`[backfill] ${trackerIds.length} trackers in scope`);

  if (trackerIds.length === 0) {
    console.log('[backfill] nothing to do.');
    process.exit(0);
  }

  let totalWritten = 0;
  let totalSkipped = 0;
  let totalErrored = 0;
  let totalSeen = 0;

  // Page through entries by ascending logged_at + id; supabase caps each query at 1000 rows.
  // We chunk trackerIds to avoid blowing past .in() limits.
  const ID_CHUNK = 100;
  for (let i = 0; i < trackerIds.length; i += ID_CHUNK) {
    const idSlice = trackerIds.slice(i, i + ID_CHUNK);
    let offset = 0;
    while (true) {
      const { data: entries, error: eErr } = await supabase
        .from('tracker_entries')
        .select('id, tracker_id, data, logged_at, user_id')
        .in('tracker_id', idSlice)
        .order('logged_at', { ascending: true })
        .range(offset, offset + args.batchSize - 1);

      if (eErr) {
        console.error(`[backfill] entry fetch failed at offset ${offset}: ${eErr.message}`);
        process.exit(1);
      }
      if (!entries || entries.length === 0) break;

      const enriched = entries.map(e => {
        const meta = trackerMeta.get(e.tracker_id)!;
        return {
          id: e.id,
          tracker_id: e.tracker_id,
          data: e.data,
          logged_at: e.logged_at,
          user_id: e.user_id ?? meta.user_id,
          type: meta.type,
          node_id: meta.node_id,
        };
      });

      const stats = await backfillBatch(enriched, args);
      totalWritten += stats.written;
      totalSkipped += stats.skipped;
      totalErrored += stats.errored;
      totalSeen += entries.length;

      console.log(`[backfill] chunk ${i / ID_CHUNK + 1}/${Math.ceil(trackerIds.length / ID_CHUNK)} offset=${offset} seen=${entries.length} written=${stats.written} skipped=${stats.skipped} errored=${stats.errored}`);

      if (entries.length < args.batchSize) break;
      offset += args.batchSize;
    }
  }

  console.log('');
  console.log(`[backfill] DONE — seen=${totalSeen} written=${totalWritten} skipped=${totalSkipped} errored=${totalErrored}${args.dryRun ? ' (dry-run, no writes)' : ''}`);
  process.exit(totalErrored > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
