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

    // Process up to 5 concurrently (increased for better throughput)
    const CONCURRENCY = 5;
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < activeUsers.length; i += CONCURRENCY) {
      const batch = activeUsers.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(async user => {
        try {
          // ALWAYS use LLM for all users now
          await this.generateDailyBrief(user.id, user.name || 'Student', user.city || 'Unknown', true);
          successCount++;
        } catch (err: any) {
          logger.warn(`[AxiomScan] Failed for ${user.name || user.id}: ${err.message}`);
          failCount++;
        }
      }));
      
      // Small pause between batches to respect RPM limits
      if (i + CONCURRENCY < activeUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    logger.info(`[AxiomScan] Scan complete: ${successCount} succeeded, ${failCount} failed.`);
  }

  /**
   * Generate daily brief for a user using FULL LLM-POWERED PROTOCOL.
   * ALWAYS uses LLM for detailed message, routine, match, event, place recommendations.
   * @param useLLM - Always true (deprecated parameter kept for compatibility)
   */
  public static async generateDailyBrief(userId: string, userName: string, userCity: string, useLLM: boolean = true) {
    const today = new Date().toISOString().slice(0, 10);

    // --- Phase 1: Calculate engagement metrics ---
    let metrics = await engagementMetricService.getCachedMetrics(userId);

    if (!metrics) {
      metrics = await engagementMetricService.calculateMetrics(userId);
      await engagementMetricService.storeMetrics(userId, metrics);
    }

    // --- Phase 2: Fetch all data for LLM context ---
    const [goalTreeRes, checkinsRes, trackersRes, notesRes, matchesRes, eventsRes, placesRes] = await Promise.all([
      supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
      supabase.from('checkins').select('checked_in_at,streak_day,mood,win_of_the_day').eq('user_id', userId).order('checked_in_at', { ascending: false }).limit(7),
      supabase.from('trackers').select('id,type,goal').eq('user_id', userId),
      supabase.from('journal_entries').select('note,mood,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 5 }),
      supabase.from('events').select('id, title, event_date, city, description').gte('event_date', today).limit(10),
      supabase.from('places').select('id, name, city, tags, description').limit(10),
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
    try {
      const trackerIds = (trackersRes.data || []).map((t: any) => t.id);
      const typeMap = Object.fromEntries((trackersRes.data || []).map((t: any) => [t.id, t.type]));

      const [trackerEntries, journalEntries, checkinEntries] = await Promise.all([
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
      ]);

      const recapItems = [...trackerEntries, ...journalEntries, ...checkinEntries];
      if (recapItems.length > 0) {
        recapText = `Yesterday you logged ${recapItems.length} activities: ${recapItems.slice(0, 6).join('. ')}.`;
      }
    } catch (err) {
      logger.warn('[AxiomScan] Recap generation failed (non-fatal):', err);
    }

    // --- Phase 3: Generate FULL LLM-powered protocol ---
    const aiCoaching = new AICoachingService();

    const goalsSlice = nodes.slice(0, 5).map((n: any) => ({
      name: n.name, domain: n.domain,
      progress: Math.round((n.progress || 0) * 100) + '%', weight: n.weight,
    }));

    // Generate LLM-powered full protocol
    let axiomMessage = '';
    let routine: any[] = [];
    let challenge: any = null;
    let resources: any[] = [];
    let source: 'llm' | 'algorithm' = 'algorithm';
    let llmError: string | null = null;

    logger.info(`[AxiomScan] Starting LLM generation for ${userName} (streak: ${metrics.checkinStreak}, archetype: ${metrics.archetype})`);

    try {
      const prompt = `You are Axiom, a wise warm and practical life coach inside the Praxis app. Generate a COMPLETE daily protocol for ${userName}.

CONTEXT:
- Streak: ${metrics.checkinStreak} days
- Motivation style: ${metrics.motivationStyle}
- Risk factors: ${metrics.riskFactors?.join(', ') || 'None'}
- Goals: ${JSON.stringify(goalsSlice)}
- Recent check-ins: ${JSON.stringify((checkinsRes.data || []).slice(0, 3).map((c: any) => ({ mood: c.mood, win: c.win_of_the_day, streak: c.streak_day })))}
- Tracker trends: ${metrics.trackerTrends?.map((t: any) => `${t.trackerName}: ${t.direction}`).join(', ') || 'None'}
${recapText ? `- Yesterday's activity: ${recapText}` : '- Yesterday: No activity logged'}

Respond ONLY with valid JSON (no markdown, no backticks) matching this exact shape:
{
  "message": "Warm personalized greeting (2-3 sentences) acknowledging their specific journey, recent wins, and current challenges. Reference their streak if > 0, mention a specific goal by name, and acknowledge something from their recent activity.",
  
  "routine": [
    {
      "time": "Morning (First 2 Hours)",
      "task": "Highly specific first action tied to their #1 goal or biggest opportunity. Include exact duration, what to prepare, and why this specific timing matters for them.",
      "alignment": "Connect this task to their motivation style and long-term vision. Explain WHY this specific morning routine compounds for their situation.",
      "duration": "Specific time like '15 min' or '30 min'",
      "preparation": "What to set up the night before or have ready"
    },
    {
      "time": "Afternoon (Deep Work Block)",
      "task": "Specific action on their most neglected or highest-leverage goal. Reference the goal by name and give exact next step (not vague advice).",
      "alignment": "Explain how this afternoon block addresses their specific risk factors. Why THIS action for THIS person today.",
      "duration": "Specific time like '25 min' or '50 min'",
      "preparation": "What to close/eliminate to protect this block"
    },
    {
      "time": "Evening (Reflection & Reset)",
      "task": "Specific reflection or preparation ritual. Tie to their check-in streak, journal themes, or goal progress tracking.",
      "alignment": "Explain how this evening practice reinforces their identity and sets up tomorrow's success. Connect to their motivation style.",
      "duration": "Specific time like '10 min' or '20 min'",
      "preparation": "What to have ready or review"
    }
  ],
  
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
  ]
}

RULES:
1. **Radical Personalization**: Every sentence must reference something specific about THIS user - their goals by name, their streak, their recent activity. No generic advice.

2. **Routine Specificity**: Each routine task must include:
   - Exact duration (15 min, 25 min, etc.)
   - Specific preparation step
   - Connection to their actual goals (by name)
   - Why this timing matters for THEIR situation

3. **Challenge Design**: The challenge should:
   - Directly address their #1 risk factor
   - Feel slightly uncomfortable but achievable
   - Have a clear deadline (today only)
   - Connect to their deeper values and identity

4. **Resource Insights**: Show you see THEIR data:
   - Reference current progress % on goals
   - Mention recent tracker activity or lack thereof
   - Acknowledge patterns (streaks, gaps, themes)
   - Give advice that compounds for their specific situation

5. **TONE**: Warm, encouraging, curious — NEVER critical. Focus on what's working. Ask about struggles, don't point them out. Speak as a wise mentor who knows them deeply.

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
    // Pick best match
    let match = null;
    if (matchesRes.data?.[0]) {
      match = {
        id: matchesRes.data[0].id,
        name: matchesRes.data[0].name,
        reason: 'Aligned goals in your active domains',
      };
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

    // --- Phase 5: Store brief ---
    const recommendations = {
      message: axiomMessage,
      recap: recapText || null,
      match: match,
      event: event,
      place: place,
      challenge: challenge,
      resources: resources,
      routine: routine,
      source: source,
      llm_error: llmError,
    };

    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      date: today,
      brief: recommendations,
      generated_at: new Date().toISOString(),
    });

    logger.info(`[AxiomScan] Generated FULL LLM protocol for ${userName} (archetype: ${metrics.archetype})`);
  }
}

// Helper functions for fallback generation
function generateRoutineFromArchetype(archetype: string, motivationStyle: string): any[] {
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
    default: [
      { time: 'Morning', task: 'Set one clear intention', alignment: 'Start with purpose' },
      { time: 'Afternoon', task: 'Take one small action', alignment: 'Progress compounds' },
      { time: 'Evening', task: 'Acknowledge one win', alignment: 'Celebrate showing up' },
    ],
  };
  return routines[motivationStyle] || routines.default;
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
