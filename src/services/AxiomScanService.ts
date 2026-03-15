import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from './AICoachingService';
import { EngagementMetricService } from './EngagementMetricService';
import logger from '../utils/logger';

const aiCoachingService = new AICoachingService();
const engagementMetricService = new EngagementMetricService();

// ---------------------------------------------------------------------------
// Metric-based brief generation (no content scanning)
// ---------------------------------------------------------------------------

/**
 * Generate brief recommendations based on engagement metrics.
 * READS: Trackers, notes, public posts, goal data
 * DOES NOT READ: Private messages, DMs
 * 
 * TONE: Encouraging, suggestive, curious - NOT critical
 * - Focus on what's working
 * - Ask about struggles instead of pointing them out
 * - Suggest small actions, don't demand
 */
async function generateMetricBasededBrief(metrics: any, userName: string): Promise<any> {
  const { 
    archetype, 
    motivationStyle, 
    riskFactors, 
    checkinStreak, 
    weeklyActivityScore, 
    socialEngagementScore,
    trackerTrends,
    topNoteThemes,
    recommendationContext,
  } = metrics;

  const { interestedTopics, recentAchievements, currentFocus } = recommendationContext || {};

  // Message templates based on archetype WITH content context
  // TONE: Warm, encouraging, curious - never critical
  const messages: Record<string, string> = {
    consolidator: `Good morning, ${userName}. You have a gift for finishing what you start. ${currentFocus ? `How is "${currentFocus}" coming along?` : 'What feels meaningful to complete today?'}`,
    explorer: `${userName}, your curiosity is your superpower. ${interestedTopics?.[0] ? `I notice ${interestedTopics[0]} has been on your mind - what is one small step?` : 'What is calling to you today?'}`,
    achiever: `${userName}, your momentum is inspiring. ${recentAchievements?.[0] ? `After "${recentAchievements[0]}", what is next on your list?` : 'Keep building - you are on a roll.'}`,
    struggler: `${userName}, every expert was once a beginner. ${trackerTrends?.[0] ? `How is "${trackerTrends[0].trackerName}" going?` : 'What feels doable today, even if small?'}`,
    socializer: `${userName}, your connections make you stronger. ${socialEngagementScore > 60 ? 'Who could you share a win with today?' : 'Consider reaching out to someone - they would love to hear from you.'}`,
    lone_wolf: `${userName}, you do your best work when you trust yourself. ${currentFocus ? `What does your intuition say about "${currentFocus}"?` : 'What feels like the right next step?'}`,
    burnout_risk: `${userName}, you have been giving a lot. ${trackerTrends?.some((t: any) => t.direction === 'declining') ? `Some things feel harder lately - what would support look like?` : 'What would feel restorative today?'}`,
  };

  // Routine templates based on motivation style
  const routines: Record<string, any[]> = {
    streak_driven: [
      { time: 'Morning', task: 'Check in to maintain your streak', alignment: 'Protect your momentum' },
      { time: 'Afternoon', task: 'One focused action on your top goal', alignment: 'Build the chain' },
      { time: 'Evening', task: 'Reflect on your win today', alignment: 'Reinforce the habit' },
    ],
    progress_focused: [
      { time: 'Morning', task: 'Review your goal progress bars', alignment: 'Visualize the path' },
      { time: 'Afternoon', task: 'Move one goal forward by 5%', alignment: 'Tangible progress' },
      { time: 'Evening', task: 'Update your progress tracker', alignment: 'Measure what matters' },
    ],
    social_accountable: [
      { time: 'Morning', task: 'Share your intention with someone', alignment: 'Create accountability' },
      { time: 'Afternoon', task: 'Work on your public commitment', alignment: 'Follow through' },
      { time: 'Evening', task: 'Report your progress', alignment: 'Close the loop' },
    ],
    novelty_seeking: [
      { time: 'Morning', task: 'Try a new approach to your goal', alignment: 'Fresh perspective' },
      { time: 'Afternoon', task: 'Explore a different workspace', alignment: 'Change of scenery' },
      { time: 'Evening', task: 'Note what worked differently', alignment: 'Learn and adapt' },
    ],
    routine_based: [
      { time: 'Morning', task: 'Follow your established routine', alignment: 'Consistency compounds' },
      { time: 'Afternoon', task: 'Deep work block at your usual time', alignment: 'Rhythm creates flow' },
      { time: 'Evening', task: 'Evening review ritual', alignment: 'Close the day properly' },
    ],
  };

  // Challenge suggestions based on risk factors
  // TONE: Inviting, not demanding - frame as opportunities
  const challenges: Record<string, { type: 'bet' | 'duel'; target: string; terms: string }> = {
    streak_about_to_break: { type: 'bet', target: 'Check in today', terms: 'Your streak is worth protecting - want to keep it going?' },
    goal_stagnation: { type: 'bet', target: 'Update any goal', terms: 'What would feel like progress, even tiny?' },
    social_isolation: { type: 'bet', target: 'Give honor to someone', terms: 'Who could use encouragement today?' },
    overwhelm: { type: 'bet', target: 'Complete one tiny task', terms: 'What is the smallest thing that would feel good?' },
    declining_activity: { type: 'bet', target: 'Show up for 5 minutes', terms: 'Just start - see how it feels' },
    perfectionism_trap: { type: 'bet', target: 'Mark something as done', terms: 'What is "good enough" today?' },
  };

  // Pick challenge based on primary risk factor
  const primaryRisk = riskFactors[0];
  const challenge = primaryRisk && challenges[primaryRisk] 
    ? challenges[primaryRisk]
    : { type: 'bet' as const, target: 'Complete one key action today', terms: 'Log it in your tracker' };

  // Resource suggestions based on archetype AND content
  // TONE: Supportive suggestions, not prescriptions
  const resources: any[] = [];
  
  // Tracker-based suggestions - ASK about declining, don't criticize
  if (trackerTrends?.some((t: any) => t.direction === 'declining')) {
    const declining = trackerTrends.find((t: any) => t.direction === 'declining');
    resources.push({
      goal: declining?.trackerName || 'Consistency',
      suggestion: `How is ${declining?.trackerName || 'this'} going? Want to talk about what has been hard?`,
      details: `You are ${Math.abs(declining?.weekOverWeekChange || 10)}% from last week - no judgment, just curious`
    });
  }
  
  // Note theme-based suggestions - encourage reflection
  if (topNoteThemes?.[0]) {
    resources.push({ 
      goal: topNoteThemes[0], 
      suggestion: `You've been writing about "${topNoteThemes[0]}" - what's it teaching you?`, 
      details: 'Your reflections matter' 
    });
  }
  
  // Archetype-based suggestions - supportive, not prescriptive
  if (archetype === 'explorer' || archetype === 'burnout_risk') {
    resources.push({ 
      goal: 'Focus', 
      suggestion: 'Want to try 25 min focused, 5 min break? Or find your own rhythm.', 
      details: 'Pomodoro is one option' 
    });
  }
  if (archetype === 'struggler') {
    resources.push({
      goal: 'Momentum',
      suggestion: 'What is one thing you could do in 2 minutes?',
      details: 'Small starts count'
    });
  }
  if (socialEngagementScore < 40) {
    resources.push({ 
      goal: 'Connection', 
      suggestion: 'Have you thought about joining a group session?', 
      details: 'Some folks find it helpful' 
    });
  }
  
  // Event follow-up - ASK about failed events, don't criticize
  if (riskFactors.includes('declining_activity')) {
    resources.push({ 
      goal: 'Check-in', 
      suggestion: 'I noticed things have been quieter lately - how are you doing?', 
      details: 'No pressure, just checking in' 
    });
  }

  return {
    message: messages[archetype] || `Good morning, ${userName}. Today's focus: build momentum in your key goals.`,
    match: null as any, // Will be filled by match service
    event: null as any, // Will be filled by event picker
    place: null as any, // Will be filled by place picker
    challenge,
    resources,
    routine: routines[motivationStyle] || routines.routine_based,
  };
}

