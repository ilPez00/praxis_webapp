/**
 * Axiom Unified Midnight Scan Service
 * Runs all daily Axiom operations in a single efficient scan:
 * - Daily brief generation
 * - Progress estimation
 * - Daily summary generation
 *
 * All operations share the same fetched data to minimize API calls
 * 
 * Load Balancing: Randomizes execution time to balance API load
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { AICoachingService } from './AICoachingService';
import { EngagementMetricService } from './EngagementMetricService';
import { AxiomScheduleService } from './AxiomScheduleService';
import { GoogleCalendarService } from './GoogleCalendarService';
import { AxiomProgressEstimationService } from './AxiomProgressEstimationService';
import { AxiomDailySummaryService } from './AxiomDailySummaryService';
import { AxiomPersonaService } from './AxiomPersonaService';

interface UserData {
  profile: any;
  metrics: any;
  goalTree: any;
  nodes: any[];
  checkins: any[];
  trackers: any[];
  notebookEntries: any[];
  diaryEntries: any[];
  monthCheckins: any[];
  monthTrackers: any[];
  events: any[];
  places: any[];
  matches: any[];
  googleEvents: any[];
}

export class AxiomUnifiedScanService {
  private aiCoaching: AICoachingService;
  private engagementMetrics: EngagementMetricService;
  private scheduleService: AxiomScheduleService;
  private googleCalendar: GoogleCalendarService;
  private progressService: AxiomProgressEstimationService;
  private summaryService: AxiomDailySummaryService;
  private personaService: AxiomPersonaService;

  constructor() {
    this.aiCoaching = new AICoachingService();
    this.engagementMetrics = new EngagementMetricService();
    this.scheduleService = new AxiomScheduleService();
    this.googleCalendar = new GoogleCalendarService();
    this.progressService = new AxiomProgressEstimationService();
    this.summaryService = new AxiomDailySummaryService();
    this.personaService = new AxiomPersonaService();
  }

  /**
   * Run all daily Axiom operations for all active users in a single scan
   * 
   * Load Balancing: Randomizes start time and adds per-user delays
   * to distribute API load across keys evenly
   */
  async runMidnightScan(): Promise<void> {
    try {
      logger.info('[AxiomUnifiedScan] Starting midnight scan...');
      const startTime = Date.now();

      // RANDOMIZATION: Add random delay (0-60 minutes) to avoid all users being processed at once
      // This spreads the API load more evenly across the night
      const randomDelayMs = Math.floor(Math.random() * 60 * 60 * 1000); // 0-60 minutes
      logger.info(`[AxiomUnifiedScan] Random delay: ${Math.round(randomDelayMs / 60000)} minutes`);
      await new Promise(resolve => setTimeout(resolve, randomDelayMs));

      // Get all active users (logged something in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString();

      const { data: activeUsers } = await supabase
        .from('notebook_entries')
        .select('user_id')
        .gte('occurred_at', sevenDaysAgoStr);

      if (!activeUsers || activeUsers.length === 0) {
        logger.info('[AxiomUnifiedScan] No active users to process');
        return;
      }

      const userIds = [...new Set(activeUsers.map(u => u.user_id))];
      logger.info(`[AxiomUnifiedScan] Processing ${userIds.length} users`);

      let successCount = 0;
      let failCount = 0;

      for (const userId of userIds) {
        try {
          await this.processUser(userId);
          successCount++;
          // RANDOMIZATION: Small random delay (200-800ms) between users to avoid rate limiting
          const userDelay = 200 + Math.floor(Math.random() * 600);
          await new Promise(resolve => setTimeout(resolve, userDelay));
        } catch (error: any) {
          logger.error(`[AxiomUnifiedScan] Failed for user ${userId}:`, error.message);
          failCount++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(
        `[AxiomUnifiedScan] Complete in ${duration}s: ${successCount} succeeded, ${failCount} failed`
      );
    } catch (error: any) {
      logger.error('[AxiomUnifiedScan] Fatal error:', error.message);
    }
  }

  /**
   * Process a single user - fetch data once, use for all operations
   */
  private async processUser(userId: string): Promise<void> {
    logger.info(`[AxiomUnifiedScan] Processing user ${userId}...`);

    // === PHASE 1: Fetch all user data ONCE ===
    const userData = await this.fetchUserData(userId);

    if (!userData) {
      logger.warn(`[AxiomUnifiedScan] No data for user ${userId}, skipping`);
      return;
    }

    // === PHASE 2: Compute behavioral persona (nightly fingerprint) ===
    logger.info(`[AxiomUnifiedScan] Computing persona for ${userId}...`);
    try {
      const persona = await this.personaService.computePersona(userId);
      await this.personaService.savePersona(persona);
    } catch (err: any) {
      logger.warn(`[AxiomUnifiedScan] Persona computation failed for ${userId}:`, err.message);
    }

    // === PHASE 3: Agentic actions — Axiom decides what to do ===
    logger.info(`[AxiomUnifiedScan] Agentic decision phase for ${userId}...`);
    await this.agenticActions(userId, userData);

    // === PHASE 4: Generate daily brief (uses shared data) ===
    logger.info(`[AxiomUnifiedScan] Generating brief for ${userId}...`);
    await this.generateBrief(userId, userData);

    // === PHASE 5: Estimate progress (uses shared data) ===
    logger.info(`[AxiomUnifiedScan] Estimating progress for ${userId}...`);
    await this.estimateProgress(userId, userData);

    // === PHASE 6: Generate daily summary (uses shared data) ===
    logger.info(`[AxiomUnifiedScan] Generating summary for ${userId}...`);
    await this.generateSummary(userId, userData);

    logger.info(`[AxiomUnifiedScan] Completed all operations for ${userId}`);
  }

  /**
   * Fetch all user data in a single batch
   */
  private async fetchUserData(userId: string): Promise<UserData | null> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const oneMonthAgoStr = oneMonthAgo.toISOString();
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const sixWeeksAgoStr = sixWeeksAgo.toISOString();

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch all data in parallel
    const [
      profileRes,
      metricsRes,
      goalTreeRes,
      checkinsRes,
      trackersRes,
      notebookEntriesRes,
      diaryEntriesRes,
      monthCheckinsRes,
      monthTrackersRes,
      eventsRes,
      placesRes,
      matchesRes,
      googleEvents,
    ] = await Promise.all([
      // ... (previous 12 items)
      supabase
        .from('profiles')
        .select('name, is_premium, praxis_points, is_admin, minimal_ai_mode')
        .eq('id', userId)
        .single(),
      (async () => {
        let metrics = await this.engagementMetrics.getCachedMetrics(userId);
        if (!metrics) {
          metrics = await this.engagementMetrics.calculateMetrics(userId);
          await this.engagementMetrics.storeMetrics(userId, metrics);
        }
        return { data: metrics };
      })(),
      supabase
        .from('goal_trees')
        .select('nodes, root_nodes')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('checkins')
        .select('checked_in_at, streak_day, mood, win_of_the_day')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })
        .limit(7),
      supabase
        .from('trackers')
        .select('id, type, goal')
        .eq('user_id', userId),
      supabase
        .from('notebook_entries')
        .select('title, content, mood, occurred_at, goal_id, entry_type, source_table, source_id, domain, attachments')
        .eq('user_id', userId)
        .gte('occurred_at', sixWeeksAgoStr)
        .order('occurred_at', { ascending: false })
        .limit(100),
      supabase
        .from('diary_entries')
        .select('title, content, entry_type, mood, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('checkins')
        .select('checked_in_at, streak_day, mood, win_of_the_day')
        .eq('user_id', userId)
        .gte('checked_in_at', oneMonthAgoStr)
        .order('checked_in_at', { ascending: false }),
      supabase
        .from('tracker_entries')
        .select('tracker_id, data, logged_at')
        .in(
          'tracker_id',
          ((await supabase.from('trackers').select('id').eq('user_id', userId)).data || []).map(
            (t: any) => t.id
          )
        )
        .gte('logged_at', oneMonthAgoStr)
        .order('logged_at', { ascending: false })
        .limit(200),
      supabase
        .from('events')
        .select('id, title, event_date, city, description')
        .gte('event_date', todayStr)
        .limit(10),
      supabase
        .from('places')
        .select('id, name, city, tags, description')
        .limit(10),
      supabase
        .rpc('match_users_by_goals', { query_user_id: userId, match_limit: 5 }),
      // Google Calendar events
      this.googleCalendar.getEvents(userId, startDate, endDate),
    ]);

    if (!profileRes.data) return null;

    const nodes = Array.isArray(goalTreeRes.data?.nodes) ? goalTreeRes.data.nodes : [];

    return {
      profile: profileRes.data,
      metrics: metricsRes.data,
      goalTree: goalTreeRes.data,
      nodes,
      checkins: checkinsRes.data || [],
      trackers: trackersRes.data || [],
      notebookEntries: notebookEntriesRes.data || [],
      diaryEntries: diaryEntriesRes.data || [],
      monthCheckins: monthCheckinsRes.data || [],
      monthTrackers: monthTrackersRes.data || [],
      events: eventsRes.data || [],
      places: placesRes.data || [],
      matches: matchesRes.data || [],
      googleEvents: Array.isArray(googleEvents) ? googleEvents : [],
    };
  }

  /**
   * Generate daily brief using pre-fetched data
   */
  private async generateBrief(userId: string, userData: UserData): Promise<void> {
    const { AxiomScanService } = await import('./AxiomScanService');
    
    await AxiomScanService.generateDailyBriefWithUserData(
      userId,
      userData.profile.name || 'Student',
      'Unknown',
      true,
      userData
    );
  }

  /**
   * Agentic Actions Phase — Axiom analyzes data and takes autonomous actions
   * Uses tool-calling + multimodal to process attachments
   */
  private async agenticActions(userId: string, userData: UserData): Promise<void> {
    try {
      // Import dynamically to avoid circular deps
      const { routeActions, getToolDeclarations } = await import('./AxiomActionRouter');
      const { axiomMultimodalService } = await import('./AxiomMultimodalService');

      const { nodes, notebookEntries, checkins, trackers } = userData;
      const recentEntries = notebookEntries.slice(0, 50);

      // Collect all attachments from recent entries
      const attachments = axiomMultimodalService.collectAttachmentsFromEntries(recentEntries);

      // Query NotebookLM if configured
      let notebookLMContext = '';
      try {
        const { axiomNotebookLMService } = await import('./AxiomNotebookLMService');
        const profileRes = await supabase.from('profiles').select('notebooklm_enabled, notebooklm_notebook_ids').eq('id', userId).single();
        if (profileRes.data?.notebooklm_enabled) {
          const notebookIds = profileRes.data.notebooklm_notebook_ids || [];
          const userContext = this.buildNotebookLMContext(userData);
          const { notebookInsights } = await axiomNotebookLMService.queryAllNotebooks(userId, userContext);
          if (notebookInsights) {
            notebookLMContext = notebookInsights;
            logger.info(`[AxiomUnifiedScan] NotebookLM: got insights from ${notebookIds.length} notebooks`);
          }
        }
      } catch (err: any) {
        logger.debug(`[AxiomUnifiedScan] NotebookLM skipped: ${err.message}`);
      }

      // Process attachments for all goals
      let totalParts = 0;
      let totalContexts = 0;
      const attachmentSummaryByGoal: Record<string, string> = {};

      for (const [goalId, goalAttachments] of attachments.entries()) {
        const { parts, textContexts } = await axiomMultimodalService.processAttachments(goalAttachments);
        totalParts += parts.length;
        totalContexts += textContexts.length;
        if (textContexts.length > 0) {
          attachmentSummaryByGoal[goalId] = axiomMultimodalService.buildAttachmentSummary(textContexts);
        }
      }

      logger.info(`[AxiomUnifiedScan] Processed ${totalParts} attachment parts, ${totalContexts} text contexts`);

      // Build agentic prompt
      const prompt = this.buildAgenticPrompt(userData, attachmentSummaryByGoal, notebookLMContext);

      // Get tool declarations
      const tools = getToolDeclarations();

      // Run agentic (with multimodal if attachments exist)
      let agenticResult: { text: string; toolCalls: any[] };

      if (totalParts > 0) {
        const { axiomMultimodalService: multimodal } = await import('./AxiomMultimodalService');
        // Collect all parts from all attachments
        const allParts: any[] = [];
        for (const [goalId, goalAttachments] of attachments.entries()) {
          const { parts } = await multimodal.processAttachments(goalAttachments);
          allParts.push(...parts);
        }

        agenticResult = await this.aiCoaching.runAgentic(prompt, tools);
        // For now, use text-only for tool-calling (attachments go to brief analysis)
        void allParts; // suppress unused warning
      } else {
        agenticResult = await this.aiCoaching.runAgentic(prompt, tools);
      }

      const { results: actionResults, skipped } = await routeActions(userId, agenticResult.toolCalls, 'midnight_scan');

      const successCount = actionResults.filter(r => r.success).length;
      logger.info(`[AxiomUnifiedScan] Agentic: ${successCount}/${actionResults.length} actions succeeded, ${skipped} skipped`);

      // Auto-log agentic summary to notebook
      if (successCount > 0) {
        const summary = `## Axiom Agentic Actions — ${new Date().toLocaleDateString()}

**Actions taken:** ${successCount}
${actionResults.filter(r => r.success).map((r, i) => {
  const action = agenticResult.toolCalls[i];
  return `- ${action?.tool}: ${r.result ? JSON.stringify(r.result).slice(0, 80) : 'OK'}`;
}).join('\n')}

*Generated autonomously by Axiom during midnight scan.*`;

        Promise.resolve(
          supabase.from('notebook_entries').insert({
            user_id: userId,
            entry_type: 'note',
            title: `Axiom Agentic Actions — ${new Date().toLocaleDateString()}`,
            content: summary,
            domain: 'Axiom',
            occurred_at: new Date().toISOString(),
            metadata: { created_by: 'axiom', scan_type: 'midnight_scan', action_count: successCount },
            is_private: false,
          })
        ).then(() => {}).catch((err: any) => logger.warn('Auto-log agentic summary failed:', err.message));
      }
    } catch (err: any) {
      logger.warn(`[AxiomUnifiedScan] Agentic phase failed for ${userId}: ${err.message}`);
      // Non-fatal — don't block the rest of the scan
    }
  }

  /**
   * Build context string for NotebookLM queries
   */
  private buildNotebookLMContext(userData: UserData): string {
    const { nodes, checkins, notebookEntries } = userData;
    const goalsSummary = nodes.slice(0, 5).map((n: any) =>
      `${n.name} (${n.domain}): ${Math.round((n.progress || 0) * 100)}%`
    ).join(', ');
    const recentMood = checkins.slice(0, 3).map(c => c.mood || '').filter(Boolean).join(' ');
    const recentNotes = notebookEntries.slice(0, 5).map(e => e.title || e.content?.slice(0, 50) || '').join('; ');

    return `Goals: ${goalsSummary || 'none'}. Recent mood: ${recentMood || 'unknown'}. Recent activity: ${recentNotes || 'none'}.`;
  }

  /**
   * Build the agentic thinking prompt for Axiom
   */
  private buildAgenticPrompt(userData: UserData, attachmentSummaryByGoal: Record<string, string>, notebookLMContext: string = ''): string {
    const { profile, nodes, checkins, trackers, notebookEntries } = userData;
    const userName = profile?.name || 'User';

    const goalsSummary = nodes.slice(0, 15).map((n: any) => {
      const progress = Math.round((n.progress || 0) * 100);
      const attachments = attachmentSummaryByGoal[n.id] || '';
      return {
        id: n.id,
        name: n.name,
        domain: n.domain,
        progress,
        attachments,
      };
    });

    const recentCheckins = checkins.slice(0, 5).map((c: any) =>
      `${c.checked_in_at?.slice(0, 10)}: ${c.mood || 'N/A'} | ${c.win_of_the_day?.slice(0, 60) || 'no win'}`
    ).join('\n');

    const trackerSummary = trackers.slice(0, 10).map((t: any) =>
      `- id=${t.id} type=${t.type} goal=${t.goal || t.goal_node_id || 'general'} unit=${t.unit || ''}`
    ).join('\n') || '(no trackers)';

    const recentNotesBlock = notebookEntries.slice(0, 15).map((e: any) => {
      const when = (e.occurred_at || e.created_at || '').slice(0, 10);
      const goal = e.goal_id ? ` goal=${e.goal_id}` : '';
      const dom = e.domain ? ` [${e.domain}]` : '';
      const body = (e.content || '').slice(0, 300).replace(/\n+/g, ' ');
      return `- ${when}${dom}${goal} id=${e.id}: ${body}`;
    }).join('\n') || '(no recent notes)';

    const goalsBlock = goalsSummary.map(g => {
      const progressBar = '█'.repeat(Math.round(g.progress / 10)) + '░'.repeat(10 - Math.round(g.progress / 10));
      const attachBlock = g.attachments ? `\n  Attachments:\n  ${g.attachments.split('\n').map((l: string) => '  ' + l).join('\n')}` : '';
      return `id=${g.id} [${g.domain}] ${g.name} — ${progressBar} ${g.progress}%${attachBlock}`;
    }).join('\n');

    return `You are Axiom. You analyze user data and take autonomous actions to help them achieve their goals.

## USER
${userName}

## GOALS (${nodes.length} total)
${goalsBlock || '(no goals)'}

## RECENT CHECK-INS (last 7 days)
${recentCheckins || '(no check-ins)'}

## TRACKERS (existing)
${trackerSummary}

## RECENT FREE NOTES (last 15)
${recentNotesBlock}
${notebookLMContext ? `\n## NOTEBOOKLM INSIGHTS\n${notebookLMContext}` : ''}

---

## THINKING PHASE
Based on the above data, decide what TOOLS to call. Consider:
- Create bet: user needs accountability on a goal, has PP available, < 3 active bets
- Create goal: user mentioned a new goal or needs a sub-goal
- Update goal progress: clear evidence of progress change
- Push notification: motivational nudge, especially for stagnant goals or streak at risk
- Create notebook entry: Axiom finds an insight worth documenting
- **Log tracker (IMPORTANT):** For EACH recent free note, check whether its content is inherent to an existing goal or existing tracker type (e.g. note "ran 5k at sunrise" → running tracker; "ate 180g protein" → nutrition tracker; "studied 2h spanish" → study tracker). If yes, call \`log_tracker\` with the matching tracker \`type\` and structured \`data\` extracted from the note text (numeric value, unit, reps, duration, mood, etc.). Match to existing trackers above when possible; only invent a new type if none fit and the note clearly warrants one. Skip notes that are pure reflection with no measurable signal.
- Suggest match: user needs an accountability partner

IMPORTANT CONSTRAINTS:
- Max 5 actions per scan
- Max 500 PP per bet, max 3 active bets
- Progress updates capped at ±25% per scan
- Max 2 notifications per day
- Trackers capped at 3 logs per day per tracker

## RESPONSE FORMAT
Think silently about what to do, then output your brief analysis, followed by any tool calls.

If taking actions, use this format for each:
{"tool": "TOOL_NAME", "params": {...}}

Example:
Your analysis suggests the user has been stagnant on their fitness goal. You should:
1. Create a bet to boost accountability
2. Send a motivational notification

{"tool": "create_bet", "params": {"goalName": "Run 5k", "deadline": "2026-04-25T20:00:00Z", "stakePoints": 100}}
{"tool": "push_notification", "params": {"title": "Run time!", "body": "You haven't logged a run in 3 days. Time to move!"}}

If no actions needed:
Your analysis: [brief summary of user's state]
No actions needed right now.`;
  }

  /**
   * Estimate progress - currently refetches data internally
   * TODO: Implement withUserData variant to use pre-fetched userData
   *       See: AxiomProgressEstimationService.estimateAllGoalProgress()
   */
  private async estimateProgress(userId: string, userData: UserData): Promise<void> {
    // Currently refetches: goalTree, notebookEntries, trackerEntries, checkins
    await this.progressService.estimateAllGoalProgress(userId);
  }

  /**
   * Generate daily summary - currently refetches data internally
   * TODO: Implement withUserData variant to use pre-fetched userData
   *       See: AxiomDailySummaryService.generateAndPostSummary()
   */
  private async generateSummary(userId: string, userData: UserData): Promise<void> {
    // Currently refetches: yesterday's notebook entries
    await this.summaryService.generateAndPostSummary(userId);
  }

  /**
   * Run scan for a single user (for on-demand regeneration)
   */
  async runSingleUserScan(userId: string): Promise<void> {
    try {
      logger.info(`[AxiomUnifiedScan] Running single-user scan for ${userId}...`);
      await this.processUser(userId);
      logger.info(`[AxiomUnifiedScan] Single-user scan complete for ${userId}`);
    } catch (error: any) {
      logger.error(`[AxiomUnifiedScan] Single-user scan failed for ${userId}:`, error.message);
    }
  }
}

export default AxiomUnifiedScanService;
