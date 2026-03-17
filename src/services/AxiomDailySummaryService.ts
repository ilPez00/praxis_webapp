/**
 * Axiom Daily Summary Service
 * Generates automatic daily summaries of user notebook activity
 * and posts them as diary entries
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
