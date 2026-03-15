import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

/**
 * EngagementMetricService - Analyzes user behavior patterns for Axiom recommendations.
 * 
 * Data sources:
 * ✅ READS: Trackers, notes, public posts, goal names/domains, check-in timestamps
 * ❌ DOES NOT READ: Private messages, DMs, journal entries with sensitive content
 * 
 * This provides personalized recommendations while respecting privacy for sensitive data.
 */

export interface EngagementMetrics {
  // Activity patterns
  checkinStreak: number;
  checkinConsistency: number;        // 0-100: variance in daily checkin times
  weeklyActivityScore: number;       // 0-100: composite activity score
  sessionFrequency: number;          // sessions per week
  
  // Goal patterns
  totalGoals: number;
  activeGoals: number;
  completedGoalsThisWeek: number;
  avgGoalProgress: number;
  goalUpdateFrequency: number;       // updates per week
  stagnationRisk: number;            // 0-100: likelihood of giving up
  topGoalDomains: string[];          // domains of active goals (for recommendations)
  
  // Tracker patterns (READS tracker entries)
  activeTrackers: number;
  trackerEntriesThisWeek: number;
  trackerConsistency: number;        // 0-100: how regularly they log
  trackerTrends: TrackerTrend[];     // positive/negative trends from data
  
  // Notes patterns (READS notes for themes)
  notesCount: number;
  notesThisWeek: number;
  topNoteThemes: string[];           // extracted from note titles/frequency
  
  // Social patterns
  networkSize: number;
  interactionsThisWeek: number;
  responseRate: number;              // 0-100: how often they respond to others
  socialEngagementScore: number;     // 0-100: composite social score
  publicPostsThisWeek: number;       // READS public posts for interests
  
  // Temporal patterns
  mostActiveDay: string;             // e.g., "Monday"
  mostActiveHour: number;            // 0-23
  typicalSessionDuration: number;    // minutes
  
  // Behavioral archetypes (calculated from patterns)
  archetype: EngagementArchetype;
  motivationStyle: MotivationStyle;
  riskFactors: RiskFactor[];
  
  // Recommendation context (from content analysis)
  recommendationContext: {
    interestedTopics: string[];      // from notes, posts, goal domains
    recentAchievements: string[];    // from completed goals
    currentFocus: string | null;     // most-updated goal this week
  };
}

export type EngagementArchetype = 
  | 'consolidator'      // Few goals, high completion
  | 'explorer'         // Many goals, low completion
  | 'achiever'         // High activity, high completion
  | 'struggler'        // Low activity, low completion
  | 'socializer'       // High social, moderate goals
  | 'lone_wolf'        // Low social, high goals
  | 'burnout_risk';    // High activity, declining

export type TrackerTrend = {
  trackerName: string;
  direction: 'improving' | 'declining' | 'stable';
  currentValue: number | null;
  weekOverWeekChange: number;
};

export type MotivationStyle = 
  | 'streak_driven'    // Responds to streak messaging
  | 'progress_focused' // Responds to progress bars
  | 'social_accountable' // Responds to social pressure
  | 'novelty_seeking'  // Needs variety
  | 'routine_based';   // Needs consistency

export type RiskFactor = 
  | 'streak_about_to_break'
  | 'goal_stagnation'
  | 'social_isolation'
  | 'overwhelm'
  | 'declining_activity'
  | 'perfectionism_trap';

export class EngagementMetricService {
  
