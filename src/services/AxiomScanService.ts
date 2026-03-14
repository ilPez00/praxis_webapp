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
// Domain sub-goal templates (free tier — zero LLM tokens)
// ---------------------------------------------------------------------------

const DOMAIN_SUBGOAL_TEMPLATES: Record<string, Array<{ title: string; description: string }>> = {
  'Career': [
    { title: 'Identify a key skill gap', description: 'Research what skill would most accelerate your progress' },
    { title: 'Schedule a mentor check-in', description: 'Find someone ahead of you and ask one question' },
    { title: 'Build a portfolio piece', description: 'Create tangible proof of your ability' },
  ],
  'Investing / Financial Growth': [
    { title: 'Review your allocation', description: 'Check if your current split matches your risk profile' },
    { title: 'Research one new asset', description: 'Spend 30 min learning about an unfamiliar instrument' },
    { title: 'Set an automation', description: 'Automate one recurring investment or savings transfer' },
  ],
  'Fitness': [
    { title: 'Set a measurable weekly target', description: 'Define a specific number you can track (reps, km, kg)' },
    { title: 'Find an accountability partner', description: 'Train with someone at your level or slightly above' },
    { title: 'Track daily with a habit log', description: 'Log every session, even short ones, to build consistency' },
  ],
  'Academics': [
    { title: 'Create a study schedule', description: 'Block specific hours for focused study this week' },
    { title: 'Find a study partner', description: 'Learning with others improves retention by 50%' },
    { title: 'Set a practice exam date', description: 'Testing yourself is the most effective way to learn' },
  ],
  'Mental Health': [
    { title: 'Start a daily reflection habit', description: '5 minutes of journaling before bed compounds fast' },
    { title: 'Identify one stress trigger', description: 'Name the pattern so you can interrupt it' },
    { title: 'Schedule one recovery activity', description: 'Block time for something that genuinely recharges you' },
  ],
  'Philosophical Development': [
    { title: 'Read one challenging text', description: 'Pick something that stretches your current worldview' },
    { title: 'Write down your core values', description: 'Clarity of values drives better daily decisions' },
    { title: 'Have a deep conversation', description: 'Find someone who disagrees with you and listen' },
  ],
  'Culture / Hobbies / Creative Pursuits': [
    { title: 'Dedicate a weekly creative block', description: 'Protect 2h/week for creation, not consumption' },
    { title: 'Share your work', description: 'Post or show one piece to get feedback and accountability' },
    { title: 'Learn one new technique', description: 'Deliberate practice on a specific skill, not just repetition' },
  ],
  'Intimacy / Romantic Exploration': [
    { title: 'Plan an intentional date', description: 'Something that creates a shared experience, not just dinner' },
    { title: 'Practice vulnerability', description: 'Share one thing you normally keep to yourself' },
    { title: 'Ask a meaningful question', description: 'Go deeper than surface-level conversation' },
  ],
  'Friendship / Social Engagement': [
    { title: 'Reach out to someone first', description: 'Send one message to someone you have not talked to recently' },
    { title: 'Organize a small gathering', description: 'Even 2-3 people creates stronger bonds than large groups' },
    { title: 'Be the initiator this week', description: 'Make plans instead of waiting to be invited' },
  ],
  'Personal Goals': [
    { title: 'Break it into milestones', description: 'Define 3 checkpoints between here and completion' },
    { title: 'Set a deadline', description: 'Goals without deadlines are just wishes' },
    { title: 'Tell someone about it', description: 'Public commitment increases follow-through significantly' },
  ],
};

/** Get template sub-goals for a domain. Falls back to Personal Goals templates. */
function getTemplateSubgoals(domain: string): Array<{ title: string; description: string }> {
  return DOMAIN_SUBGOAL_TEMPLATES[domain] ?? DOMAIN_SUBGOAL_TEMPLATES['Personal Goals'];
}

interface SuggestedBet {
  goalNodeId: string;
  goalName: string;
  currentProgress: number; // 0-100
  suggestedStake: number;
  reason: string;
}

interface SuggestedSubgoals {
  targetGoalId: string;
  targetGoalName: string;
  suggestions: Array<{ title: string; description: string }>;
}

interface SuggestedProgression {
  completedGoalName: string;
  completedGoalDomain: string;
  suggestion: string;
}

/** Build bet suggestions from goal nodes. Returns up to 2. */
function buildBetSuggestions(
  nodes: any[],
  activeBetGoalIds: Set<string>,
  activeBetCount: number,
  userBalance: number,
): SuggestedBet[] {
  // Guard: skip if balance too low or already at bet cap
  if (userBalance < 10 || activeBetCount >= 3) return [];

  const stake = Math.min(50, Math.floor(userBalance * 0.1));
  if (stake < 1) return [];

  const candidates = nodes
    .filter((n: any) => !n.parentId && (n.progress ?? 0) < 0.3 && !activeBetGoalIds.has(n.id))
    .slice(0, 2);

  return candidates.map((n: any) => {
    const name = n.name || n.title || 'Goal';
    const pct = Math.round((n.progress ?? 0) * 100);
    return {
      goalNodeId: n.id,
      goalName: name,
      currentProgress: pct,
      suggestedStake: stake,
      reason: `You're at ${pct}% on ${name}. A stake creates real accountability.`,
    };
  });
}

