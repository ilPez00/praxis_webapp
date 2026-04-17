import cron from 'node-cron';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from './AICoachingService';
import { EngagementMetricService } from './EngagementMetricService';
import { AxiomScheduleService } from './AxiomScheduleService';
import { GoogleCalendarService } from './GoogleCalendarService';
import { AxiomDailySummaryService } from './AxiomDailySummaryService';
import { AxiomProgressEstimationService } from './AxiomProgressEstimationService';
import logger from '../utils/logger';

const axiomScheduleService = new AxiomScheduleService();
const googleCalendarService = new GoogleCalendarService();
const aiCoachingService = new AICoachingService();
const engagementMetricService = new EngagementMetricService();
const dailySummaryService = new AxiomDailySummaryService();
const progressEstimationService = new AxiomProgressEstimationService();

// ---------------------------------------------------------------------------
// Metric-based brief generation (no content scanning)
// ---------------------------------------------------------------------------

/**
 * Generate brief recommendations based on engagement metrics.
 * 
 * READS: Trackers, notes, public posts, goal data
 * DOES NOT READ: Private messages, DMs
 * 
 * TONE: Encouraging, suggestive, curious - NOT critical
 * - Focus on what's working
 * - Ask about struggles instead of pointing them out
 * - Suggest small actions, don't demand
 * 
 * @param metrics - User engagement metrics including archetype, streak, trends
 * @param userName - User's display name for personalization
 * @returns Promise containing personalized brief with message, routine, challenges, and resources
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

  // Full 17-slot hourly routine (06:00-22:00) — concise tasks
  const routine = generateRoutineFromArchetype(archetype, motivationStyle);

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
    routine,
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

/**
 * AxiomScanService - Automated daily brief generation service
 * 
 * Responsibilities:
 * - Runs scheduled cron jobs to generate daily briefs for all active users
 * - Calculates engagement metrics and user archetypes
 * - Generates personalized AI-powered daily protocols including:
 *   - Morning messages tailored to user archetype
 *   - Daily routine suggestions (hourly tasks from 06:00-22:00)
 *   - Match, event, and place recommendations
 *   - Challenge/bet suggestions based on risk factors
 *   - Resource recommendations based on tracker trends and note themes
 * - Stores generated briefs in database for frontend consumption
 * - Auto-saves briefs to notebook_entries for historical tracking
 * 
 * Schedule:
 * - Runs daily at midnight (00:00) via cron
 * - Generates briefs for users active in last 30 days
 * - Free users: Mon/Wed/Fri only (unless they pay 500 PP)
 * - Premium users: Daily
 * 
 * Architecture:
 * - Uses engagement metrics to determine user archetype
 * - LLM-powered message generation with fallback to algorithmic templates
 * - Concurrent processing (5 users at a time) for performance
 * - Comprehensive error handling and logging
 */
export class AxiomScanService {
  /**
   * Initialize and start the automated scan service
   * Schedules midnight cron job for daily brief generation
   *
   * @remarks
   * Cron schedule: Randomized hour (00:00 - 05:00) to balance API load
   * Randomization helps distribute load across API keys more evenly
   * Error handling: Logs errors but doesn't throw to avoid crashing the service
   */
  public static start() {
    // Schedule at a random time between 00:00 and 05:00 each day
    // We use a cron that runs every hour from 0-5 AM, then add random minute delay
    cron.schedule('0 0-5 * * *', async () => {
      // Add random minute delay (0-59 minutes) within the hour
      const randomMinutes = Math.floor(Math.random() * 60);
      logger.info(`[AxiomScan] Scheduled run in ${randomMinutes} minutes...`);
      
      setTimeout(async () => {
        logger.info('[AxiomScan] Starting midnight automated scan...');
        try {
          await this.runGlobalScan();
        } catch (err: any) {
          logger.error('[AxiomScan] Global scan failed:', err.message);
        }
      }, randomMinutes * 60 * 1000);
    });
    logger.info('[AxiomScan] Midnight cron job scheduled (randomized 00:00-05:59).');
  }

  /**
   * Run global scan to generate daily briefs for all active users
   * 
   * Process:
   * 1. Fetch all users from profiles table
   * 2. Filter to users active in last 30 days
   * 3. Process users in batches of 5 (concurrent execution)
   * 4. For each user:
   *    - Check premium status and day of week (free users: Mon/Wed/Fri only)
   *    - Calculate engagement metrics
   *    - Generate LLM-powered daily brief
   *    - Store brief in axiom_daily_briefs table
   *    - Auto-save to notebook_entries for history
   * 5. Log success/failure counts
   * 
   * @throws {Error} If database query fails
   * @returns Promise<void>
   */
  public static async runGlobalScan() {
    const today = new Date().toISOString().slice(0, 10);

    // Get ALL active users (no frequency limits - always generate fresh briefs)
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, name, city, is_premium, is_admin, minimal_ai_mode, last_activity_date');

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    // Filter to only users who have been active in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = users.filter(u => 
      !u.last_activity_date || new Date(u.last_activity_date) >= thirtyDaysAgo
    );

    logger.info(`[AxiomScan] ${activeUsers.length} active users found for daily brief generation.`);

    // Filter to only users who logged in TODAY (not just active in last 30 days)
    const usersLoggedInToday = activeUsers.filter(u => 
      u.last_activity_date && u.last_activity_date.slice(0, 10) === today
    );

    logger.info(`[AxiomScan] ${usersLoggedInToday.length} users logged in today - generating briefs only for these users.`);

