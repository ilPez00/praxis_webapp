import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from './AICoachingService';
import logger from '../utils/logger';

const aiCoachingService = new AICoachingService();

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

/** Build a compact text snapshot of a user's current state. */
async function buildSnapshot(userId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  const [goalTreeRes, trackersRes, postsRes, checkinRes] = await Promise.all([
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
    supabase.from('trackers').select('id, name').eq('user_id', userId),
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today),
    supabase
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('checked_in_at', today),
  ]);

  // Goals: root nodes only, name + progress%
  const nodes: any[] = goalTreeRes.data?.nodes ?? [];
  const rootGoals = nodes
    .filter((n: any) => !n.parentId)
    .map((n: any) => `${(n.name || n.title || 'Goal').slice(0, 40)} ${Math.round((n.progress ?? 0) * 100)}%`);

  // Trackers logged today
  const trackerIds = (trackersRes.data ?? []).map((t: any) => t.id);
  let loggedTrackers = 0;
  if (trackerIds.length > 0) {
    const { count } = await supabase
      .from('tracker_entries')
      .select('id', { count: 'exact', head: true })
      .in('tracker_id', trackerIds)
      .gte('logged_at', today);
    loggedTrackers = count ?? 0;
  }

  const lines = [
    `Goals: ${rootGoals.length > 0 ? rootGoals.join(', ') : 'none'}`,
    `Trackers logged today: ${loggedTrackers}/${trackerIds.length}`,
    `Posts today: ${postsRes.count ?? 0}`,
    `Check-ins today: ${checkinRes.count ?? 0}`,
  ];

  return lines.join('\n');
}

/** Load yesterday's snapshot text for a user, or null if none. */
async function loadYesterdaySnapshot(userId: string): Promise<string | null> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const { data } = await supabase
    .from('axiom_daily_snapshots')
    .select('snapshot_text')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .maybeSingle();

  return data?.snapshot_text ?? null;
}

/** Persist today's snapshot. */
async function saveSnapshot(userId: string, snapshotText: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from('axiom_daily_snapshots').upsert({
    user_id: userId,
    date: today,
    snapshot_text: snapshotText,
  });
}

// ---------------------------------------------------------------------------
// Scan service
// ---------------------------------------------------------------------------

export class AxiomScanService {
  public static start() {
    cron.schedule('0 0 * * *', async () => {
      logger.info('[AxiomScan] Starting midnight automated scan...');
      try {
        await this.runGlobalScan();
      } catch (err: any) {
        logger.error('[AxiomScan] Global scan failed:', err.message);
      }
    });
    logger.info('[AxiomScan] Midnight cron job scheduled.');
  }

  public static async runGlobalScan() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const today = new Date().toISOString().slice(0, 10);

    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, name, city, is_premium, is_admin')
      .gte('last_activity_date', sevenDaysAgo.toISOString().slice(0, 10));

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    // Build pending list respecting premium/free frequency limits
    const pendingUsers: typeof users = [];
    for (const user of users) {
      const isPro = user.is_premium || user.is_admin;
      if (!isPro) {
        // Free users: only generate once per 7 days
        const { count } = await supabase
          .from('axiom_daily_briefs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('date', sevenDaysAgo.toISOString().slice(0, 10));
        if ((count ?? 0) >= 1) {
          logger.info(`[AxiomScan] Skipping free user ${user.name} — brief already generated this week.`);
          continue;
        }
      } else {
        // Pro users: skip if already generated today
        const { count } = await supabase
          .from('axiom_daily_briefs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('date', today);
        if ((count ?? 0) >= 1) {
          logger.info(`[AxiomScan] Skipping pro user ${user.name} — brief already generated today.`);
          continue;
        }
      }
      pendingUsers.push(user);
    }

    logger.info(`[AxiomScan] ${pendingUsers.length} users need briefs.`);

    // Process up to 3 concurrently to stay within free-tier RPM
    const CONCURRENCY = 3;
    for (let i = 0; i < pendingUsers.length; i += CONCURRENCY) {
      const batch = pendingUsers.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async user => {
        try {
          await this.generateDailyBrief(user.id, user.name, user.city || 'Unknown');
        } catch (err: any) {
          logger.warn(`[AxiomScan] Failed for ${user.name}: ${err.message}`);
        }
      }));
      // Small pause between batches to respect RPM limits
      if (i + CONCURRENCY < pendingUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }
  }

  public static async generateDailyBrief(userId: string, userName: string, userCity: string) {
    const today = new Date().toISOString().slice(0, 10);

    // Build today's snapshot (lightweight — no full tracker_entries dump)
    const [todaySnapshot, yesterdaySnapshot] = await Promise.all([
      buildSnapshot(userId),
      loadYesterdaySnapshot(userId),
    ]);

    // Build the diff context sent to the AI
    let diffContext: string;
    if (yesterdaySnapshot) {
      diffContext = `Yesterday's state:\n${yesterdaySnapshot}\n\nToday's state:\n${todaySnapshot}`;
    } else {
      diffContext = `Current state (first brief):\n${todaySnapshot}`;
    }

    // Fetch only the minimal extra context needed for match/event/place picks
    const [matchRes, eventsRes, placesRes] = await Promise.all([
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 5 }),
      supabase
        .from('events')
        .select('id, title, event_date, city')
        .gte('event_date', today)
        .limit(10),
      supabase.from('places').select('id, name, city').limit(10),
    ]);

    const prompt = `You are Axiom. Generate a high-performance daily protocol for ${userName} (location: ${userCity}).

### Daily Progress Diff
${diffContext}

### Community picks (choose the best fit for the user's goals)
- Aligned users: ${JSON.stringify(matchRes.data ?? [])}
- Upcoming events: ${JSON.stringify(eventsRes.data ?? [])}
- Places: ${JSON.stringify(placesRes.data ?? [])}

### Task
Return ONLY valid JSON with these keys:
1. "message": string — 1-2 sentence motivating morning message in Axiom's voice
2. "match": { "id": string, "name": string, "reason": string }
3. "event": { "id": string, "title": string, "reason": string }
4. "place": { "id": string, "name": string, "reason": string }
5. "challenge": { "type": "bet"|"duel", "target": string, "terms": string }
6. "resources": [ { "goal": string, "suggestion": string, "details": string } ] (one per goal)
7. "routine": [ { "time": string, "task": string, "alignment": string } ]

Always pick one match, one event, and one place — never return null for these.
JSON ONLY:`;

    const responseText = await aiCoachingService['runWithFallback'](prompt);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const recommendations = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

    // Insert a new row per day (history preserved)
    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      date: today,
      brief: recommendations,
      generated_at: new Date().toISOString(),
    });

    // Mirror motivation/strategy to coaching_briefs
    if (recommendations.motivation || recommendations.strategy) {
      await supabase.from('coaching_briefs').upsert({
        user_id: userId,
        brief: {
          motivation: recommendations.motivation,
          strategy: recommendations.strategy,
          network: recommendations.network,
        },
        generated_at: new Date().toISOString(),
      });
    }

    // Save today's snapshot for tomorrow's diff
    await saveSnapshot(userId, todaySnapshot);
  }
}