/** Find earliest root goal that could use sub-goals. Returns null if none qualify. */
function buildSubgoalSuggestion(nodes: any[], useLLM: boolean): SuggestedSubgoals | null {
  const earliestRoot = nodes.find((n: any) => !n.parentId);
  if (!earliestRoot) return null;

  // Count existing children
  const childCount = nodes.filter((n: any) => n.parentId === earliestRoot.id).length;
  if (childCount >= 3) return null;

  const goalName = earliestRoot.name || earliestRoot.title || 'Goal';
  const domain = earliestRoot.domain || 'Personal Goals';

  // Template mode: use domain templates (LLM mode fills in later via post-assembly)
  const suggestions = useLLM ? [] : getTemplateSubgoals(domain).slice(0, 3 - childCount);

  return {
    targetGoalId: earliestRoot.id,
    targetGoalName: goalName,
    suggestions,
  };
}

/** Find oldest completed root goal and suggest progression. */
function buildProgressionSuggestion(nodes: any[]): SuggestedProgression | null {
  const completedRoot = nodes.find(
    (n: any) => !n.parentId && ((n.progress ?? 0) >= 1.0 || n.status === 'completed'),
  );
  if (!completedRoot) return null;

  const goalName = completedRoot.name || completedRoot.title || 'Goal';
  const domain = completedRoot.domain || 'Personal Goals';

  return {
    completedGoalName: goalName,
    completedGoalDomain: domain,
    suggestion: `You mastered "${goalName}". Next level: raise the bar, explore an adjacent skill, or mentor someone in this domain.`,
  };
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
   * @param useLLM - If true, use real LLM. If false, use template-based response.
   */
  public static async generateDailyBrief(userId: string, userName: string, userCity: string, useLLM: boolean = false) {
    const today = new Date().toISOString().slice(0, 10);

    // --- Phase 1: Gather all data in parallel ---
    const [
      todaySnapshot, yesterdaySnapshot,
      goalTreeRes, matchRes, eventsRes, placesRes,
      activeBetsRes, profileRes,
    ] = await Promise.all([
      buildSnapshot(userId),
      loadYesterdaySnapshot(userId),
      supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 1 }),
      supabase.from('events').select('id, title, event_date, city').gte('event_date', today).limit(10),
      supabase.from('places').select('id, name, city, tags').limit(10),
      supabase.from('bets').select('goal_node_id').eq('user_id', userId).eq('status', 'active'),
      supabase.from('profiles').select('praxis_points').eq('id', userId).single(),
    ]);

    const nodes: any[] = goalTreeRes.data?.nodes ?? [];
    const userDomains = extractUserDomains(nodes);
    const userBalance: number = profileRes.data?.praxis_points ?? 0;

    // --- Phase 2: Pre-compute picks (zero tokens to LLM) ---
    const topMatch: PickedMatch | null = matchRes.data?.[0]
      ? { id: matchRes.data[0].id, name: matchRes.data[0].name }
      : null;
    const topEvent = pickBestEvent(eventsRes.data ?? [], userCity);
    const topPlace = pickBestPlace(placesRes.data ?? [], userCity, userDomains);

    // --- Phase 3: Build new suggestion sections ---
    const activeBetGoalIds = new Set<string>(
      (activeBetsRes.data ?? []).map((b: any) => b.goal_node_id).filter(Boolean),
    );
    const activeBetCount = activeBetGoalIds.size;

    const suggestedBets = buildBetSuggestions(nodes, activeBetGoalIds, activeBetCount, userBalance);
    const suggestedSubgoals = buildSubgoalSuggestion(nodes, useLLM);
    const suggestedProgression = buildProgressionSuggestion(nodes);

    // --- Phase 4: Build diff context (compressed) ---
    let diffContext: string;
    if (yesterdaySnapshot) {
      diffContext = `Y:${yesterdaySnapshot}|N:${todaySnapshot}`;
    } else {
      diffContext = todaySnapshot;
    }

    // --- Phase 5: Generate brief ---
    let recommendations: any;

    if (!useLLM) {
      // Template-based brief (Minimal AI Mode / free tier)
      recommendations = {
        message: `Good morning, ${userName}. Today's focus: build momentum in your key goals.`,
        match: topMatch ? { id: topMatch.id, name: topMatch.name, reason: 'Aligned goals in your active domains' } : null,
        event: topEvent ? { id: topEvent.id, title: topEvent.title, reason: 'Coming up soon — worth checking out' } : null,
        place: topPlace ? { id: topPlace.id, name: topPlace.name, reason: 'Potential spot for focus or reflection' } : null,
        challenge: { type: 'bet' as const, target: 'Complete one key action today', terms: 'Log it in your tracker' },
        resources: [],
        routine: [
          { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
          { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
        ],
        suggestedBets: suggestedBets.length > 0 ? suggestedBets : undefined,
        suggestedSubgoals: suggestedSubgoals,
        suggestedProgression: suggestedProgression,
      };
    } else {
      // Premium LLM-generated brief — compact prompt (~350 tokens input)
      const matchLine = topMatch ? topMatch.name : 'none';
      const eventLine = topEvent ? `${topEvent.title} (${topEvent.date})` : 'none';
      const placeLine = topPlace ? topPlace.name : 'none';

      const betTargets = suggestedBets.length > 0
        ? suggestedBets.map(b => `${b.goalName} ${b.currentProgress}%`).join(', ')
        : 'none';

      const earliestGoal = suggestedSubgoals
        ? `${suggestedSubgoals.targetGoalName} (${nodes.find((n: any) => n.id === suggestedSubgoals.targetGoalId)?.domain || 'General'}, ${Math.round((nodes.find((n: any) => n.id === suggestedSubgoals.targetGoalId)?.progress ?? 0) * 100)}%, ${nodes.filter((n: any) => n.parentId === suggestedSubgoals.targetGoalId).length} sub-goals)`
        : 'none';

      const completedGoal = suggestedProgression
        ? `${suggestedProgression.completedGoalName} (${suggestedProgression.completedGoalDomain})`
        : 'none';

      const prompt = `Axiom brief for ${userName} (${userCity}).
State: ${todaySnapshot}
Delta: ${diffContext}
Match: ${matchLine} | Event: ${eventLine} | Place: ${placeLine}
Bet targets: ${betTargets}
Earliest goal: ${earliestGoal}
Completed goal: ${completedGoal}

Any field marked "none" = return "" for that reason. JSON only:
{"message":"1-2 sentence motivating morning message","matchReason":"","eventReason":"","placeReason":"","betReasons":["why stake on each bet target"],"subgoals":[{"title":"concrete sub-goal","desc":"why"}],"progression":"what to do next after completed goal","routine":[{"time":"Morning/Afternoon/Evening","task":"action","why":"alignment"}]}`;

      try {
        const responseText = await aiCoachingService['runWithFallback'](prompt);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const llmOutput = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

        // Post-LLM assembly: merge pre-computed data with LLM-generated reasons
        recommendations = {
          message: llmOutput.message || `Focus on showing up today, ${userName}.`,
          match: topMatch ? { id: topMatch.id, name: topMatch.name, reason: llmOutput.matchReason || '' } : null,
          event: topEvent ? { id: topEvent.id, title: topEvent.title, reason: llmOutput.eventReason || '' } : null,
          place: topPlace ? { id: topPlace.id, name: topPlace.name, reason: llmOutput.placeReason || '' } : null,
          challenge: { type: 'bet' as const, target: 'Complete one key action today', terms: 'Log it in your tracker' },
          resources: [],
          routine: Array.isArray(llmOutput.routine) ? llmOutput.routine : [
            { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
            { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
          ],
          // Merge LLM reasons into pre-computed bet suggestions
          suggestedBets: suggestedBets.length > 0
            ? suggestedBets.map((bet, i) => ({
                ...bet,
                reason: (Array.isArray(llmOutput.betReasons) && llmOutput.betReasons[i]) || bet.reason,
              }))
            : undefined,
          // Merge LLM sub-goals into pre-computed structure
          suggestedSubgoals: suggestedSubgoals
            ? {
                ...suggestedSubgoals,
                suggestions: Array.isArray(llmOutput.subgoals) && llmOutput.subgoals.length > 0
                  ? llmOutput.subgoals.slice(0, 3).map((s: any) => ({ title: s.title || '', description: s.desc || s.description || '' }))
                  : getTemplateSubgoals(nodes.find((n: any) => n.id === suggestedSubgoals.targetGoalId)?.domain || 'Personal Goals'),
              }
            : null,
          // Merge LLM progression
          suggestedProgression: suggestedProgression
            ? {
                ...suggestedProgression,
                suggestion: llmOutput.progression || suggestedProgression.suggestion,
              }
            : null,
        };
      } catch (err: any) {
        logger.warn(`[AxiomScan] LLM failed for ${userName}, falling back to template: ${err.message}`);
        // Fallback to template on LLM failure
        recommendations = {
          message: `Good morning, ${userName}. Today's focus: build momentum in your key goals.`,
          match: topMatch ? { id: topMatch.id, name: topMatch.name, reason: 'Aligned goals in your active domains' } : null,
          event: topEvent ? { id: topEvent.id, title: topEvent.title, reason: 'Coming up soon — worth checking out' } : null,
          place: topPlace ? { id: topPlace.id, name: topPlace.name, reason: 'Potential spot for focus or reflection' } : null,
          challenge: { type: 'bet' as const, target: 'Complete one key action today', terms: 'Log it in your tracker' },
          resources: [],
          routine: [
            { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
            { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
          ],
          suggestedBets: suggestedBets.length > 0 ? suggestedBets : undefined,
          suggestedSubgoals: suggestedSubgoals,
          suggestedProgression: suggestedProgression,
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