// ---------------------------------------------------------------------------
// Server-side pick scoring - replaces raw JSON dumps to LLM
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
          logger.info(`[AxiomScan] Skipping free user ${user.name} - brief already generated this week.`);
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
          logger.info(`[AxiomScan] Skipping pro user ${user.name} - brief already generated today.`);
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
   * Generate daily brief for a user using ENGAGEMENT METRICS only.
   * NO content scanning - only behavioral patterns (timestamps, counts, states).
   * @param useLLM - Deprecated: kept for API compatibility, now uses metric-based templates
   */
  public static async generateDailyBrief(userId: string, userName: string, userCity: string, useLLM: boolean = false) {
    const today = new Date().toISOString().slice(0, 10);

    // --- Phase 1: Calculate engagement metrics (no content analysis) ---
    // Try cache first (metrics are cached for 24h)
    let metrics = await engagementMetricService.getCachedMetrics(userId);
    
    if (!metrics) {
      // Calculate fresh metrics
      metrics = await engagementMetricService.calculateMetrics(userId);
      // Store for 24h cache
      await engagementMetricService.storeMetrics(userId, metrics);
    }

    // --- Phase 2: Generate metric-based recommendations ---
    const recommendations = await generateMetricBasededBrief(metrics, userName);

    // --- Phase 3: Algorithmic picks for match/event/place ---
    const [matchRes, eventsRes, placesRes, goalTreeRes] = await Promise.all([
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 1 }),
      supabase.from('events').select('id, title, event_date, city').gte('event_date', today).limit(10),
      supabase.from('places').select('id, name, city, tags').limit(10),
      supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
    ]);

    const nodes: any[] = goalTreeRes.data?.nodes ?? [];
    const userDomains = extractUserDomains(nodes);

    // Pick best match
    if (matchRes.data?.[0]) {
      recommendations.match = {
        id: matchRes.data[0].id,
        name: matchRes.data[0].name,
        reason: 'Aligned goals in your active domains',
      };
    }

    // Pick best event
    const topEvent = pickBestEvent(eventsRes.data ?? [], userCity);
    if (topEvent) {
      recommendations.event = {
        id: topEvent.id,
        title: topEvent.title,
        reason: 'Coming up soon - worth checking out',
      };
    }

    // Pick best place
    const topPlace = pickBestPlace(placesRes.data ?? [], userCity, userDomains);
    if (topPlace) {
      recommendations.place = {
        id: topPlace.id,
        name: topPlace.name,
        reason: 'Potential spot for focus or reflection',
      };
    }

    // --- Phase 4: Store brief ---
    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      date: today,
      brief: recommendations,
      generated_at: new Date().toISOString(),
    });

    logger.info(`[AxiomScan] Generated metric-based brief for ${userName} (archetype: ${metrics.archetype})`);
  }
}