  /**
   * Calculate all engagement metrics for a user.
   * READS: Trackers, notes, public posts, goal data
   * DOES NOT READ: Private messages, DMs, sensitive journal entries
   */
  public async calculateMetrics(userId: string): Promise<EngagementMetrics> {
    const [
      checkinData,
      goalData,
      socialData,
      sessionData,
      trackerData,
      notesData,
      postsData,
    ] = await Promise.all([
      this.fetchCheckinData(userId),
      this.fetchGoalData(userId),
      this.fetchSocialData(userId),
      this.fetchSessionData(userId),
      this.fetchTrackerData(userId),
      this.fetchNotesData(userId),
      this.fetchPostsData(userId),
    ]);

    const checkinStreak = checkinData.streak;
    const checkinConsistency = this.calculateCheckinConsistency(checkinData.history);
    const weeklyActivityScore = this.calculateWeeklyActivityScore(checkinData, sessionData);
    const sessionFrequency = sessionData.sessionsThisWeek / 7;

    const totalGoals = goalData.totalGoals;
    const activeGoals = goalData.activeGoals;
    const completedGoalsThisWeek = goalData.completedThisWeek;
    const avgGoalProgress = goalData.avgProgress;
    const goalUpdateFrequency = goalData.updatesThisWeek / 7;
    const stagnationRisk = this.calculateStagnationRisk(goalData);
    const topGoalDomains = goalData.topGoalDomains || [];

    const activeTrackers = trackerData.activeTrackers;
    const trackerEntriesThisWeek = trackerData.trackerEntriesThisWeek;
    const trackerConsistency = trackerData.trackerConsistency;
    const trackerTrends = trackerData.trackerTrends;

    const notesCount = notesData.notesCount;
    const notesThisWeek = notesData.notesThisWeek;
    const topNoteThemes = notesData.topNoteThemes;

    const networkSize = socialData.networkSize;
    const interactionsThisWeek = socialData.interactionsThisWeek;
    const responseRate = socialData.responseRate;
    const socialEngagementScore = this.calculateSocialEngagementScore(socialData);
    const publicPostsThisWeek = postsData.publicPostsThisWeek;

    const mostActiveDay = this.findMostActiveDay(sessionData);
    const mostActiveHour = this.findMostActiveHour(sessionData);
    const typicalSessionDuration = sessionData.avgDurationMinutes;

    // Build recommendation context from content
    const interestedTopics = [
      ...topGoalDomains,
      ...topNoteThemes,
    ].filter(Boolean).slice(0, 10);

    const recentAchievements = goalData.goals
      ?.filter((g: any) => g.completed)
      .slice(0, 3)
      .map((g: any) => g.name || g.title) || [];

    // Calculate archetypes and styles
    const archetype = this.determineArchetype({
      activeGoals,
      completedGoalsThisWeek,
      weeklyActivityScore,
      socialEngagementScore,
      stagnationRisk,
    });

    const motivationStyle = this.determineMotivationStyle({
      checkinStreak,
      checkinConsistency,
      avgGoalProgress,
      socialEngagementScore,
    });

    const riskFactors = this.identifyRiskFactors({
      checkinStreak,
      checkinConsistency,
      stagnationRisk,
      socialEngagementScore,
      weeklyActivityScore,
      goalData,
      trackerTrends,
    });

    return {
      checkinStreak,
      checkinConsistency,
      weeklyActivityScore,
      sessionFrequency,
      totalGoals,
      activeGoals,
      completedGoalsThisWeek,
      avgGoalProgress,
      goalUpdateFrequency,
      stagnationRisk,
      topGoalDomains,
      activeTrackers,
      trackerEntriesThisWeek,
      trackerConsistency,
      trackerTrends,
      notesCount,
      notesThisWeek,
      topNoteThemes,
      networkSize,
      interactionsThisWeek,
      responseRate,
      socialEngagementScore,
      publicPostsThisWeek,
      mostActiveDay,
      mostActiveHour,
      typicalSessionDuration,
      archetype,
      motivationStyle,
      riskFactors,
      recommendationContext: {
        interestedTopics,
        recentAchievements,
        currentFocus: goalData.currentFocus,
      },
    };
  }

  /**
   * Store metrics for later retrieval (cached for 24h)
   */
  public async storeMetrics(userId: string, metrics: EngagementMetrics): Promise<void> {
    try {
      await supabase.from('engagement_metrics').upsert({
        user_id: userId,
        metrics,
        calculated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, {
        onConflict: 'user_id',
      });
    } catch (error) {
      logger.error('[EngagementMetrics] Failed to store:', error);
    }
  }

  /**
   * Get cached metrics (if not expired)
   */
  public async getCachedMetrics(userId: string): Promise<EngagementMetrics | null> {
    try {
      const { data } = await supabase
        .from('engagement_metrics')
        .select('metrics, expires_at')
        .eq('user_id', userId)
        .single();

      if (!data) return null;
      
      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        return null; // Expired
      }

      return data.metrics as EngagementMetrics;
    } catch {
      return null;
    }
  }

  // ============ Private Methods ============

