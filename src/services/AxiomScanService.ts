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
    supabase.from('trackers').select('id').eq('user_id', userId),
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
    .map((n: any) => `${(n.name || n.title || 'Goal').slice(0, 25)} ${Math.round((n.progress ?? 0) * 100)}%`);

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

  // Compact format: ~40 tokens vs ~120 in old format
  return `G:${rootGoals.length > 0 ? rootGoals.join(',') : '-'}|T:${loggedTrackers}/${trackerIds.length}|P:${postsRes.count ?? 0}|C:${checkinRes.count ?? 0}`;
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
// Server-side pick scoring — replaces raw JSON dumps to LLM
// ---------------------------------------------------------------------------

interface PickedMatch { id: string; name: string }
interface PickedEvent { id: string; title: string; date: string }
interface PickedPlace { id: string; name: string }

/** Score and pick the best event by city match + soonest date. */
function pickBestEvent(events: any[], userCity: string): PickedEvent | null {
  if (!events || events.length === 0) return null;
  const scored = events.map((e: any) => {
    let score = 0;
    if (e.city && userCity && e.city.toLowerCase() === userCity.toLowerCase()) score += 3;
    // Soonest date gets highest bonus (2 for today, decaying)
    const daysAway = Math.max(0, Math.floor((new Date(e.event_date).getTime() - Date.now()) / 86400000));
    score += Math.max(0, 2 - daysAway * 0.1);
    return { ...e, score };
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  const best = scored[0];
  return { id: best.id, title: best.title, date: best.event_date?.slice(0, 10) ?? '' };
}

/** Score and pick the best place by city match + tag overlap with user domains. */
function pickBestPlace(places: any[], userCity: string, userDomains: string[]): PickedPlace | null {
  if (!places || places.length === 0) return null;
  const domainLower = userDomains.map(d => d.toLowerCase());
  const scored = places.map((p: any) => {
    let score = 0;
    if (p.city && userCity && p.city.toLowerCase() === userCity.toLowerCase()) score += 3;
    // Freeform tags: case-insensitive substring match against domain names
    const tags: string[] = Array.isArray(p.tags) ? p.tags : [];
    for (const tag of tags) {
      const tl = (tag || '').toLowerCase();
      for (const d of domainLower) {
        if (tl.includes(d) || d.includes(tl)) { score += 1; break; }
      }
    }
    return { ...p, score };
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  return { id: scored[0].id, name: scored[0].name };
}

/** Extract root goal domain names from nodes array. */
function extractUserDomains(nodes: any[]): string[] {
  return nodes
    .filter((n: any) => !n.parentId && n.domain)
    .map((n: any) => String(n.domain))
    .filter(Boolean);
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
      .select('id, name, city, is_premium, is_admin, minimal_ai_mode, last_activity_date')
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
          const useLLM = (user.is_premium || user.is_admin) && !user.minimal_ai_mode;
          await this.generateDailyBrief(user.id, user.name, user.city || 'Unknown', useLLM);
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

  /**
   * Generate daily brief for a user.
   * Algorithmic picks for match/event/place. LLM only writes message + routine.
   * @param useLLM - If true, use LLM for message + routine. If false, use templates.
   */
  public static async generateDailyBrief(userId: string, userName: string, userCity: string, useLLM: boolean = false) {
    const today = new Date().toISOString().slice(0, 10);

    // --- Phase 1: Gather all data in parallel ---
    const [
      todaySnapshot, yesterdaySnapshot,
      goalTreeRes, matchRes, eventsRes, placesRes,
    ] = await Promise.all([
      buildSnapshot(userId),
      loadYesterdaySnapshot(userId),
      supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 1 }),
      supabase.from('events').select('id, title, event_date, city').gte('event_date', today).limit(10),
      supabase.from('places').select('id, name, city, tags').limit(10),
    ]);

    const nodes: any[] = goalTreeRes.data?.nodes ?? [];
    const userDomains = extractUserDomains(nodes);

    // --- Phase 2: Algorithmic picks (zero LLM tokens) ---
    const topMatch: PickedMatch | null = matchRes.data?.[0]
      ? { id: matchRes.data[0].id, name: matchRes.data[0].name }
      : null;
    const topEvent = pickBestEvent(eventsRes.data ?? [], userCity);
    const topPlace = pickBestPlace(placesRes.data ?? [], userCity, userDomains);

    // --- Phase 3: Build diff context (compressed) ---
    const diffContext = yesterdaySnapshot
      ? `Y:${yesterdaySnapshot}|N:${todaySnapshot}`
      : todaySnapshot;

    // --- Phase 4: Generate message + routine (LLM or template) ---
    let recommendations: any;

    // Pre-built picks with template reasons (used by both paths)
    const picks = {
      match: topMatch ? { id: topMatch.id, name: topMatch.name, reason: 'Aligned goals in your active domains' } : null,
      event: topEvent ? { id: topEvent.id, title: topEvent.title, reason: 'Coming up soon — worth checking out' } : null,
      place: topPlace ? { id: topPlace.id, name: topPlace.name, reason: 'Potential spot for focus or reflection' } : null,
      challenge: { type: 'bet' as const, target: 'Complete one key action today', terms: 'Log it in your tracker' },
      resources: [] as any[],
    };

    if (!useLLM) {
      // Template-based brief (free tier / minimal AI mode)
      recommendations = {
        ...picks,
        message: `Good morning, ${userName}. Today's focus: build momentum in your key goals.`,
        routine: [
          { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
          { time: 'Afternoon', task: 'One focused work block', alignment: 'Deep progress' },
          { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
        ],
      };
    } else {
      // LLM writes message + routine only (~200 token prompt)
      const prompt = `Axiom brief for ${userName} (${userCity}).
State: ${todaySnapshot}
Delta: ${diffContext}

Write a short motivating morning message and a 3-4 step daily routine.
JSON only:
{"message":"1-2 sentence motivating message","routine":[{"time":"Morning/Afternoon/Evening","task":"action","why":"alignment"}]}`;

      try {
        const responseText = await aiCoachingService['runWithFallback'](prompt);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const llmOutput = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

        recommendations = {
          ...picks,
          message: llmOutput.message || `Focus on showing up today, ${userName}.`,
          routine: Array.isArray(llmOutput.routine) ? llmOutput.routine : [
            { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
            { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
          ],
        };
      } catch (err: any) {
        logger.warn(`[AxiomScan] LLM failed for ${userName}, falling back to template: ${err.message}`);
        recommendations = {
          ...picks,
          message: `Good morning, ${userName}. Today's focus: build momentum in your key goals.`,
          routine: [
            { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
            { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
          ],
        };
      }
    }

    // Insert a new row per day (history preserved)
    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      date: today,
      brief: recommendations,
      generated_at: new Date().toISOString(),
    });

    // Save today's snapshot for tomorrow's diff
    await saveSnapshot(userId, todaySnapshot);
  }
}
