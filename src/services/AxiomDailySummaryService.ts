/**
 * AxiomDailySummaryService - Automatic daily summary generation
 * 
 * Generates automatic daily summaries of user notebook activity
 * and posts them as diary entries.
 * 
 * Responsibilities:
 * - Analyzes user's notebook entries from the previous day
 * - Extracts statistics (entry counts by type, top themes, mood)
 * - Identifies achievements and challenges
 * - Generates AI-powered narrative summary using AICoachingService
 * - Posts summary as a diary entry (entry_type: 'axiom_daily_summary')
 * - Provides fallback algorithmic summary if AI fails
 * 
 * Features:
 * - Analyzes ALL entry types (notes, trackers, goal progress, achievements)
 * - Extracts themes from titles and content
 * - Identifies patterns (high activity, consistency, emotional tone)
 * - Generates personalized insights and tomorrow focus suggestions
 * - Stores summary with full metadata for future reference
 * 
 * Usage:
 * - Called automatically during midnight AxiomScan
 * - Can be triggered manually for individual users
 * - Supports batch generation for all active users
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { AICoachingService } from './AICoachingService';

interface DailySummary {
  date: string;
  totalEntries: number;
  byType: Record<string, number>;
  topThemes: string[];
  mood: string;
  achievements: string[];
  challenges: string[];
  insights: string[];
  tomorrowFocus: string[];
}

export class AxiomDailySummaryService {
  /**
   * Generate and post daily summary for a user
   * 
   * Process:
   * 1. Fetch yesterday's notebook entries
   * 2. Analyze entries (stats, themes, mood, achievements, challenges)
   * 3. Generate AI-powered narrative
   * 4. Post as diary entry (axiom_daily_summary type)
   * 
   * @param userId - The user's unique identifier
   * @returns Promise<void>
   * 
   * @remarks
   * - Skips if user has no entries from yesterday
   * - Uses AICoachingService for narrative generation
   * - Falls back to algorithmic summary if AI fails
   * - Logs errors but doesn't throw to avoid breaking cron
   */
  async generateAndPostSummary(userId: string): Promise<void> {
    try {
      logger.info(`[AxiomDailySummary] Generating summary for user ${userId}`);

      // Fetch yesterday's notebook entries
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);

      const { data: entries } = await supabase
        .from('notebook_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('occurred_at', `${yesterdayStr}T00:00:00`)
        .lt('occurred_at', `${todayStr}T00:00:00`)
        .order('occurred_at', { ascending: true });

      if (!entries || entries.length === 0) {
        logger.info(`[AxiomDailySummary] No entries for user ${userId} yesterday`);
        return;
      }

      // Analyze entries
      const summary = await this.analyzeEntries(userId, entries, yesterdayStr);

      // Generate AI-powered narrative
      const narrative = await this.generateNarrative(userId, entries, summary);

      // Post as diary entry
      await this.postSummary(userId, summary, narrative);

      logger.info(`[AxiomDailySummary] Successfully posted summary for user ${userId}`);
    } catch (error: any) {
      logger.error(`[AxiomDailySummary] Error for user ${userId}:`, error.message);
    }
  }

  /**
   * Analyze notebook entries to extract statistics and themes
   * 
   * Analyzes entries to extract:
   * - Activity breakdown by type (notes, trackers, goals, etc.)
   * - Top themes from titles and content (word frequency analysis)
   * - Overall mood (most frequent mood value)
   * - Achievements (completed goals, high progress markers)
   * - Challenges (struggles, low mood entries)
   * - Insights (patterns like high activity, consistency, goal focus)
   * - Tomorrow focus suggestions based on patterns
   * 
   * @param userId - The user's unique identifier
   * @param entries - Array of notebook entries to analyze
   * @param date - The date string (YYYY-MM-DD format)
   * @returns DailySummary object with all extracted statistics and insights
   */
  private async analyzeEntries(userId: string, entries: any[], date: string): Promise<DailySummary> {
    // Count by type
    const byType: Record<string, number> = {};
    entries.forEach(e => {
      byType[e.entry_type] = (byType[e.entry_type] || 0) + 1;
    });

    // Extract themes from titles/content
    const themes: Map<string, number> = new Map();
    entries.forEach(e => {
      if (e.title && e.title !== 'Shared Item') {
        const words = e.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        words.forEach((w: string) => {
          themes.set(w, (themes.get(w) || 0) + 1);
        });
      }
      if (e.content) {
        const contentWords = e.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4);
        contentWords.slice(0, 10).forEach((w: string) => {
          themes.set(w, (themes.get(w) || 0) + 1);
        });
      }
    });

    const topThemes = Array.from(themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme]) => theme);

    // Extract mood (if available)
    const moods = entries.filter(e => e.mood).map(e => e.mood);
    const mood = moods.length > 0
      ? moods.sort((a, b) => moods.filter(m => m === a).length - moods.filter(m => m === b).length).pop()
      : 'neutral';

    // Identify achievements (completed goals, high progress)
    const achievements = entries
      .filter(e => e.content?.includes('100%') || e.content?.includes('completed') || e.title?.includes('Achievement'))
      .slice(0, 3)
      .map(e => e.title || e.content?.slice(0, 50));

    // Identify challenges (struggles, low mood)
    const challenges = entries
      .filter(e => e.mood === '😔' || e.content?.toLowerCase().includes('hard') || e.content?.toLowerCase().includes('difficult'))
      .slice(0, 3)
      .map(e => e.title || e.content?.slice(0, 50));

    // Generate insights based on patterns
    const insights: string[] = [];
    if (byType['note'] > 5) insights.push('High reflection activity');
    if (byType['tracker'] > 10) insights.push('Consistent tracking');
    if (entries.filter(e => e.goal_id).length > entries.length / 2) insights.push('Goal-focused day');
    if (mood === '😊' || mood === '🔥') insights.push('Positive emotional tone');

    // Tomorrow focus suggestions
    const tomorrowFocus: string[] = [];
    const goalEntries = entries.filter(e => e.goal_id);
    if (goalEntries.length > 0) {
      tomorrowFocus.push('Continue momentum on active goals');
    }
    if (challenges.length > 0) {
      tomorrowFocus.push('Address identified challenges');
    }
    if (byType['tracker'] < 3) {
      tomorrowFocus.push('Increase tracking consistency');
    }

    return {
      date,
      totalEntries: entries.length,
      byType,
      topThemes,
      mood,
      achievements,
      challenges,
      insights,
      tomorrowFocus,
    };
  }

  /**
   * Generate AI-powered narrative summary
   * 
   * Uses AICoachingService to create a warm, conversational narrative that:
   * - Acknowledges the user's day
   * - Highlights 1-2 key achievements
   * - Gently acknowledges challenges (without criticism)
   * - Points out patterns and themes
   * - Ends with encouragement for tomorrow
   * 
   * @param userId - The user's unique identifier
   * @param entries - Raw notebook entries for context
   * @param summary - Pre-analyzed summary data
   * @returns AI-generated narrative string (max 200 words)
   * 
   * @remarks
   * - Falls back to generateFallbackSummary if AI fails
   * - Uses AICoachingService.runWithFallback for reliability
   */
  private async generateNarrative(userId: string, entries: any[], summary: DailySummary): Promise<string> {
    try {
      const aiCoaching = new AICoachingService();

      // Get user name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', userId)
        .single();

      const userName = profile?.name || 'Praxis Member';

      // Build context for AI
      const context = {
        userName,
        date: summary.date,
        totalEntries: summary.totalEntries,
        byType: summary.byType,
        topThemes: summary.topThemes,
        mood: summary.mood,
        achievements: summary.achievements,
        challenges: summary.challenges,
        insights: summary.insights,
        entries: entries.slice(0, 10).map((e: any) => ({
          title: e.title,
          content: e.content?.slice(0, 100),
          type: e.entry_type,
          mood: e.mood,
        })),
      };

      const prompt = `You are Axiom, a wise and warm AI coach. Write a compassionate daily summary (3-4 paragraphs) for ${userName} based on their notebook activity on ${summary.date}.

CONTEXT:
- Total entries: ${summary.totalEntries}
- Activity breakdown: ${JSON.stringify(summary.byType)}
- Top themes: ${summary.topThemes.join(', ')}
- Overall mood: ${summary.mood}
- Achievements: ${summary.achievements.join(', ')}
- Challenges: ${summary.challenges.join(', ')}
- Insights: ${summary.insights.join(', ')}

RECENT ENTRIES:
${JSON.stringify(context.entries, null, 2)}

GUIDELINES:
1. Start with a warm acknowledgment of their day
2. Highlight 1-2 key achievements or wins
3. Gently acknowledge any challenges (don't criticize)
4. Point out patterns or themes you noticed
5. End with encouragement for tomorrow
6. Keep it conversational, warm, and specific (reference actual entries)
7. Maximum 200 words

Write the summary:`;

      const response = await aiCoaching.runWithFallback(prompt);
      return response.trim();
    } catch (error: any) {
      logger.error('[AxiomDailySummary] AI narrative generation failed:', error.message);
      return this.generateFallbackSummary(summary);
    }
  }

  /**
   * Fallback summary if AI fails
   * 
   * Generates a simple algorithmic summary with:
   * - Total entry count
   * - Key themes
   * - Top 2 achievements
   * - First insight
   * - First tomorrow focus suggestion
   * 
   * @param summary - Pre-analyzed summary data
   * @returns Formatted text summary (plain text with emoji)
   */
  private generateFallbackSummary(summary: DailySummary): string {
    const parts: string[] = [];

    parts.push(`📊 Daily Summary for ${summary.date}`);
    parts.push(``);
    parts.push(`You logged ${summary.totalEntries} entries today across ${Object.keys(summary.byType).length} different activities.`);
    parts.push(``);

    if (summary.topThemes.length > 0) {
      parts.push(`Key themes: ${summary.topThemes.join(', ')}`);
    }

    if (summary.achievements.length > 0) {
      parts.push(``);
      parts.push(`🏆 Wins: ${summary.achievements.slice(0, 2).join(' | ')}`);
    }

    if (summary.insights.length > 0) {
      parts.push(``);
      parts.push(`💡 ${summary.insights[0]}`);
    }

    if (summary.tomorrowFocus.length > 0) {
      parts.push(``);
      parts.push(`🎯 Tomorrow: ${summary.tomorrowFocus[0]}`);
    }

    return parts.join('\n');
  }

  /**
   * Post summary as a diary/notebook entry
   * 
   * Stores the generated summary in notebook_entries table with:
   * - entry_type: 'axiom_daily_summary'
   * - title: Formatted with date and emoji
   * - content: AI-generated or fallback narrative
   * - metadata: Full summary data + generation info
   * - is_private: true (only visible to user)
   * 
   * @param userId - The user's unique identifier
   * @param summary - Summary data to store
   * @param narrative - AI-generated or fallback narrative text
   * @returns Promise<void>
   * 
   * @remarks
   * - Checks for existing summary to avoid duplicates
   * - Skips insert if summary already exists for the date
   */
  private async postSummary(userId: string, summary: DailySummary, narrative: string): Promise<void> {
    const { data: existingSummary } = await supabase
      .from('notebook_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('entry_type', 'axiom_daily_summary')
      .eq('DATE(occurred_at)', summary.date)
      .single();

    if (existingSummary) {
      logger.info(`[AxiomDailySummary] Summary already exists for user ${userId} on ${summary.date}`);
      return;
    }

    const { error } = await supabase
      .from('notebook_entries')
      .insert({
        user_id: userId,
        entry_type: 'axiom_daily_summary',
        title: `🌙 Daily Summary: ${new Date(summary.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
        content: narrative,
        occurred_at: `${summary.date}T23:59:59`,
        is_private: true,
        metadata: {
          summary_data: summary,
          generated_by: 'axiom_auto_summary',
          generated_at: new Date().toISOString(),
        },
      });

    if (error) {
      logger.error(`[AxiomDailySummary] Failed to post summary for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate summaries for all active users
   * 
   * Batch operation that:
   * 1. Finds all users who logged entries yesterday
   * 2. Generates summaries for each user sequentially
   * 3. Adds 1-second delay between users to avoid rate limiting
   * 
   * @returns Promise<void>
   * 
   * @remarks
   * - Used by cron job during midnight scan
   * - Processes users sequentially to respect API rate limits
   * - Logs overall progress and completion status
   */
  async generateAllSummaries(): Promise<void> {
    try {
      // Get all users who logged something yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);

      const { data: activeUsers } = await supabase
        .from('notebook_entries')
        .select('user_id')
        .gte('occurred_at', `${yesterdayStr}T00:00:00`)
        .lt('occurred_at', `${todayStr}T00:00:00`);

      if (!activeUsers || activeUsers.length === 0) {
        logger.info('[AxiomDailySummary] No active users to summarize');
        return;
      }

      const userIds = [...new Set(activeUsers.map(u => u.user_id))];
      logger.info(`[AxiomDailySummary] Generating summaries for ${userIds.length} users`);

      for (const userId of userIds) {
        await this.generateAndPostSummary(userId);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info(`[AxiomDailySummary] Completed generating ${userIds.length} summaries`);
    } catch (error: any) {
      logger.error('[AxiomDailySummary] Error generating all summaries:', error.message);
    }
  }
}

export default AxiomDailySummaryService;