  private async fetchCheckinData(userId: string) {
    // Get streak and checkin history (timestamps only, no content)
    const { data: userData } = await supabase
      .from('users')
      .select('streak, last_checkin')
      .eq('id', userId)
      .single();

    const { data: checkins } = await supabase
      .from('checkins')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    return {
      streak: userData?.streak || 0,
      lastCheckin: userData?.last_checkin,
      history: checkins?.map(c => new Date(c.created_at)) || [],
    };
  }

  private async fetchGoalData(userId: string) {
    // Get goal metadata (names, domains, progress - not journal entries)
    const { data: goals } = await supabase
      .from('goal_trees')
      .select('nodes')
      .eq('user_id', userId)
      .maybeSingle();

    const nodes: any[] = goals?.nodes ?? [];
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Extract root goals
    const rootGoals = nodes.filter((n: any) => !n.parentId);
    const totalGoals = rootGoals.length;
    const activeGoals = rootGoals.filter(g => !g.completed && g.progress < 1).length;
    const completedThisWeek = rootGoals.filter(g => 
      g.completed && g.updatedAt && new Date(g.updatedAt) > weekAgo
    ).length;
    const avgProgress = rootGoals.length 
      ? rootGoals.reduce((sum, g) => sum + (g.progress || 0) * 100, 0) / rootGoals.length 
      : 0;
    
    // Get domains for recommendations
    const topGoalDomains = rootGoals
      .filter(g => !g.completed)
      .map(g => g.domain)
      .filter(Boolean)
      .slice(0, 5);
    
    // Find most-updated goal this week (current focus)
    const updatedThisWeek = nodes.filter((n: any) => 
      n.updatedAt && new Date(n.updatedAt) > weekAgo
    );
    const mostUpdated = updatedThisWeek.length > 0 
      ? updatedThisWeek.reduce((a, b) => 
          (a.updateCount || 0) > (b.updateCount || 0) ? a : b
        )
      : null;

    return {
      totalGoals,
      activeGoals,
      completedThisWeek,
      avgProgress,
      updatesThisWeek: updatedThisWeek.length,
      topGoalDomains,
      currentFocus: mostUpdated?.name || mostUpdated?.title || null,
      goals: rootGoals,
    };
  }

