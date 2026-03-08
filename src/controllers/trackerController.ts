import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('42P01') || msg?.includes('does not exist');

const PP_PER_LOG = 5; // Praxis Points awarded per tracker log

/**
 * GET /trackers/my
 * Returns the authenticated user's trackers, each with the last 14 days of entries.
 */
export const getMyTrackers = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: trackers, error: trackerErr } = await supabase
    .from('trackers')
    .select('id, type, goal, created_at')
    .eq('user_id', userId);

  if (trackerErr) {
    if (SCHEMA_MISSING(trackerErr.message)) return res.json([]);
    return res.json([]);
  }

  if (!trackers || trackers.length === 0) return res.json([]);

  const trackerIds = trackers.map(t => t.id);
  const { data: entries } = await supabase
    .from('tracker_entries')
    .select('tracker_id, data, logged_at')
    .in('tracker_id', trackerIds)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false });

  const entriesByTracker: Record<string, any[]> = {};
  for (const e of entries ?? []) {
    if (!entriesByTracker[e.tracker_id]) entriesByTracker[e.tracker_id] = [];
    entriesByTracker[e.tracker_id].push(e);
  }

  const result = trackers.map(t => ({
    ...t,
    entries: entriesByTracker[t.id] ?? [],
  }));

  res.json(result);
});

/**
 * PATCH /trackers/:type/objective
 * Body: { goal: Record<string, any> }
 * Saves user-defined objective targets on the tracker row.
 */
export const updateObjective = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { type } = req.params;
  const { goal } = req.body as { goal?: Record<string, any> };
  if (!goal || typeof goal !== 'object') throw new BadRequestError('goal must be an object.');

  // Upsert tracker (create if not exists) then set goal
  const { data: tracker, error: upsertErr } = await supabase
    .from('trackers')
    .upsert({ user_id: userId, type }, { onConflict: 'user_id,type' })
    .select('id')
    .single();

  if (upsertErr) {
    if (SCHEMA_MISSING(upsertErr.message)) {
      return res.status(503).json({ message: 'Trackers table not set up. Run migrations.' });
    }
    throw new Error(upsertErr.message);
  }

  const { error: updateErr } = await supabase
    .from('trackers')
    .update({ goal })
    .eq('id', tracker.id);

  if (updateErr) throw new Error(updateErr.message);

  res.json({ ok: true });
});

/**
 * POST /trackers/log
 * Body: { type: string, data: Record<string, any> }
 * Upserts the tracker row (creates if missing), inserts an entry, awards +5 PP.
 */
export const logTracker = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { type, data } = req.body as { type?: string; data?: Record<string, any> };
  if (!type) throw new BadRequestError('type is required.');
  if (!data || typeof data !== 'object') throw new BadRequestError('data must be an object.');

  // Upsert tracker row (get-or-create)
  const { data: tracker, error: upsertErr } = await supabase
    .from('trackers')
    .upsert({ user_id: userId, type }, { onConflict: 'user_id,type' })
    .select('id')
    .single();

  if (upsertErr) {
    if (SCHEMA_MISSING(upsertErr.message)) {
      return res.status(503).json({ message: 'Trackers table not set up. Run migrations.' });
    }
    throw new Error(`Failed to upsert tracker: ${upsertErr.message}`);
  }

  // Insert entry
  const { error: insertErr } = await supabase
    .from('tracker_entries')
    .insert({ tracker_id: tracker.id, user_id: userId, data });

  if (insertErr) {
    throw new Error(`Failed to insert tracker entry: ${insertErr.message}`);
  }

  // Award PP (fire-and-forget)
  supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single()
    .then(({ data: profile }) => {
      if (profile) {
        supabase
          .from('profiles')
          .update({ praxis_points: (profile.praxis_points ?? 0) + PP_PER_LOG })
          .eq('id', userId);
      }
    });

  res.json({ ok: true, ppAwarded: PP_PER_LOG });
});
