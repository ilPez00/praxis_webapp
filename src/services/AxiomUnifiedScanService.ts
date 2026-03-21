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
import { AxiomProgressEstimationService } from './AxiomProgressEstimationService';
import { AxiomDailySummaryService } from './AxiomDailySummaryService';

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
}

export class AxiomUnifiedScanService {
  private aiCoaching: AICoachingService;
  private engagementMetrics: EngagementMetricService;
  private scheduleService: AxiomScheduleService;
  private progressService: AxiomProgressEstimationService;
  private summaryService: AxiomDailySummaryService;

  constructor() {
    this.aiCoaching = new AICoachingService();
    this.engagementMetrics = new EngagementMetricService();
    this.scheduleService = new AxiomScheduleService();
    this.progressService = new AxiomProgressEstimationService();
    this.summaryService = new AxiomDailySummaryService();
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

    // === PHASE 2: Generate daily brief (uses shared data) ===
    logger.info(`[AxiomUnifiedScan] Generating brief for ${userId}...`);
    await this.generateBrief(userId, userData);

    // === PHASE 3: Estimate progress (uses shared data) ===
    logger.info(`[AxiomUnifiedScan] Estimating progress for ${userId}...`);
    await this.estimateProgress(userId, userData);

    // === PHASE 4: Generate daily summary (uses shared data) ===
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
    ] = await Promise.all([
      // Profile
      supabase
        .from('profiles')
        .select('name, is_premium, praxis_points, is_admin, minimal_ai_mode')
        .eq('id', userId)
        .single(),
      // Metrics
      (async () => {
        let metrics = await this.engagementMetrics.getCachedMetrics(userId);
        if (!metrics) {
          metrics = await this.engagementMetrics.calculateMetrics(userId);
          await this.engagementMetrics.storeMetrics(userId, metrics);
        }
        return { data: metrics };
      })(),
      // Goal tree
      supabase
        .from('goal_trees')
        .select('nodes, root_nodes')
        .eq('user_id', userId)
        .maybeSingle(),
      // Recent check-ins (7 days)
      supabase
        .from('checkins')
        .select('checked_in_at, streak_day, mood, win_of_the_day')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })
        .limit(7),
      // Trackers
      supabase
        .from('trackers')
        .select('id, type, goal')
        .eq('user_id', userId),
      // Notebook entries (6 weeks)
      supabase
        .from('notebook_entries')
        .select('title, content, mood, occurred_at, goal_id, entry_type, source_table, source_id, domain')
        .eq('user_id', userId)
        .gte('occurred_at', sixWeeksAgoStr)
        .order('occurred_at', { ascending: false })
        .limit(100),
      // Diary entries
      supabase
        .from('diary_entries')
        .select('title, content, entry_type, mood, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      // Month check-ins
      supabase
        .from('checkins')
        .select('checked_in_at, streak_day, mood, win_of_the_day')
        .eq('user_id', userId)
        .gte('checked_in_at', oneMonthAgoStr)
        .order('checked_in_at', { ascending: false }),
      // Month trackers
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
      // Events
      supabase
        .from('events')
        .select('id, title, event_date, city, description')
        .gte('event_date', todayStr)
        .limit(10),
      // Places
      supabase
        .from('places')
        .select('id, name, city, tags, description')
        .limit(10),
      // Matches
      supabase
        .rpc('match_users_by_goals', { query_user_id: userId, match_limit: 5 }),
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
    };
  }

  /**
   * Generate daily brief using pre-fetched data
   */
  private async generateBrief(userId: string, userData: UserData): Promise<void> {
    // Import and call the static method from AxiomScanService
    const { AxiomScanService } = await import('./AxiomScanService');
    
    // Pass pre-fetched data to avoid re-fetching
    await AxiomScanService.generateDailyBriefWithUserData(
      userId,
      userData.profile.name || 'Student',
      'Unknown',
      true,
      userData
    );
  }

  /**
   * Estimate progress using pre-fetched data
   */
  private async estimateProgress(userId: string, userData: UserData): Promise<void> {
    // Use the progress service - TODO: implement withUserData method
    await this.progressService.estimateAllGoalProgress(userId);
  }

  /**
   * Generate daily summary using pre-fetched data
   */
  private async generateSummary(userId: string, userData: UserData): Promise<void> {
    // Use the summary service - TODO: implement withUserData method
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