  private async fetchSocialData(userId: string) {
    // Get social interaction counts (no message content)
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .or(`user_id.eq.${userId},matched_user_id.eq.${userId}`);

    const { data: interactions } = await supabase
      .from('honor')
      .select('created_at')
      .or(`giver_id.eq.${userId},receiver_id.eq.${userId}`)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const { count: givenHonor } = await supabase
      .from('honor')
      .select('*', { count: 'exact', head: true })
      .eq('giver_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const { count: receivedHonor } = await supabase
      .from('honor')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    return {
      networkSize: matches?.length || 0,
      interactionsThisWeek: interactions?.length || 0,
      givenHonor: givenHonor || 0,
      receivedHonor: receivedHonor || 0,
      responseRate: 50, // Placeholder - would need more data
    };
  }

  private async fetchTrackerData(userId: string) {
    // READS tracker data for trends and patterns
    const { data: trackers } = await supabase
      .from('trackers')
      .select('id, name, type')
      .eq('user_id', userId);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const activeTrackers = trackers?.length || 0;
    const trackerIds = trackers?.map(t => t.id) || [];

    // Get entries this week
    const { data: entriesThisWeek } = await supabase
      .from('tracker_entries')
      .select('tracker_id, value, created_at')
      .in('tracker_id', trackerIds)
      .gte('created_at', weekAgo.toISOString());

    const entriesCount = entriesThisWeek?.length || 0;

    // Calculate consistency (entries per active tracker)
    const consistency = activeTrackers > 0 
      ? Math.min(100, Math.round((entriesCount / activeTrackers) * 20)) 
      : 0;

    // Calculate trends per tracker
    const trends: TrackerTrend[] = [];
    for (const tracker of trackers || []) {
      // This week's entries
      const weekEntries = entriesThisWeek?.filter(e => e.tracker_id === tracker.id) || [];
      const thisWeekAvg = weekEntries.length > 0
        ? weekEntries.reduce((sum, e) => sum + (Number(e.value) || 0), 0) / weekEntries.length
        : null;

      // Last week's entries
      const { data: lastWeekEntries } = await supabase
        .from('tracker_entries')
        .select('value')
        .eq('tracker_id', tracker.id)
        .gte('created_at', twoWeeksAgo.toISOString())
        .lt('created_at', weekAgo.toISOString());

      const lastWeekAvg = lastWeekEntries && lastWeekEntries.length > 0
        ? lastWeekEntries.reduce((sum, e) => sum + (Number(e.value) || 0), 0) / lastWeekEntries.length
        : null;

      const change = thisWeekAvg && lastWeekAvg 
        ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 
        : 0;

      trends.push({
        trackerName: tracker.name || 'Unnamed Tracker',
        direction: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
        currentValue: thisWeekAvg,
        weekOverWeekChange: Math.round(change),
      });
    }

    return {
      activeTrackers,
      trackerEntriesThisWeek: entriesCount,
      trackerConsistency: consistency,
      trackerTrends: trends,
    };
  }

  private async fetchNotesData(userId: string) {
    // READS notes titles for themes (not sensitive content)
    const { data: notes } = await supabase
      .from('notes')
      .select('title, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const notesCount = notes?.length || 0;
    const notesThisWeek = notes?.filter(n => 
      n.created_at && new Date(n.created_at) > weekAgo
    ).length || 0;

    // Extract themes from note titles (simple keyword extraction)
    const titleKeywords = new Map<string, number>();
    const commonWords = ['the', 'a', 'an', 'my', 'to', 'for', 'of', 'in', 'on', 'and', 'or'];
    
    for (const note of notes || []) {
      const words = (note.title || '').toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 3 && !commonWords.includes(word)) {
          titleKeywords.set(word, (titleKeywords.get(word) || 0) + 1);
        }
      }
    }

    const topNoteThemes = Array.from(titleKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return {
      notesCount,
      notesThisWeek,
      topNoteThemes,
    };
  }

  private async fetchPostsData(userId: string) {
    // READS public posts for interests
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_public', true)
      .gte('created_at', weekAgo.toISOString());

    return {
      publicPostsThisWeek: count || 0,
    };
  }

  private async fetchSessionData(userId: string) {
    // Get session timestamps from auth logins (if available) or approximate from checkins
    const { data: sessions } = await supabase
      .from('checkins')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sessionsThisWeek = sessions?.filter(s => 
      new Date(s.created_at) > weekAgo
    ).length || 0;

    // Approximate session duration (would need actual session tracking for precision)
    const avgDurationMinutes = 5; // Default assumption

    return {
      sessions: sessions?.map(s => new Date(s.created_at)) || [],
      sessionsThisWeek,
      avgDurationMinutes,
    };
  }

  private calculateCheckinConsistency(history: Date[]): number {
    if (history.length < 7) return 50; // Not enough data

    // Calculate variance in checkin times (lower variance = higher consistency)
    const times = history.map(d => d.getHours() * 60 + d.getMinutes());
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    // Convert to 0-100 score (lower stdDev = higher consistency)
    // Assume 2 hours (120 min) stdDev = 50 score
    const consistency = Math.max(0, Math.min(100, 100 - (stdDev / 120) * 100));
    return Math.round(consistency);
  }

  private calculateWeeklyActivityScore(checkinData: any, sessionData: any): number {
    const checkinsThisWeek = checkinData.history.filter(
      d => d > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    const idealCheckins = 7; // Daily ideal
    const checkinScore = Math.min(100, (checkinsThisWeek / idealCheckins) * 100);

    const sessionScore = Math.min(100, (sessionData.sessionsThisWeek / 5) * 100); // 5 sessions/week ideal

    return Math.round((checkinScore * 0.7) + (sessionScore * 0.3));
  }

  private calculateStagnationRisk(goalData: any): number {
    const { activeGoals, updatesThisWeek, avgProgress, completedThisWeek } = goalData;

    if (activeGoals === 0) return 20; // No goals = low risk (maybe on break)

    // High risk: many active goals, few updates, low progress
    const updateRate = updatesThisWeek / activeGoals;
    const progressScore = avgProgress;
    const completionRate = completedThisWeek / Math.max(1, activeGoals);

    let risk = 0;
    risk += updateRate < 0.5 ? 30 : 0;      // Less than 1 update per 2 weeks per goal
    risk += progressScore < 30 ? 25 : 0;    // Low average progress
    risk += completionRate < 0.1 ? 25 : 0;  // No completions
    risk += activeGoals > 10 ? 20 : 0;      // Too many goals

    return Math.min(100, risk);
  }

  private calculateSocialEngagementScore(socialData: any): number {
    const { networkSize, interactionsThisWeek, givenHonor, receivedHonor } = socialData;

    if (networkSize === 0) return 30; // No network = baseline

    const interactionRate = interactionsThisWeek / Math.max(1, networkSize);
    const honorRatio = givenHonor / Math.max(1, receivedHonor);

    let score = 50;
    score += Math.min(30, interactionRate * 10);
    score += honorRatio > 0.5 && honorRatio < 2 ? 20 : 0; // Balanced giving/receiving

    return Math.min(100, Math.round(score));
  }

  private findMostActiveDay(sessionData: any): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    sessionData.sessions.forEach((s: Date) => counts[s.getDay()]++);
    
    const maxIdx = counts.indexOf(Math.max(...counts));
    return days[maxIdx] || 'Monday';
  }

  private findMostActiveHour(sessionData: any): number {
    const counts = new Array(24).fill(0);

    sessionData.sessions.forEach((s: Date) => counts[s.getHours()]++);
    
    const maxIdx = counts.indexOf(Math.max(...counts));
    return maxIdx >= 0 ? maxIdx : 9; // Default to 9am
  }

  private determineArchetype(metrics: {
    activeGoals: number;
    completedGoalsThisWeek: number;
    weeklyActivityScore: number;
    socialEngagementScore: number;
    stagnationRisk: number;
  }): EngagementArchetype {
    const { activeGoals, completedGoalsThisWeek, weeklyActivityScore, socialEngagementScore, stagnationRisk } = metrics;

    // Check burnout first
    if (weeklyActivityScore > 80 && stagnationRisk > 60) {
      return 'burnout_risk';
    }

    // High completion rate
    const completionRate = completedGoalsThisWeek / Math.max(1, activeGoals);
    
    if (completionRate > 0.5 && weeklyActivityScore > 60) {
      return socialEngagementScore > 60 ? 'achiever' : 'lone_wolf';
    }

    // Low activity
    if (weeklyActivityScore < 30) {
      return socialEngagementScore > 50 ? 'socializer' : 'struggler';
    }

    // Many goals, low completion
    if (activeGoals > 7 && completionRate < 0.2) {
      return 'explorer';
    }

    // Few goals, high completion
    if (activeGoals <= 3 && completionRate > 0.3) {
      return 'consolidator';
    }

    return 'explorer'; // Default
  }

  private determineMotivationStyle(metrics: {
    checkinStreak: number;
    checkinConsistency: number;
    avgGoalProgress: number;
    socialEngagementScore: number;
  }): MotivationStyle {
    const { checkinStreak, checkinConsistency, avgGoalProgress, socialEngagementScore } = metrics;

    if (checkinStreak > 14 && checkinConsistency > 70) {
      return 'streak_driven';
    }

    if (avgGoalProgress > 50) {
      return 'progress_focused';
    }

    if (socialEngagementScore > 60) {
      return 'social_accountable';
    }

    if (checkinConsistency > 60) {
      return 'routine_based';
    }

    return 'novelty_seeking';
  }

  private identifyRiskFactors(metrics: {
    checkinStreak: number;
    checkinConsistency: number;
    stagnationRisk: number;
    socialEngagementScore: number;
    weeklyActivityScore: number;
    goalData: any;
  }): RiskFactor[] {
    const risks: RiskFactor[] = [];

    const { checkinStreak, stagnationRisk, socialEngagementScore, weeklyActivityScore, goalData } = metrics;

    // Streak about to break (checked in last 2 days but streak is old)
    if (checkinStreak > 7 && stagnationRisk > 50) {
      risks.push('streak_about_to_break');
    }

    // Goal stagnation
    if (stagnationRisk > 60) {
      risks.push('goal_stagnation');
    }

    // Social isolation
    if (socialEngagementScore < 30) {
      risks.push('social_isolation');
    }

    // Overwhelm (too many active goals)
    if (goalData.activeGoals > 10 && goalData.avgProgress < 30) {
      risks.push('overwhelm');
    }

    // Declining activity
    if (weeklyActivityScore < 40 && goalData.updatesThisWeek < 2) {
      risks.push('declining_activity');
    }

    // Perfectionism trap (all goals at 90%+ but not completing)
    const nearComplete = goalData.goals?.filter((g: any) => g.progress >= 90 && !g.completed).length || 0;
    if (nearComplete >= 3) {
      risks.push('perfectionism_trap');
    }

    return risks;
  }
}