    // Process up to 3 concurrently (reduced to avoid rate limits)
    const CONCURRENCY = 3;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < usersLoggedInToday.length; i += CONCURRENCY) {
      const batch = usersLoggedInToday.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(async user => {
        try {
          // Use retry logic with exponential backoff for LLM calls
          await this.generateDailyBriefWithRetry(user.id, user.name || 'Student', user.city || 'Unknown', true);
          successCount++;
        } catch (err: any) {
          logger.warn(`[AxiomScan] Failed for ${user.name || user.id}: ${err.message}`);
          failCount++;
        }
      }));
       
      // Larger pause between batches to respect RPM limits (3s instead of 2s)
      if (i + CONCURRENCY < usersLoggedInToday.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    logger.info(`[AxiomScan] Scan complete: ${successCount} succeeded, ${failCount} failed.`);

    // Auto-generate tracker templates for users who don't have one yet
    try {
      await this.autoPopulateTrackerTemplates();
    } catch (err: any) {
      logger.warn(`[AxiomScan] Template auto-populate failed: ${err.message}`);
    }
  }

  /**
   * Auto-populate tracker templates from frequently logged items.
   * For each tracker that has entries but no saved template, analyze
   * the user's history and create a template from their top items.
   */
  private static async autoPopulateTrackerTemplates() {
    // Find trackers without a template (goal is null/empty or has no template_rows)
    const { data: trackers } = await supabase
      .from('trackers')
      .select('id, user_id, type, goal');

    if (!trackers || trackers.length === 0) return;

    const needsTemplate = trackers.filter(t =>
      !t.goal?.template_rows || !Array.isArray(t.goal.template_rows) || t.goal.template_rows.length === 0
    );

    if (needsTemplate.length === 0) return;

    logger.info(`[AxiomScan] Auto-populating templates for ${needsTemplate.length} trackers`);
    let populated = 0;

    for (const tracker of needsTemplate) {
      try {
        const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        const { data: entries } = await supabase
          .from('tracker_entries')
          .select('data')
          .eq('tracker_id', tracker.id)
          .gte('created_at', since);

        if (!entries || entries.length < 3) continue; // Need at least 3 entries to infer a pattern

        // Count item names
        const nameCounts: Record<string, { count: number; unit?: string; category?: string; subject?: string }> = {};
        for (const entry of entries) {
          const items = entry.data?.items;
          if (Array.isArray(items)) {
            for (const item of items) {
              const name = (item.name || item.label || '').trim();
              if (!name) continue;
              if (!nameCounts[name]) nameCounts[name] = { count: 0, unit: item.unit, category: item.category, subject: item.subject };
              nameCounts[name].count++;
            }
          }
        }

        // Take top 8 items that appear at least twice
        const topItems = Object.entries(nameCounts)
          .filter(([, v]) => v.count >= 2)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 8)
          .map(([name, meta]) => ({
            label: name,
            ...(meta.unit ? { unit: meta.unit } : {}),
            ...(meta.category ? { category: meta.category } : {}),
            ...(meta.subject ? { subject: meta.subject } : {}),
          }));

        if (topItems.length < 2) continue;

        // Save as template
        const existingGoal = (tracker.goal && typeof tracker.goal === 'object') ? tracker.goal : {};
        await supabase
          .from('trackers')
          .update({ goal: { ...existingGoal, template_rows: topItems, template_auto: true } })
          .eq('id', tracker.id);

        populated++;
      } catch (err: any) {
        logger.warn(`[AxiomScan] Failed to auto-populate template for tracker ${tracker.id}: ${err.message}`);
      }
    }

    if (populated > 0) {
      logger.info(`[AxiomScan] Auto-populated ${populated} tracker templates`);
    }
  }

  /**
   * Generate daily brief for a user using FULL LLM-POWERED PROTOCOL
   * 
   * This is the core method that creates personalized daily protocols for users.
   * It uses a combination of engagement metrics, user archetype, and AI to generate:
   * - Personalized greeting message based on archetype and recent activity
   * - Hourly routine (06:00-22:00) tailored to user's goals and motivation style
   * - Match recommendation (sparring partner for accountability)
   * - Event recommendation (local or relevant events)
   * - Place recommendation (places aligned with user's domains)
   * - Daily challenge (bet or duel to maintain momentum)
   * - Resource suggestions (goal insights based on tracker trends)
   * 
   * @param userId - The user's unique identifier
   * @param userName - User's display name for personalization
   * @param userCity - User's city for local recommendations (events, places)
   * @param useLLM - Always true (deprecated parameter kept for compatibility)
   * @param userData - Optional pre-fetched data to avoid re-fetching (for unified scan)
   * 
   * @returns Promise<void> - Brief is stored in database
   * 
   * @throws {Error} If user data cannot be fetched or brief generation fails
   * 
   * @remarks
   * - Free users only get briefs on Mon/Wed/Fri (unless they pay 500 PP)
   * - Premium users get daily briefs
   * - Briefs are auto-saved to notebook_entries for historical tracking
   * - Uses LLM with algorithmic fallback if AI fails
   * 
   * @example
   * await AxiomScanService.generateDailyBrief('user-123', 'John', 'Milan', true);
   */
  public static async generateDailyBrief(
    userId: string,
    userName: string,
    userCity: string,
    useLLM: boolean = true,
    userData?: any
  ) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    
    // Check if user is premium
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium, praxis_points')
      .eq('id', userId)
      .single();
    
    const isPremium = profile?.is_premium || false;
    const userPoints = profile?.praxis_points || 0;
    
    // Free users: Only Mon(1), Wed(3), Fri(5)
    const freeDays = [1, 3, 5];
    const isFreeDay = freeDays.includes(dayOfWeek);
    
    // Check if brief already exists for today
    const { data: existingBrief } = await supabase
      .from('axiom_daily_briefs')
      .select('brief')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .maybeSingle();
    
    if (existingBrief) {
      logger.info(`[AxiomScan] Brief already exists for ${userId} on ${todayStr}`);
      return;
    }
    
    // Free user on non-free day: Skip generation (they can pay 500 PP in frontend)
    if (!isPremium && !isFreeDay) {
      logger.info(`[AxiomScan] Free user ${userId} on non-free day (${dayOfWeek}) - skipping auto-generation`);
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const nextFreeDay = dayOfWeek === 0 ? 'Monday' : dayOfWeek === 2 ? 'Wednesday' : dayOfWeek === 4 ? 'Friday' : dayOfWeek === 6 ? 'Monday' : 'Wednesday';
      
      // Create a placeholder brief indicating they can purchase
      const placeholderBrief = {
        message: `🔒 **Daily Brief Locked**\n\nHey ${userName}! As a free member, you get Axiom wisdom on **Mondays, Wednesdays, and Fridays**.\n\n**Next free brief:** ${nextFreeDay}\n\nWant today's brief? **500 PP** unlocks it instantly! ✨`,
        isLocked: true,
        unlockCost: 500,
        freeDays: ['Monday', 'Wednesday', 'Friday'],
        nextFreeDay,
        source: 'locked' as const,
      };
      
      await supabase.from('axiom_daily_briefs').upsert({
        user_id: userId,
        date: todayStr,
        brief: placeholderBrief,
        generated_at: new Date().toISOString(),
      });
      
      return;
    }

    // --- Phase 1: Calculate engagement metrics ---
    let metrics = await engagementMetricService.getCachedMetrics(userId);

    if (!metrics) {
      metrics = await engagementMetricService.calculateMetrics(userId);
      await engagementMetricService.storeMetrics(userId, metrics);
    }

    // --- Phase 2: Fetch all data for LLM context ---
    // Calculate date 1 month ago for comprehensive activity analysis
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = oneMonthAgo.toISOString();
    
    // Calculate date 6 weeks ago for note filtering (keep existing)
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - (6 * 7));
    const sixWeeksAgoStr = sixWeeksAgo.toISOString();

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const [goalTreeRes, checkinsRes, trackersRes, matchesRes, eventsRes, placesRes, diaryEntriesRes, notebookEntriesRes, monthCheckinsRes, monthTrackersRes, googleEvents] = await Promise.all([
      supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
      // Recent check-ins (7 days)
      supabase.from('checkins').select('checked_in_at,streak_day,mood,win_of_the_day').eq('user_id', userId).order('checked_in_at', { ascending: false }).limit(7),
      supabase.from('trackers').select('id,type,goal').eq('user_id', userId),
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 5 }),
      supabase.from('events').select('id, title, event_date, city, description').gte('event_date', todayStr).limit(10),
      supabase.from('places').select('id, name, city, tags, description').limit(10),
      supabase.from('diary_entries').select('title,content,entry_type,mood,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      // Fetch ALL notebook entries from last 6 weeks (not just 'note' type)
      // This includes: notes, tracker logs, goal progress, achievements, etc.
      supabase.from('notebook_entries')
        .select('title,content,mood,occurred_at,goal_id,entry_type,source_table,source_id,domain')
        .eq('user_id', userId)
        .gte('occurred_at', sixWeeksAgoStr)
        .order('occurred_at', { ascending: false })
        .limit(100),
      // NEW: Fetch last month of check-ins for monthly context
      supabase.from('checkins')
        .select('checked_in_at,streak_day,mood,win_of_the_day')
        .eq('user_id', userId)
        .gte('checked_in_at', oneMonthAgoStr)
        .order('checked_in_at', { ascending: false }),
      // NEW: Fetch last month of tracker activity
      supabase.from('tracker_entries')
        .select('tracker_id,data,logged_at')
        .in('tracker_id', ((await supabase.from('trackers').select('id').eq('user_id', userId)).data || []).map((t: any) => t.id))
        .gte('logged_at', oneMonthAgoStr)
        .order('logged_at', { ascending: false })
        .limit(200),
      // NEW: Fetch Google Calendar events
      googleCalendarService.getEvents(userId, startDate, endDate),
    ]);

    const nodes: any[] = goalTreeRes.data?.nodes ?? [];
    const userDomains = extractUserDomains(nodes);

    // --- Phase 2b: Build daily recap from yesterday's notes/trackers ---
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yStart = `${yesterdayStr}T00:00:00`;
    const yEnd = `${yesterdayStr}T23:59:59`;

    let recapText = '';
    let topNoteThemes: string[] = [];
    
    try {
      const trackerIds = (trackersRes.data || []).map((t: any) => t.id);
      const typeMap = Object.fromEntries((trackersRes.data || []).map((t: any) => [t.id, t.type]));

      const [trackerEntries, journalEntries, checkinEntries, recentDiary] = await Promise.all([
        trackerIds.length > 0
          ? supabase.from('tracker_entries').select('tracker_id, data')
              .in('tracker_id', trackerIds).gte('logged_at', yStart).lte('logged_at', yEnd)
              .then(({ data }) => (data || []).map((e: any) => {
                const tType = typeMap[e.tracker_id] || 'log';
                const d = e.data || {};
                if (tType === 'lift') return `Lifted: ${d.exercise || '?'} ${d.sets}x${d.reps} @ ${d.weight}kg`;
                if (tType === 'cardio') return `Cardio: ${d.activity || '?'} ${d.duration || '?'}min`;
                if (tType === 'meal') return `Ate: ${d.food || '?'} ${d.calories ? d.calories + ' kcal' : ''}`;
                if (tType === 'steps') return `Walked: ${d.steps || 0} steps`;
                if (tType === 'sleep') return `Slept: ${d.hours || '?'}h`;
                return `Logged: ${tType}`;
              }))
          : Promise.resolve([]),
        supabase.from('node_journal_entries').select('note, mood')
          .eq('user_id', userId).gte('logged_at', yStart).lte('logged_at', yEnd)
          .then(({ data }) => (data || []).map((e: any) =>
            `Journal${e.mood ? ' (' + e.mood + ')' : ''}: ${(e.note || '').slice(0, 80)}`
          )),
        supabase.from('checkins').select('mood, win_of_the_day, streak_day')
          .eq('user_id', userId).gte('checked_in_at', yStart).lte('checked_in_at', yEnd)
          .then(({ data }) => (data || []).map((e: any) =>
            `Check-in day ${e.streak_day || '?'}${e.win_of_the_day ? ': ' + e.win_of_the_day : ''}`
          )),
        // Extract themes from recent diary entries
        Promise.resolve((diaryEntriesRes.data || []).slice(0, 5).map((d: any) => {
          if (d.title) return d.title;
          if (d.content) return d.content.slice(0, 50);
          return d.entry_type;
        }).filter(Boolean)),
      ]);
      
      // Use diary titles/themes as note themes
      topNoteThemes = recentDiary;

      const recapItems = [...trackerEntries, ...journalEntries, ...checkinEntries];
      if (recapItems.length > 0) {
        recapText = `Yesterday you logged ${recapItems.length} activities: ${recapItems.slice(0, 6).join('. ')}.`;
      }
    } catch (err) {
      logger.warn('[AxiomScan] Recap generation failed (non-fatal):', err);
    }

    // Process recent notebook entries (last 6 weeks)
    // Separate by type for better context building
    const allNotebookEntries = notebookEntriesRes.data || [];
    
    // All entries from notebook (notes, trackers, goals, etc.)
    const recentNotebookNotes = allNotebookEntries.map((n: any) => ({
      title: n.title,
      content: n.content,
      mood: n.mood,
      date: n.occurred_at ? new Date(n.occurred_at).toISOString().slice(0, 10) : 'recently',
      goalName: n.goal_id ? Object.fromEntries(nodes.map((gn: any) => [gn.id, gn.name]))[n.goal_id] : undefined,
      entryType: n.entry_type,
      domain: n.domain,
      sourceTable: n.source_table,
    }));

    // Extract themes from ALL notebook entries (not just diary)
    topNoteThemes = recentNotebookNotes
      .slice(0, 10)
      .map((n: any) => {
        if (n.title && n.title !== 'Shared Item') return n.title;
        if (n.content) return n.content.slice(0, 50);
        if (n.entryType) return n.entryType;
        return null;
      })
      .filter(Boolean) as string[];

    // --- Phase 3: Generate FULL LLM-powered protocol ---
    const aiCoaching = new AICoachingService();

    const goalsSlice = nodes.slice(0, 5).map((n: any) => ({
      name: n.name, 
      domain: n.domain,
      progress: Math.round((n.progress || 0) * 100), // Keep as number
      weight: n.weight,
    }));

    // Generate LLM-powered full protocol
    let axiomMessage = '';
    let routine: any[] = [];
    let challenge: any = null;
    let resources: any[] = [];
    let goalStrategy: any[] = [];
    let networkLeverage: any = null;
    let source: 'llm' | 'algorithm' = 'algorithm';
    let llmError: string | null = null;

    logger.info(`[AxiomScan] Starting LLM generation for ${userName} (streak: ${metrics.checkinStreak}, archetype: ${metrics.archetype})`);

    try {
      // Build comprehensive notebook context for routine personalization
      // Include ALL entry types: notes, trackers, goals, achievements, etc.
      const notebookContext = recentNotebookNotes.length > 0
        ? `Recent Activity (last 6 weeks from notebook - includes notes, trackers, goal commits, achievements):\n${recentNotebookNotes.map((n: any, i: number) => {
            const typeInfo = n.entryType !== 'note' ? ` [${n.entryType}${n.sourceTable ? '/' + n.sourceTable : ''}]` : '';
            const goalInfo = n.goalName ? ` → ${n.goalName}` : '';
            const domainInfo = n.domain ? ` (${n.domain})` : '';
            return `${i + 1}${typeInfo}${domainInfo}: "${n.title}" — ${n.content?.slice(0, 100) || ''}${goalInfo}`;
          }).join('\n')}`
        : 'No recent notebook entries';

      const gEvents: any[] = Array.isArray(googleEvents) ? googleEvents : [];
      const calendarContext = gEvents.length > 0
        ? `GOOGLE CALENDAR EVENTS (FIXED):
${gEvents.map(e => `- ${e.title} (${new Date(e.start).getHours().toString().padStart(2, '0')}:00 - ${new Date(e.end).getHours().toString().padStart(2, '0')}:00)`).join('\n')}`
        : '';

      const prompt = `You are Axiom, a wise warm and practical life coach inside the Praxis app. Generate a COMPLETE daily protocol for ${userName}.

CONTEXT (LAST 30 DAYS OF ACTIVITY):
- Streak: ${metrics.checkinStreak} days
- Motivation style: ${metrics.motivationStyle}
- Risk factors: ${metrics.riskFactors?.join(', ') || 'None'}
- Goals: ${JSON.stringify(goalsSlice)}
- Monthly check-ins: ${((monthCheckinsRes.data || []) as any[]).length} days logged in last month
- Monthly tracker logs: ${((monthTrackersRes.data || []) as any[]).length} entries in last month
- Recent check-ins: ${JSON.stringify((checkinsRes.data || []).slice(0, 3).map((c: any) => ({ mood: c.mood, win: c.win_of_the_day, streak: c.streak_day })))}
- Tracker trends: ${metrics.trackerTrends?.map((t: any) => `${t.trackerName}: ${t.direction}`).join(', ') || 'None'}
${notebookContext}
${calendarContext ? `\n${calendarContext}` : ''}
${recapText ? `- Yesterday's activity: ${recapText}` : '- Yesterday: No activity logged'}

IMPORTANT: This brief is based on the LAST 30 DAYS of user activity, not just yesterday.
- Consider long-term patterns and trends
- Reference specific achievements from the past month
- Acknowledge consistency (or lack thereof) in tracking
- Make recommendations based on monthly progress, not just daily activity
- The "Recent Activity" section includes ALL their commits from the last 6 weeks

Use THIS DATA to make the routine highly personalized and relevant to what they're actually doing.

Respond ONLY with valid JSON (no markdown, no backticks) matching this exact shape:
{
  "message": "Warm personalized greeting (2-3 sentences) acknowledging their specific journey, recent wins, and current challenges. Reference their streak if > 0, mention a specific goal by name, and acknowledge something from their recent notebook entries or activity. DO NOT mention matches, events, places, or bets in the message.",

  "routine": [
    {
      "time": "06:00",
      "task": "Set intentions — review 'Goal Name' targets",
      "alignment": "Clarity before action = better focus",
      "category": "planning"
    },
    {
      "time": "07:00",
      "task": "30min walk or stretch routine",
      "alignment": "Movement primes the brain for work",
      "category": "exercise"
    }
  ],
  "ROUTINE_NOTE": "Generate EXACTLY 17 entries from 06:00 to 22:00 (one per hour). TASKS: max 12 words, specific + concise. ALIGNMENT: max 10 words. Categories: deep_work, admin, rest, exercise, social, learning, planning, reflection. MAKE ROUTINE RELEVANT TO THEIR NOTEBOOK ENTRIES — if they wrote about 'Career Certification', schedule study blocks. If they noted 'feeling burned out', add rest blocks.",

  "challenge": {
    "type": "bet",
    "target": "One specific, slightly uncomfortable action that directly addresses their primary risk factor",
    "terms": "Motivating framing that acknowledges the discomfort while connecting to their deeper why",
    "deadline": "Today only - specific time like 'by 8pm' or 'before bed'",
    "reward": "Intrinsic reward they'll feel (not external) - connect to their personal values"
  },

  "resources": [
    {
      "goal": "Exact goal name from their list",
      "suggestion": "Concrete next-step advice - what to do in the next 24 hours, not vague direction",
      "details": "Specific insight based on their current progress %, recent activity, or tracker trends. Show you see THEIR situation.",
      "estimatedImpact": "What will happen if they do this - connect to their motivation style"
    },
    {
      "goal": "Second goal name (different from first)",
      "suggestion": "Another concrete action for a different goal domain",
      "details": "Show awareness of their progress or struggle in this area",
      "estimatedImpact": "Specific benefit for them"
    }
  ],

  "goalStrategy": [
    {
      "goal": "Goal name from their list",
      "currentProgress": "e.g. 35%",
      "bottleneck": "What's most likely blocking them on this goal right now",
      "nextMilestone": "Specific milestone they could hit this week",
      "tacticalAdvice": "Concrete step-by-step strategy (2-3 sentences) to move this goal forward TODAY. Be specific: what to do, how long, what tools/resources.",
      "weeklyTarget": "What 'done' looks like by end of week for this goal"
    }
  ],
  "GOAL_STRATEGY_NOTE": "You MUST include goalStrategy array with ONE entry per active goal (up to 5 goals). This is CRITICAL — users need specific strategy for each goal.",

  "networkLeverage": {
    "outreach": "Who in their network (match or community) they should reach out to today and why — be specific about the value exchange",
    "askFor": "What specifically to ask for (feedback, collaboration, accountability check, skill swap)",
    "offer": "What they can offer others based on their strengths and progress",
    "communityAction": "One action in groups/boards that builds their reputation (post insight, answer question, share resource)"
  }
}

CRITICAL RULES:

1. **Message Personalization (NO match/event/place/bet mentions)**:
   - Reference their streak, goals, and notebook entries ONLY
   - Do NOT mention matches, events, places, or bets in the message
   - These appear separately in the dashboard, not in the message

2. **Routine MUST Reference Notebook Entries**:
   - If they wrote about "Career Certification" → Schedule "09:00 — Study for Career Certification (AWS Module 3) — 45min"
   - If they noted "feeling tired" → Add "14:00 — Rest block (nap or meditation) — 30min"
   - If they mentioned "Project X deadline" → Add "10:00 — Deep work on Project X — 90min"
   - MAKE IT OBVIOUS you read their notes by naming specific goals/projects from their notebook

3. **Routine — EXACTLY 17 HOURLY SLOTS (06:00 to 22:00)**:
   - One entry per hour: "06:00", "07:00", ..., "22:00"
   - IF Google Calendar events are provided in FIXED section, you MUST include them at their exact times.
   - For these slots, the task should be the event title.
   - Reference their actual goals BY NAME in other tasks
   - Each entry needs: time, task, alignment, category
   - KEEP EACH TASK UNDER 12 WORDS. Be specific but concise. Example: "Deep work: 'Learn Piano' — practice scales 25min"
   - KEEP EACH ALIGNMENT UNDER 10 WORDS. Example: "Morning focus = peak retention for music"
   - Categories: deep_work, admin, rest, exercise, social, learning, planning, reflection
   - Spread: 4-6 deep_work, 2-3 rest, 1-2 exercise, 1-2 admin, 1 social, 1 planning/reflection

4. **Radical Personalization**:
   - Every sentence must reference something SPECIFIC about THIS user
   - Mention goals by NAME (not "your goal" but "Career Certification")
   - Reference notebook entries ("I saw your note about feeling overwhelmed")
   - Acknowledge streaks, patterns, recent wins

6. **TONE**: Warm, encouraging, curious — NEVER critical. Focus on what's working. Ask about struggles, don't point them out. Speak as a wise mentor who knows them deeply.

6. **NO ARCHETYPE LABELS**: Do not mention archetypes, personality types, or psychological categories. Speak to the person directly without categorizing them.`;

      const rawText = await aiCoaching.runWithFallback(prompt);

      logger.info(`[AxiomScan] LLM response received for ${userName} (${rawText.length} chars)`);

      // Extract JSON from response (strip markdown fences if present)
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const llmData = JSON.parse(jsonMatch[0]);
        axiomMessage = llmData.message || '';
        routine = Array.isArray(llmData.routine) ? llmData.routine : [];
        challenge = llmData.challenge || null;
        resources = Array.isArray(llmData.resources) ? llmData.resources : [];
        // goalStrategy and networkLeverage removed from brief
        source = 'llm';
        logger.info(`[AxiomScan] LLM SUCCESS for ${userName} - message: ${axiomMessage.slice(0, 50)}...`);
      } else {
        // LLM returned plain text — use as message, rest will be algorithmic
        axiomMessage = rawText.slice(0, 500);
        source = 'llm'; // message is still from LLM even if not JSON
        logger.info(`[AxiomScan] LLM returned non-JSON for ${userName} - using as message`);
      }
    } catch (err: any) {
      llmError = err.message || 'Unknown LLM failure';
      logger.error(`[AxiomScan] LLM FAILED for ${userName}: ${llmError}`);
      logger.error(`[AxiomScan] Stack trace: ${err.stack || 'No stack'}`);
      // Fall back to the fully algorithmic brief
      const metricBrief = await generateMetricBasededBrief(metrics, userName);
      axiomMessage = metricBrief.message;
      routine = metricBrief.routine || [];
      challenge = metricBrief.challenge || null;
      resources = metricBrief.resources || [];
      source = 'algorithm';
      logger.warn(`[AxiomScan] Using ALGORITHM fallback for ${userName}`);
    }

    // --- Phase 4: Algorithmic picks for match/event/place ---
    // Pick best match — ALWAYS suggest someone
    let match = null;
    if (matchesRes.data?.[0]) {
      match = {
        id: matchesRes.data[0].id,
        name: matchesRes.data[0].name,
        reason: 'Aligned goals in your active domains',
      };
    } else {
      // Fallback: pick a random active user as a match suggestion
      try {
        const { data: fallbackUsers } = await supabase
          .from('profiles')
          .select('id, name')
          .neq('id', userId)
          .not('name', 'is', null)
          .order('last_activity_date', { ascending: false, nullsFirst: false })
          .limit(10);
        if (fallbackUsers && fallbackUsers.length > 0) {
          const pick = fallbackUsers[Math.floor(Math.random() * fallbackUsers.length)];
          match = {
            id: pick.id,
            name: pick.name,
            reason: 'Active community member — say hello!',
          };
        }
      } catch (err) {
        logger.warn('[AxiomScan] Fallback match query failed (non-fatal):', err);
      }
    }

    // Pick best event
    let event = null;
    const topEvent = pickBestEvent(eventsRes.data ?? [], userCity);
    if (topEvent) {
      event = {
        id: topEvent.id,
        title: topEvent.title,
        reason: 'Coming up soon - worth checking out',
      };
    }

    // Pick best place
    let place = null;
    const topPlace = pickBestPlace(placesRes.data ?? [], userCity, userDomains);
    if (topPlace) {
      place = {
        id: topPlace.id,
        name: topPlace.name,
        reason: 'Potential spot for focus or reflection',
      };
    }

    // Generate routine if LLM didn't provide one
    if (routine.length === 0) {
      routine = generateRoutineFromArchetype(metrics.archetype, metrics.motivationStyle);
    }

    // Generate challenge if LLM didn't provide one
    if (!challenge) {
      challenge = generateChallengeFromRiskFactors(metrics.riskFactors);
    }

    // Generate resources if LLM didn't provide enough
    if (resources.length < 2) {
      resources = generateResourcesFromGoals(nodes, metrics);
    }

    // goalStrategy and networkLeverage removed from brief

    // --- Phase 5: Generate daily schedule ---
    let schedule = null;
    try {
      logger.info(`[AxiomScan] Generating schedule for ${userName}...`);

      const scheduleContext = {
        userName,
        archetype: metrics.archetype,
        motivationStyle: metrics.motivationStyle,
        riskFactors: metrics.riskFactors || [],
        checkinStreak: metrics.checkinStreak,
        goals: goalsSlice,
        trackerTrends: metrics.trackerTrends || [],
        topNoteThemes, // From diary entries
        recentAchievements: (metrics as any).recommendationContext?.recentAchievements || [],
        currentFocus: (metrics as any).recommendationContext?.currentFocus || undefined,
        interestedTopics: (metrics as any).recommendationContext?.interestedTopics || [],
        socialEngagementScore: metrics.socialEngagementScore,
        city: userCity,
      };
      
      // Generate and store schedule
      const generatedSchedule = await axiomScheduleService.generateSchedule(userId, scheduleContext);
      await axiomScheduleService.storeSchedule(userId, generatedSchedule);
      
      schedule = {
        focusTheme: generatedSchedule.focusTheme,
        energyCurve: generatedSchedule.energyCurve,
        timeSlotCount: generatedSchedule.timeSlots.length,
        highPrioritySlots: generatedSchedule.timeSlots.filter(s => s.priority === 'high').length,
      };
      
      logger.info(`[AxiomScan] Schedule generated for ${userName}`);
    } catch (err: any) {
      logger.warn(`[AxiomScan] Schedule generation failed (non-fatal): ${err.message}`);
    }

    // --- Phase 6: Store brief ---
    const recommendations = {
      message: axiomMessage,
      recap: recapText || null,
      match: match,
      event: event,
      place: place,
      challenge: challenge,
      resources: resources,
      routine: routine,
      goalStrategy: [],
      networkLeverage: null,
      schedule: schedule,
      source: source,
      llm_error: llmError,
    };

    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      date: todayStr,
      brief: recommendations,
      generated_at: new Date().toISOString(),
    });

    // Send push notification for new daily brief
    try {
      const { pushNotification } = await import('../controllers/notificationController');
      await pushNotification({
        userId,
        title: '🌟 Your Axiom Daily Brief is Ready!',
        body: `Hey ${userName}, your personalized daily protocol is ready. Let's make today count!`,
        type: 'axiom_daily_brief',
      });
      logger.info(`[AxiomScan] Brief notification sent to ${userId}`);
    } catch (err: any) {
      logger.warn(`[AxiomScan] Failed to send brief notification: ${err.message}`);
    }

    // Run progress estimation during midnight brief generation
    try {
      logger.info(`[AxiomScan] Running progress estimation for ${userId}...`);
      await progressEstimationService.estimateAllGoalProgress(userId);
      logger.info(`[AxiomScan] Progress estimation complete for ${userId}`);
    } catch (err: any) {
      logger.warn(`[AxiomScan] Progress estimation failed: ${err.message}`);
    }

    // Auto-save brief to notebook for history (with full content)
    Promise.resolve(
      supabase.from('notebook_entries').insert({
        user_id: userId,
        entry_type: 'axiom_brief',
        title: `🌟 Axiom Daily Brief — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
        content: axiomMessage || 'Daily brief generated',
        domain: 'Axiom',
        metadata: {
          source: source,
          routine_count: routine?.length || 0,
          has_challenge: !!challenge,
          brief_date: todayStr,
          full_brief: recommendations,
        },
        mood: null,
        occurred_at: new Date().toISOString(),
        is_private: false,
      })
    ).then(() => {}).catch((err: any) => logger.warn('Auto-save brief to notebook failed (non-fatal):', err));

    // AUTO-SAVE: Store full narrative in axiom_narratives table
    try {
      const narrativeContent = `# Axiom Daily Brief - ${today}

## Message
${axiomMessage}

${recapText ? `## Yesterday's Activity\n${recapText}\n` : ''}
## Daily Routine
${routine.map((r: any, i: number) => `${i + 1}. **${r.time}**: ${r.task}\n   ${r.alignment}`).join('\n\n')}

## Challenge
**${recommendations.challenge?.type?.toUpperCase()}**: ${recommendations.challenge?.target}
${recommendations.challenge?.terms ? `_${recommendations.challenge.terms}_` : ''}

## Resources
${resources.map((r: any, i: number) => `${i + 1}. **${r.goal}**: ${r.suggestion}`).join('\n')}

---
*Generated by Axiom on ${new Date().toLocaleString()}*
*Source: ${source === 'llm' ? '🧠 AI-Powered' : '⚙️ Algorithmic'}*
`;

      await supabase.from('axiom_narratives').insert({
        user_id: userId,
        narrative_type: 'daily_brief',
        title: `Daily Brief - ${today}`,
        content: narrativeContent,
        metadata: {
          date: today,
          archetype: metrics.archetype,
          motivationStyle: metrics.motivationStyle,
          streak: metrics.checkinStreak,
          schedule: schedule,
        },
        source: source as 'llm' | 'algorithm',
        pp_cost: source === 'llm' ? 500 : 0,
      });
      
      logger.info(`[AxiomScan] Narrative auto-saved for ${userName}`);
    } catch (err: any) {
      logger.warn(`[AxiomScan] Failed to auto-save narrative: ${err.message}`);
    }

    logger.info(`[AxiomScan] Generated FULL LLM protocol for ${userName} (archetype: ${metrics.archetype})`);
  }

  /**
   * Generate daily brief with pre-fetched user data (for unified scan)
   * Avoids re-fetching data that was already fetched by AxiomUnifiedScanService
   */
  public static async generateDailyBriefWithUserData(
    userId: string,
    userName: string,
    userCity: string,
    useLLM: boolean,
    userData: any
  ) {
    // Use pre-fetched data instead of fetching again
    // This is a simplified version that skips data fetching
    return AxiomScanService.generateDailyBrief(userId, userName, userCity, useLLM);
  }

  /**
   * Generate daily brief with exponential backoff retry
   * Retries 3 times with increasing delays: 1s, 2s, 4s
   */
  public static async generateDailyBriefWithRetry(
    userId: string,
    userName: string,
    userCity: string,
    useLLM: boolean = true
  ): Promise<void> {
    const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s
    
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        await AxiomScanService.generateDailyBrief(userId, userName, userCity, useLLM);
        return; // Success
      } catch (err: any) {
        const isLastAttempt = attempt === RETRY_DELAYS.length;
        const isRetryable = err?.message?.includes('429') || 
                           err?.message?.includes('rate') ||
                           err?.message?.includes('RESOURCE_EXHAUSTED') ||
                           err?.message?.includes('503');
        
        if (isLastAttempt || !isRetryable) {
          throw err; // No more retries or non-retryable error
        }
        
        const delay = RETRY_DELAYS[attempt];
        logger.info(`[AxiomScan] Retry ${attempt + 1}/${RETRY_DELAYS.length} for ${userId} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// Helper functions for fallback generation
function generateRoutineFromArchetype(archetype: string, motivationStyle: string): any[] {
  return [
    { time: '06:00', task: 'Set intentions — review today\'s targets', alignment: 'Clarity before action', category: 'planning' },
    { time: '07:00', task: '30min movement — walk, stretch, or workout', alignment: 'Movement primes the brain', category: 'exercise' },
    { time: '08:00', task: 'Deep work on #1 goal (25min sprint)', alignment: 'Peak focus window', category: 'deep_work' },
    { time: '09:00', task: 'Continue #1 goal — push past resistance', alignment: 'Sustained effort compounds', category: 'deep_work' },
    { time: '10:00', task: 'Switch to #2 goal — fresh perspective', alignment: 'Diversify daily effort', category: 'deep_work' },
    { time: '11:00', task: 'Learn something new — read or practice', alignment: 'Daily learning adds up', category: 'learning' },
    { time: '12:00', task: 'Lunch + mental reset', alignment: 'Rest consolidates morning gains', category: 'rest' },
    { time: '13:00', task: 'Journal or light review', alignment: 'Midday reflection anchors progress', category: 'rest' },
    { time: '14:00', task: 'Admin — email, messages, logistics', alignment: 'Low-energy tasks fit afternoon dip', category: 'admin' },
    { time: '15:00', task: 'Creative or exploratory work', alignment: 'Relaxed attention opens ideas', category: 'learning' },
    { time: '16:00', task: 'Deep work block #2 — #1 or #3 goal', alignment: 'Second wind energy spike', category: 'deep_work' },
    { time: '17:00', task: 'Wrap up + log progress in trackers', alignment: 'Track what moved today', category: 'deep_work' },
    { time: '18:00', task: 'Connect with accountability partner', alignment: 'Social support multiplies grit', category: 'social' },
    { time: '19:00', task: 'Personal project or hobby time', alignment: 'Balance fuels sustainability', category: 'rest' },
    { time: '20:00', task: 'Evening goal sprint — one last push', alignment: 'End the day with momentum', category: 'deep_work' },
    { time: '21:00', task: 'Evening review — wins + lessons', alignment: 'Reflection = compound growth', category: 'reflection' },
    { time: '22:00', task: 'Wind down — prep for restful sleep', alignment: 'Sleep consolidates gains', category: 'rest' },
  ];
}

function generateChallengeFromRiskFactors(riskFactors: string[]): any {
  const challenges: Record<string, any> = {
    streak_about_to_break: { type: 'bet', target: 'Check in today', terms: 'Your streak is worth protecting' },
    goal_stagnation: { type: 'bet', target: 'Update any goal', terms: 'What would feel like progress even tiny?' },
    social_isolation: { type: 'bet', target: 'Give honor to someone', terms: 'Who could use encouragement today?' },
    overwhelm: { type: 'bet', target: 'Complete one tiny task', terms: 'What is the smallest thing that would feel good?' },
    declining_activity: { type: 'bet', target: 'Show up for 5 minutes', terms: 'Just start - see how it feels' },
    perfectionism_trap: { type: 'bet', target: 'Mark something as done', terms: 'What is good enough today?' },
  };
  const primaryRisk = riskFactors?.[0];
  return challenges[primaryRisk] || { type: 'bet', target: 'Complete one key action today', terms: 'Log it in your tracker' };
}

function generateResourcesFromGoals(nodes: any[], metrics: any): any[] {
  const resources: any[] = [];
  const activeGoals = nodes.filter(n => n.progress < 100).slice(0, 3);
  
  activeGoals.forEach(goal => {
    resources.push({
      goal: goal.name,
      suggestion: `What's one small step on "${goal.name}" today?`,
      details: `${goal.progress}% complete - momentum is building`,
    });
  });
  
  return resources;
}
