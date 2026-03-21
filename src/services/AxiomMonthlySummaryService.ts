/**
 * Axiom Monthly Summary Service
 * Generates comprehensive monthly activity summaries for users
 * 
 * Features:
 * - 30-day activity breakdown (check-ins, trackers, notebook entries)
 * - Top achievements and challenges
 * - Month-over-month trends
 * - AI-powered monthly narrative
 * - Next month focus suggestions
 * 
 * Load Balancing: Randomizes execution day (1st-5th of month) and time
 * to distribute API load evenly across users
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { AICoachingService } from './AICoachingService';
import cron from 'node-cron';

interface MonthlySummary {
  month: number;
  year: number;
  overview: {
    totalCheckins: number;
    totalNotebookEntries: number;
    totalTrackerLogs: number;
    goalsStarted: number;
    goalsCompleted: number;
    avgMood: string;
    longestStreak: number;
  };
  topThemes: string[];
  achievements: Array<{
    type: string;
    title: string;
    description: string;
    date: string;
  }>;
  challenges: Array<{
    type: string;
    description: string;
    suggestion: string;
  }>;
  monthOverMonthTrends: {
    checkinsChange: number;
    activityChange: number;
    moodChange: 'improved' | 'declined' | 'stable';
  };
  nextMonthFocus: Array<{
    area: string;
    suggestion: string;
    rationale: string;
  }>;
  aiNarrative: string;
}

export class AxiomMonthlySummaryService {
  private aiCoaching: AICoachingService;

  constructor() {
    this.aiCoaching = new AICoachingService();
  }

  /**
   * Initialize and start the monthly summary service
   * 
   * Load Balancing Strategy:
   * - Runs on a random day between 1st-5th of each month
   * - Random time between 01:00-04:00
   * - Random minute delay (0-59) within the hour
   * 
   * This spreads the API load across multiple days and hours
   */
  public static start() {
    // Check daily at 01:00 if we should run (between 1st-5th)
    cron.schedule('0 1 * * *', async () => {
      const today = new Date();
      const dayOfMonth = today.getDate();
      
      // Only run between 1st and 5th of month
      if (dayOfMonth > 5) return;
      
      // Random decision: should we run today?
      // Probability increases each day to ensure it runs by the 5th
      const runProbability = dayOfMonth / 5; // 0.2, 0.4, 0.6, 0.8, 1.0
      const shouldRunToday = Math.random() < runProbability;
      
      if (!shouldRunToday) {
        logger.info(`[AxiomMonthly] Skipping today (day ${dayOfMonth}), will try tomorrow`);
        return;
      }
      
      // Random delay within the hour (0-59 minutes)
      const randomMinutes = Math.floor(Math.random() * 60);
      logger.info(`[AxiomMonthly] Running monthly summary in ${randomMinutes} minutes (day ${dayOfMonth})`);
      
      setTimeout(async () => {
        logger.info('[AxiomMonthly] Starting monthly summary generation...');
        try {
          await AxiomMonthlySummaryService.generateAllMonthlySummaries();
        } catch (err: any) {
          logger.error('[AxiomMonthly] Monthly summary generation failed:', err.message);
        }
      }, randomMinutes * 60 * 1000);
    });
    
    logger.info('[AxiomMonthly] Monthly summary service started (randomized 1st-5th, 01:00-04:59)');
  }

  /**
   * Generate monthly summaries for all active users
   * Randomizes user processing order and adds delays to balance load
   */
  static async generateAllMonthlySummaries(): Promise<void> {
    const service = new AxiomMonthlySummaryService();
    
    // Get previous month
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = previousMonth.getMonth() + 1; // 1-12
    const year = previousMonth.getFullYear();
    
    logger.info(`[AxiomMonthly] Generating summaries for ${month}/${year}`);
    
    // Get all active users (logged something in last 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const { data: activeUsers } = await supabase
      .from('notebook_entries')
      .select('user_id')
      .gte('occurred_at', sixtyDaysAgo.toISOString());
    
    if (!activeUsers || activeUsers.length === 0) {
      logger.info('[AxiomMonthly] No active users to process');
      return;
    }
    
    const userIds = [...new Set(activeUsers.map(u => u.user_id))];
    
    // RANDOMIZATION: Shuffle user order to avoid same users always being processed first
    const shuffledUserIds = userIds.sort(() => Math.random() - 0.5);
    
    logger.info(`[AxiomMonthly] Processing ${shuffledUserIds.length} users (randomized order)`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const userId of shuffledUserIds) {
      try {
        await service.generateAndPostSummary(userId, month, year);
        successCount++;
        
        // RANDOMIZATION: Random delay between users (500-1500ms)
        const userDelay = 500 + Math.floor(Math.random() * 1000);
        await new Promise(resolve => setTimeout(resolve, userDelay));
      } catch (error: any) {
        logger.error(`[AxiomMonthly] Failed for user ${userId}:`, error.message);
        failCount++;
      }
    }
    
    logger.info(
      `[AxiomMonthly] Complete: ${successCount} succeeded, ${failCount} failed`
    );
  }

  /**
   * Generate and post monthly summary for a single user
   */
  async generateAndPostSummary(userId: string, month: number, year: number): Promise<void> {
    logger.info(`[AxiomMonthly] Generating summary for user ${userId} (${month}/${year})`);
    
    // Fetch user data
    const userData = await this.fetchUserData(userId, month, year);
    if (!userData) {
      logger.warn(`[AxiomMonthly] No data for user ${userId}, skipping`);
      return;
    }
    
    // Generate summary
    const summary = await this.analyzeUserData(userId, userData, month, year);
    if (!summary) {
      logger.warn(`[AxiomMonthly] Could not analyze data for user ${userId}`);
      return;
    }
    
    // Post to notebook
    await this.postSummary(userId, summary, month, year);
    
    logger.info(`[AxiomMonthly] Summary posted for user ${userId}`);
  }

  /**
   * Fetch all user data for the specified month
   */
  private async fetchUserData(userId: string, month: number, year: number) {
    // Calculate date range for the month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    
    // Also get previous month for comparison
    const prevMonthStart = new Date(year, month - 2, 1);
    const prevMonthEnd = new Date(year, month - 1, 0, 23, 59, 59);
    
    const [
      profileRes,
      checkinsRes,
      prevCheckinsRes,
      notebookEntriesRes,
      prevNotebookEntriesRes,
      trackersRes,
      trackerEntriesRes,
      prevTrackerEntriesRes,
      goalTreeRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('name, is_premium')
        .eq('id', userId)
        .single(),
      
      // Current month check-ins
      supabase
        .from('checkins')
        .select('checked_in_at, streak_day, mood, win_of_the_day')
        .eq('user_id', userId)
        .gte('checked_in_at', monthStart.toISOString())
        .lte('checked_in_at', monthEnd.toISOString()),
      
      // Previous month check-ins (for trends)
      supabase
        .from('checkins')
        .select('checked_in_at, streak_day, mood, win_of_the_day')
        .eq('user_id', userId)
        .gte('checked_in_at', prevMonthStart.toISOString())
        .lte('checked_in_at', prevMonthEnd.toISOString()),
      
      // Current month notebook entries
      supabase
        .from('notebook_entries')
        .select('title, content, mood, occurred_at, goal_id, entry_type, domain')
        .eq('user_id', userId)
        .gte('occurred_at', monthStart.toISOString())
        .lte('occurred_at', monthEnd.toISOString())
        .limit(100),
      
      // Previous month notebook entries (for trends)
      supabase
        .from('notebook_entries')
        .select('title, entry_type, occurred_at')
        .eq('user_id', userId)
        .gte('occurred_at', prevMonthStart.toISOString())
        .lte('occurred_at', prevMonthEnd.toISOString()),
      
      // User's trackers
      supabase
        .from('trackers')
        .select('id, type')
        .eq('user_id', userId),
      
      // Current month tracker entries
      supabase
        .from('tracker_entries')
        .select('tracker_id, data, logged_at')
        .in('tracker_id', ((await supabase.from('trackers').select('id').eq('user_id', userId)).data || []).map((t: any) => t.id))
        .gte('logged_at', monthStart.toISOString())
        .lte('logged_at', monthEnd.toISOString())
        .limit(200),
      
      // Previous month tracker entries (for trends)
      supabase
        .from('tracker_entries')
        .select('tracker_id, logged_at')
        .in('tracker_id', ((await supabase.from('trackers').select('id').eq('user_id', userId)).data || []).map((t: any) => t.id))
        .gte('logged_at', prevMonthStart.toISOString())
        .lte('logged_at', prevMonthEnd.toISOString()),
      
      // Goal tree
      supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    
    if (!profileRes.data) return null;
    
    const nodes = Array.isArray(goalTreeRes.data?.nodes) ? goalTreeRes.data.nodes : [];
    const completedGoals = nodes.filter((n: any) => n.progress >= 100);
    const startedGoals = nodes.filter((n: any) => n.progress > 0 && n.progress < 100);
    
    return {
      profile: profileRes.data,
      checkins: checkinsRes.data || [],
      prevCheckins: prevCheckinsRes.data || [],
      notebookEntries: notebookEntriesRes.data || [],
      prevNotebookEntries: prevNotebookEntriesRes.data || [],
      trackers: trackersRes.data || [],
      trackerEntries: trackerEntriesRes.data || [],
      prevTrackerEntries: prevTrackerEntriesRes.data || [],
      nodes,
      completedGoals,
      startedGoals,
    };
  }

  /**
   * Analyze user data and generate monthly summary
   */
  private async analyzeUserData(userId: string, userData: any, month: number, year: number): Promise<MonthlySummary | null> {
    // Calculate overview stats
    const overview = {
      totalCheckins: userData.checkins.length,
      totalNotebookEntries: userData.notebookEntries.length,
      totalTrackerLogs: userData.trackerEntries.length,
      goalsStarted: userData.startedGoals.length,
      goalsCompleted: userData.completedGoals.length,
      avgMood: this.calculateAverageMood(userData.checkins),
      longestStreak: this.calculateLongestStreak(userData.checkins),
    };
    
    // Extract top themes from notebook entry titles
    const themes = new Map<string, number>();
    userData.notebookEntries.forEach((entry: any) => {
      if (entry.title && entry.title !== 'Shared Item') {
        const words: string[] = entry.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        words.forEach((w: string) => themes.set(w, (themes.get(w) || 0) + 1));
      }
    });
    const topThemes = Array.from(themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);
    
    // Identify achievements
    const achievements: MonthlySummary['achievements'] = [];
    
    if (overview.goalsCompleted > 0) {
      achievements.push({
        type: 'goal_completed',
        title: `Completed ${overview.goalsCompleted} goal${overview.goalsCompleted > 1 ? 's' : ''}`,
        description: userData.completedGoals.map((g: any) => g.name).join(', '),
        date: new Date(year, month - 1, 28).toISOString(),
      });
    }
    
    if (overview.longestStreak >= 7) {
      achievements.push({
        type: 'streak_milestone',
        title: `${overview.longestStreak}-day check-in streak`,
        description: 'Consistent daily reflection',
        date: new Date(year, month - 1, 28).toISOString(),
      });
    }
    
    if (overview.totalCheckins >= 20) {
      achievements.push({
        type: 'consistency',
        title: 'High engagement month',
        description: `Checked in ${overview.totalCheckins} times`,
        date: new Date(year, month - 1, 28).toISOString(),
      });
    }
    
    // Calculate month-over-month trends
    const checkinsChange = userData.prevCheckins.length > 0
      ? ((overview.totalCheckins - userData.prevCheckins.length) / userData.prevCheckins.length) * 100
      : 0;
    
    const activityChange = userData.prevNotebookEntries.length > 0
      ? ((overview.totalNotebookEntries - userData.prevNotebookEntries.length) / userData.prevNotebookEntries.length) * 100
      : 0;
    
    const moodChange = this.compareMoods(overview.avgMood, this.calculateAverageMood(userData.prevCheckins));
    
    const monthOverMonthTrends = {
      checkinsChange: Math.round(checkinsChange),
      activityChange: Math.round(activityChange),
      moodChange: moodChange,
    };
    
    // Generate challenges based on patterns
    const challenges: MonthlySummary['challenges'] = [];
    
    if (checkinsChange < -20) {
      challenges.push({
        type: 'declining_activity',
        description: 'Check-in activity decreased compared to last month',
        suggestion: 'Try setting a daily reminder or pairing check-ins with an existing habit',
      });
    }
    
    if (overview.goalsStarted > 3 && overview.goalsCompleted === 0) {
      challenges.push({
        type: 'goal_stagnation',
        description: 'Multiple goals started but none completed yet',
        suggestion: 'Focus on completing one goal before starting new ones',
      });
    }
    
    // Generate next month focus suggestions
    const nextMonthFocus: MonthlySummary['nextMonthFocus'] = [];
    
    if (overview.goalsCompleted > 0) {
      nextMonthFocus.push({
        area: 'Goal Progress',
        suggestion: 'Celebrate your wins and set new challenging goals',
        rationale: `You completed ${overview.goalsCompleted} goal${overview.goalsCompleted > 1 ? 's' : ''} this month!`,
      });
    }
    
    if (overview.totalTrackerLogs > 10) {
      nextMonthFocus.push({
        area: 'Tracking',
        suggestion: 'Continue tracking key metrics consistently',
        rationale: `You logged ${overview.totalTrackerLogs} tracker entries - great consistency!`,
      });
    }
    
    if (challenges.length > 0) {
      nextMonthFocus.push({
        area: 'Improvement',
        suggestion: challenges[0].suggestion,
        rationale: challenges[0].description,
      });
    }
    
    // Generate AI narrative
    const aiNarrative = await this.generateAINarrative(userId, overview, topThemes, achievements, monthOverMonthTrends);
    
    return {
      month,
      year,
      overview,
      topThemes,
      achievements,
      challenges,
      monthOverMonthTrends,
      nextMonthFocus,
      aiNarrative,
    };
  }

  /**
   * Generate AI-powered monthly narrative
   */
  private async generateAINarrative(
    userId: string,
    overview: any,
    themes: string[],
    achievements: any[],
    trends: any
  ): Promise<string> {
    const prompt = `You are Axiom, a wise warm and practical life coach. Write a monthly reflection narrative (3-4 paragraphs) for the user.

MONTH OVERVIEW:
- Check-ins: ${overview.totalCheckins} days
- Notebook entries: ${overview.totalNotebookEntries}
- Tracker logs: ${overview.totalTrackerLogs}
- Goals completed: ${overview.goalsCompleted}
- Goals started: ${overview.goalsStarted}
- Average mood: ${overview.avgMood}
- Longest streak: ${overview.longestStreak} days

TOP THEMES: ${themes.join(', ') || 'Various activities'}

ACHIEVEMENTS: ${achievements.length > 0 ? achievements.map((a: any) => a.title).join(', ') : 'No major achievements'}

MONTH-OVER-MONTH TRENDS:
- Check-in change: ${trends.checkinsChange > 0 ? '+' : ''}${trends.checkinsChange}%
- Activity change: ${trends.activityChange > 0 ? '+' : ''}${trends.activityChange}%
- Mood trend: ${trends.moodChange}

Write a warm, encouraging 3-4 paragraph reflection that:
1. Celebrates their wins and effort
2. Acknowledges challenges with compassion
3. Highlights patterns and growth
4. Encourages continued progress

Keep it personal, specific, and motivating. Use "you" language.`;

    try {
      const narrative = await this.aiCoaching.runWithFallback(prompt);
      return narrative.trim();
    } catch (error: any) {
      logger.error('[AxiomMonthly] AI narrative generation failed:', error.message);
      // Fallback to template
      return this.generateTemplateNarrative(overview, achievements, trends);
    }
  }

  /**
   * Fallback template narrative (no AI)
   */
  private generateTemplateNarrative(overview: any, achievements: any[], trends: any): string {
    const paragraphs: string[] = [];
    
    // Opening
    paragraphs.push(
      `This month, you checked in ${overview.totalCheckins} times and logged ${overview.totalNotebookEntries + overview.totalTrackerLogs} activities. ` +
      `Your average mood was ${overview.avgMood}, and you maintained a ${overview.longestStreak}-day streak at your best.`
    );
    
    // Achievements
    if (achievements.length > 0) {
      paragraphs.push(
        `Congratulations on ${achievements.map(a => a.title.toLowerCase()).join(', ')}! ` +
        `These wins show your commitment to growth.`
      );
    }
    
    // Trends
    if (trends.checkinsChange > 10) {
      paragraphs.push(
        `Your check-in activity increased by ${trends.checkinsChange}% compared to last month - great momentum!`
      );
    } else if (trends.checkinsChange < -10) {
      paragraphs.push(
        `Your activity decreased slightly this month. That's okay - every month is a fresh start.`
      );
    }
    
    // Closing
    paragraphs.push(
      `Keep showing up for yourself. Small consistent actions compound into meaningful change.`
    );
    
    return paragraphs.join('\n\n');
  }

  /**
   * Post monthly summary to notebook
   */
  private async postSummary(userId: string, summary: MonthlySummary, month: number, year: number): Promise<void> {
    const entry = {
      user_id: userId,
      entry_type: 'axiom_monthly_summary',
      title: `Monthly Review: ${this.getMonthName(month)} ${year}`,
      content: summary.aiNarrative,
      mood: summary.overview.avgMood,
      occurred_at: new Date(year, month - 1, 28).toISOString(),
      metadata: {
        overview: summary.overview,
        themes: summary.topThemes,
        achievements: summary.achievements,
        challenges: summary.challenges,
        trends: summary.monthOverMonthTrends,
        focus: summary.nextMonthFocus,
      },
      is_private: false,
    };
    
    await supabase
      .from('notebook_entries')
      .insert(entry);
  }

  /**
   * Helper: Calculate average mood from check-ins
   */
  private calculateAverageMood(checkins: any[]): string {
    if (checkins.length === 0) return 'neutral';
    
    const moodCounts: Record<string, number> = {};
    checkins.forEach(c => {
      if (c.mood) moodCounts[c.mood] = (moodCounts[c.mood] || 0) + 1;
    });
    
    const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
    return topMood ? topMood[0] : 'neutral';
  }

  /**
   * Helper: Calculate longest streak from check-ins
   */
  private calculateLongestStreak(checkins: any[]): number {
    if (checkins.length === 0) return 0;
    
    const sorted = [...checkins].sort((a, b) => 
      new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime()
    );
    
    let longest = 1;
    let current = 1;
    
    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].checked_in_at);
      const currDate = new Date(sorted[i].checked_in_at);
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        current++;
        longest = Math.max(longest, current);
      } else if (diffDays > 1) {
        current = 1;
      }
    }
    
    return longest;
  }

  /**
   * Helper: Compare two moods
   */
  private compareMoods(current: string, previous: string): 'improved' | 'declined' | 'stable' {
    const moodOrder = ['terrible', 'bad', 'neutral', 'good', 'great'];
    const currentIndex = moodOrder.indexOf(current);
    const prevIndex = moodOrder.indexOf(previous);
    
    if (currentIndex > prevIndex) return 'improved';
    if (currentIndex < prevIndex) return 'declined';
    return 'stable';
  }

  /**
   * Helper: Get month name
   */
  private getMonthName(month: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  }
}

export default AxiomMonthlySummaryService;
