/**
 * Axiom Goal Progress Estimation Service
 * Automatically estimates and updates goal progress based on user activity
 * using AI analysis of notebook entries, tracker logs, and check-ins
 * 
 * Enhanced Features:
 * - Extract explicit progress percentages from notes (e.g., "50% done")
 * - Detect completion language and auto-complete goals
 * - Maintain private Axiom summary (admin-only visibility)
 * - Avoid re-reading same material across multiple scans
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { AICoachingService } from './AICoachingService';
import { axiomMultimodalService } from './AxiomMultimodalService';

interface ProgressEstimate {
  goalId: string;
  goalName: string;
  currentProgress: number;
  suggestedProgress: number;
  confidence: number;
  reasoning: string;
  evidence: string[];
}

export class AxiomProgressEstimationService {
  /**
   * Analyze all user goals and estimate progress based on activity
   */
  async estimateAllGoalProgress(userId: string): Promise<void> {
    try {
      logger.info(`[AxiomProgress] Estimating progress for user ${userId}`);

      // Fetch user's goal tree
      const { data: goalTree } = await supabase
        .from('goal_trees')
        .select('nodes, root_nodes')
        .eq('user_id', userId)
        .single();

      if (!goalTree?.nodes) {
        logger.info(`[AxiomProgress] No goals found for user ${userId}`);
        return;
      }

      const nodes = Array.isArray(goalTree.nodes) ? goalTree.nodes : [];
      
      // Fetch recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString();

      const [notebookEntries, trackerEntries, checkins] = await Promise.all([
        supabase
          .from('notebook_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('occurred_at', sevenDaysAgoStr),
        supabase
          .from('tracker_entries')
          .select('tracker_id, data, logged_at')
          .in('tracker_id', ((await supabase.from('trackers').select('id').eq('user_id', userId)).data || []).map((t: any) => t.id))
          .gte('logged_at', sevenDaysAgoStr),
        supabase
          .from('checkins')
          .select('checked_in_at, mood, win_of_the_day')
          .eq('user_id', userId)
          .gte('checked_in_at', sevenDaysAgoStr),
      ]);

      // Analyze each goal
      const updates: any[] = [];
      
      for (const node of nodes) {
        const estimate = await this.estimateGoalProgress(
          node,
          notebookEntries.data || [],
          trackerEntries.data || [],
          checkins.data || []
        );

        // Only update if significant change suggested (>5% difference)
        const currentProgress = Math.round((node.progress || 0) * 100);
        if (Math.abs(estimate.suggestedProgress - currentProgress) > 5) {
          updates.push({
            goalId: node.id,
            oldProgress: currentProgress,
            newProgress: estimate.suggestedProgress,
            reasoning: estimate.reasoning,
          });

          // Update the goal tree
          await this.updateGoalProgress(userId, node.id, estimate.suggestedProgress / 100, estimate.reasoning);
        }
      }

      if (updates.length > 0) {
        logger.info(`[AxiomProgress] Updated ${updates.length} goals for user ${userId}`);

        // Send notification about progress updates
        await this.sendProgressNotification(userId, updates);

        // NEW: Auto-log progress updates to notebook
        await this.autoLogProgressToNotebook(userId, updates);
        
        // NEW: Log daily progress summary
        await this.logDailyProgressSummary(userId, updates);
      } else {
        logger.info(`[AxiomProgress] No significant progress changes for user ${userId}`);
      }

      // NEW: Generate private Axiom summary (prevents re-reading same material)
      await this.generateAxiomSummary(userId, notebookEntries.data || []);

      logger.info(`[AxiomProgress] Completed progress estimation for user ${userId}`);
    } catch (error: any) {
      logger.error(`[AxiomProgress] Error for user ${userId}:`, error.message);
    }
  }

  /**
   * Estimate progress for a single goal using AI analysis
   */
  private async estimateGoalProgress(
    node: any,
    notebookEntries: any[],
    trackerEntries: any[],
    checkins: any[]
  ): Promise<ProgressEstimate> {
    const goalId = node.id;
    const goalName = node.name;
    const currentProgress = Math.round((node.progress || 0) * 100);

    // Filter activity related to this goal
    const goalNotebookEntries = notebookEntries.filter(e =>
      e.goal_id === goalId ||
      (e.content && e.content.toLowerCase().includes(goalName.toLowerCase().split(' ')[0]))
    );

    const goalTrackers = trackerEntries.filter(e => {
      // Check if tracker is linked to this goal
      const trackerGoal = (e.data as any)?.goal;
      return trackerGoal &&
        (trackerGoal.toLowerCase().includes(goalName.toLowerCase()) ||
         goalName.toLowerCase().includes(trackerGoal.toLowerCase()));
    });

    // NEW: Extract explicit progress from note content
    let extractedProgress: number | null = null;
    for (const entry of goalNotebookEntries) {
      const progress = this.extractProgressFromContent(entry.content);
      if (progress !== null) {
        extractedProgress = progress;
        logger.info(`[AxiomProgress] Extracted progress ${progress}% from note for goal ${goalName}`);
        break; // Use first explicit progress found
      }
    }

    // Build evidence list
    const evidence: string[] = [];

      if (goalNotebookEntries.length > 0) {
      evidence.push(`${goalNotebookEntries.length} notebook entries related to this goal`);
      goalNotebookEntries.slice(0, 3).forEach((e: any) => {
        if (e.title && e.title !== 'Shared Item') {
          evidence.push(`Note: "${e.title}"`);
        }
      });
      
      // Add extracted progress to evidence
      if (extractedProgress !== null) {
        evidence.push(`Explicit progress mentioned: ${extractedProgress}%`);
      }

      // Add attachment evidence
      const attachmentEntries = goalNotebookEntries.filter((e: any) => Array.isArray(e.attachments) && e.attachments.length > 0);
      if (attachmentEntries.length > 0) {
        attachmentEntries.forEach((e: any) => {
          const files = e.attachments.map((a: any) => a.name || a.url).join(', ');
          evidence.push(`Attachments: ${files}`);
        });
      }
    }

    if (goalTrackers.length > 0) {
      evidence.push(`${goalTrackers.length} tracker logs related to this goal`);
    }

    // Check for completion signals
    const completionSignals = goalNotebookEntries.filter(e =>
      e.content?.includes('100%') ||
      e.content?.includes('completed') ||
      e.content?.includes('finished') ||
      e.content?.includes('achieved') ||
      e.title?.includes('✅') ||
      e.title?.includes('Done')
    );

    if (completionSignals.length > 0) {
      evidence.push('Completion language detected in entries');
    }

    // Check for struggle signals
    const struggleSignals = goalNotebookEntries.filter(e =>
      e.mood === '😔' ||
      e.content?.toLowerCase().includes('stuck') ||
      e.content?.toLowerCase().includes('hard') ||
      e.content?.toLowerCase().includes('difficult') ||
      e.content?.toLowerCase().includes('struggling')
    );

    if (struggleSignals.length > 0) {
      evidence.push('Struggle indicators detected');
    }

    // Collect attachments from related entries
    const allAttachments = goalNotebookEntries
      .flatMap((e: any) => Array.isArray(e.attachments) ? e.attachments : [])
      .slice(0, 5);

    // Use AI to estimate progress (or use extracted progress if available)
    let suggestedProgress: number;
    if (extractedProgress !== null) {
      suggestedProgress = extractedProgress;
      logger.info(`[AxiomProgress] Using extracted progress ${extractedProgress}% for goal ${goalName}`);
    } else {
      suggestedProgress = await this.aiEstimateProgress(
        node,
        goalNotebookEntries,
        goalTrackers,
        currentProgress,
        allAttachments
      );
    }

    // Calculate confidence based on available evidence
    const confidence = this.calculateConfidence(
      goalNotebookEntries.length,
      goalTrackers.length,
      checkins.length
    );

    // If we have explicit progress, boost confidence
    const finalConfidence = extractedProgress !== null ? Math.min(confidence + 0.3, 1.0) : confidence;

    // Generate reasoning
    const reasoning = this.generateReasoning(
      currentProgress,
      suggestedProgress,
      goalNotebookEntries.length,
      goalTrackers.length,
      completionSignals.length,
      struggleSignals.length,
      extractedProgress
    );

    return {
      goalId,
      goalName,
      currentProgress,
      suggestedProgress,
      confidence,
      reasoning,
      evidence,
    };
  }

  /**
   * AI-powered progress estimation
   */
  private async aiEstimateProgress(
    node: any,
    notebookEntries: any[],
    trackerEntries: any[],
    currentProgress: number,
    attachments: any[] = []
  ): Promise<number> {
    try {
      const aiCoaching = new AICoachingService();

      const entriesWithAttachments = notebookEntries.filter((e: any) => Array.isArray(e.attachments) && e.attachments.length > 0);
      const attachmentNote = entriesWithAttachments.length > 0
        ? `\n\nNOTE: ${entriesWithAttachments.length} entries have attached files (images, PDFs, text files). Analyze them for progress evidence.`
        : '';

      const prompt = `Progress estimator for personal goals. Estimate 0-100% based on activity.

GOAL: ${node.name} (${node.domain}) — currently ${currentProgress}%${node.completionMetric ? ` — target: ${node.completionMetric}` : ''}

ACTIVITY (7 days):

Notes (${notebookEntries.length}):
${notebookEntries.slice(0, 5).map((e: any) => {
  const attachments = Array.isArray(e.attachments) && e.attachments.length > 0
    ? ` [${e.attachments.length} attachment(s)]`
    : '';
  return `- ${e.occurred_at?.slice(0, 10)}: "${e.title || 'Untitled'}"${attachments} — ${e.content?.slice(0, 80) || 'no text'} ${e.mood ? `(${e.mood})` : ''}`;
}).join('\n') || 'None'}

Trackers (${trackerEntries.length}):
${trackerEntries.slice(0, 5).map((e: any) => 
  `- ${e.logged_at?.slice(0, 10)}: ${JSON.stringify(e.data)}`
).join('\n') || 'None'}${attachmentNote}

RULES:
- 100% → keep 100
- Completion language ("done", "finished", "achieved") → 95-100%
- Consistent activity (3+) → +5-15%
- No activity → same or -5%
- Struggle ("stuck", "hard") → +0-5%
- Positive mood (😊, 🔥) → +5-10%
- Negative mood (😔) → +0-5%

Respond ONLY a number 0-100:`;

      let response: string;
      if (attachments.length > 0) {
        try {
          const { parts } = await axiomMultimodalService.processAttachments(attachments);
          response = await aiCoaching.runMultimodal(prompt, parts);
        } catch (err: any) {
          logger.warn(`[AxiomProgress] Multimodal failed, falling back to text: ${err.message}`);
          response = await aiCoaching.runWithFallback(prompt);
        }
      } else {
        response = await aiCoaching.runWithFallback(prompt);
      }
      const estimatedProgress = parseInt(response.trim(), 10);
      
      // Validate and clamp
      if (isNaN(estimatedProgress)) {
        return currentProgress;
      }
      
      return Math.max(0, Math.min(100, estimatedProgress));
    } catch (error: any) {
      logger.error('[AxiomProgress] AI estimation failed:', error.message);
      return currentProgress;
    }
  }

  /**
   * Calculate confidence score based on available data
   */
  private calculateConfidence(
    notebookCount: number,
    trackerCount: number,
    checkinCount: number
  ): number {
    const totalSignals = notebookCount + trackerCount + (checkinCount * 0.5);
    
    if (totalSignals >= 10) return 0.9;
    if (totalSignals >= 5) return 0.7;
    if (totalSignals >= 2) return 0.5;
    return 0.3;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    current: number,
    suggested: number,
    notebookCount: number,
    trackerCount: number,
    completionCount: number,
    struggleCount: number,
    extractedProgress: number | null = null
  ): string {
    const change = suggested - current;

    // If progress was explicitly extracted from note
    if (extractedProgress !== null) {
      return `Progress explicitly mentioned in note: ${extractedProgress}%`;
    }

    if (completionCount > 0) {
      return 'Completion indicators detected in recent activity';
    }

    if (change > 10) {
      return `Significant activity detected (${notebookCount} notes, ${trackerCount} logs) suggests major progress`;
    }

    if (change > 5) {
      return `Consistent activity (${notebookCount + trackerCount} entries) indicates steady progress`;
    }

    if (change > 0) {
      return 'Some activity detected, small progress increase';
    }

    if (change === 0) {
      if (struggleCount > 0) {
        return 'Struggle indicators detected, maintaining current progress';
      }
      return 'Insufficient new activity to update progress';
    }

    return 'Lack of recent activity suggests progress may have stalled';
  }

  /**
   * Update goal progress in database
   */
  private async updateGoalProgress(
    userId: string,
    goalId: string,
    newProgress: number,
    reasoning: string
  ): Promise<void> {
    try {
      const { data: goalTree } = await supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .single();

      if (!goalTree?.nodes) return;

      const nodes = Array.isArray(goalTree.nodes) ? goalTree.nodes : [];
      const nodeIndex = nodes.findIndex((n: any) => n.id === goalId);
      
      if (nodeIndex === -1) return;

      // Update the node
      nodes[nodeIndex] = {
        ...nodes[nodeIndex],
        progress: newProgress,
        updated_at: new Date().toISOString(),
        progress_updated_by: 'axiom_auto',
        progress_reasoning: reasoning,
      };

      await supabase
        .from('goal_trees')
        .update({ nodes, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      logger.info(`[AxiomProgress] Updated goal ${goalId} to ${Math.round(newProgress * 100)}%`);
    } catch (error: any) {
      logger.error(`[AxiomProgress] Failed to update goal ${goalId}:`, error.message);
    }
  }

  /**
   * Send notification about progress updates
   */
  private async sendProgressNotification(
    userId: string,
    updates: Array<{ goalId: string; oldProgress: number; newProgress: number; reasoning: string }>
  ): Promise<void> {
    try {
      // Import pushNotification dynamically to avoid circular dependency
      const { pushNotification } = await import('../controllers/notificationController');

      for (const update of updates) {
        const change = update.newProgress - update.oldProgress;

        await pushNotification({
          userId,
          title: change > 0 ? '🎯 Progress Updated!' : '⚠️ Progress Check',
          body: change > 0
            ? `"${update.goalId.slice(0, 30)}..." increased to ${update.newProgress}% (${change > 0 ? '+' : ''}${change}%)`
            : `"${update.goalId.slice(0, 30)}..." needs attention`,
          type: 'goal_progress_update',
        });
      }
    } catch (error: any) {
      logger.error('[AxiomProgress] Failed to send notifications:', error.message);
    }
  }

  /**
   * Automatically log progress updates to notebook entries
   * Creates a notebook entry for each significant progress change (>= 10%)
   */
  private async autoLogProgressToNotebook(
    userId: string,
    updates: Array<{ goalId: string; oldProgress: number; newProgress: number; reasoning: string }>
  ): Promise<void> {
    try {
      for (const update of updates) {
        const change = update.newProgress - update.oldProgress;
        
        // Only log significant changes (10% or more)
        if (Math.abs(change) < 10) {
          continue;
        }

        const changeEmoji = change > 0 ? '📈' : change < 0 ? '📉' : '⏸️';
        const progressStatus = update.newProgress === 100 ? '🎉 COMPLETED' : update.newProgress >= 75 ? '🔥 Almost There' : update.newProgress >= 50 ? '✅ Halfway' : update.newProgress >= 25 ? '🚀 Making Progress' : '🌱 Getting Started';
        
        // Generate notebook entry content
        const content = `## Axiom Progress Update ${changeEmoji}

**Progress Change:** ${update.oldProgress}% → ${update.newProgress}% (${change > 0 ? '+' : ''}${change}%)
**Status:** ${progressStatus}

### Analysis
${update.reasoning}

---
*This progress was automatically logged by Axiom during nightly analysis.*`;

        // Insert notebook entry
        const { error } = await supabase
          .from('notebook_entries')
          .insert({
            user_id: userId,
            entry_type: 'goal_progress',
            title: `${changeEmoji} Progress: ${update.goalId.slice(0, 40)}...`,
            content,
            domain: 'personal_development',
            source_table: 'goal_trees',
            source_id: update.goalId,
            occurred_at: new Date().toISOString(),
            metadata: {
              auto_logged: true,
              old_progress: update.oldProgress,
              new_progress: update.newProgress,
              change,
              logged_by: 'axiom_midnight_scan',
            },
            is_private: false,
          });

        if (error) {
          logger.error(`[AxiomProgress] Failed to log progress to notebook for goal ${update.goalId}:`, error.message);
        } else {
          logger.info(`[AxiomProgress] Auto-logged progress update to notebook for goal ${update.goalId}`);
        }
      }
    } catch (error: any) {
      logger.error('[AxiomProgress] Failed to auto-log progress to notebook:', error.message);
    }
  }

  /**
   * Log a daily progress summary notebook entry
   * Creates a single summary entry with all progress updates for the day
   */
  private async logDailyProgressSummary(
    userId: string,
    updates: Array<{ goalId: string; oldProgress: number; newProgress: number; reasoning: string }>
  ): Promise<void> {
    try {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const totalUpdates = updates.length;
      const positiveUpdates = updates.filter(u => u.newProgress > u.oldProgress).length;
      const completedGoals = updates.filter(u => u.newProgress === 100).length;
      
      const summaryEmoji = positiveUpdates === totalUpdates ? '🎉' : positiveUpdates > 0 ? '📊' : '📝';
      
      // Build summary content
      let content = `## ${summaryEmoji} Daily Progress Summary - ${today}

**Total Goals Updated:** ${totalUpdates}
**Progress Increases:** ${positiveUpdates}
**Goals Completed:** ${completedGoals}

### Progress Details

`;

      for (const update of updates) {
        const change = update.newProgress - update.oldProgress;
        const changeEmoji = change > 0 ? '📈' : change < 0 ? '📉' : '⏸️';
        const changeText = change > 0 ? `+${change}%` : `${change}%`;
        
        content += `${changeEmoji} **${update.goalId.slice(0, 50)}...**: ${update.oldProgress}% → ${update.newProgress}% (${changeText})\n`;
      }

      content += `\n---\n*Summary automatically generated by Axiom during nightly analysis.*`;

      // Insert summary notebook entry
      const { error } = await supabase
        .from('notebook_entries')
        .insert({
          user_id: userId,
          entry_type: 'note',
          title: `${summaryEmoji} Daily Progress Summary - ${today}`,
          content,
          domain: 'personal_development',
          occurred_at: new Date().toISOString(),
          metadata: {
            auto_logged: true,
            summary_type: 'daily_progress',
            total_updates: totalUpdates,
            positive_updates: positiveUpdates,
            completed_goals: completedGoals,
            logged_by: 'axiom_midnight_scan',
            date: new Date().toISOString().slice(0, 10),
          },
          is_private: false,
        });

      if (error) {
        logger.error('[AxiomProgress] Failed to log daily progress summary:', error.message);
      } else {
        logger.info(`[AxiomProgress] Logged daily progress summary for user ${userId}`);
      }
    } catch (error: any) {
      logger.error('[AxiomProgress] Failed to log daily progress summary:', error.message);
    }
  }

  /**
   * Run progress estimation for all active users
   */
  async estimateAllUsersProgress(): Promise<void> {
    try {
      // Get all users who have been active in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString();

      const { data: activeUsers } = await supabase
        .from('notebook_entries')
        .select('user_id')
        .gte('occurred_at', sevenDaysAgoStr);

      if (!activeUsers || activeUsers.length === 0) {
        logger.info('[AxiomProgress] No active users to process');
        return;
      }

      const userIds = [...new Set(activeUsers.map(u => u.user_id))];
      logger.info(`[AxiomProgress] Processing ${userIds.length} users`);

      for (const userId of userIds) {
        await this.estimateAllGoalProgress(userId);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      logger.info(`[AxiomProgress] Completed processing ${userIds.length} users`);
    } catch (error: any) {
      logger.error('[AxiomProgress] Error processing all users:', error.message);
    }
  }

  /**
   * Extract explicit progress percentage from note content
   * Looks for patterns like "50%", "halfway", "3/4 done", "milestone 2 of 5"
   */
  private extractProgressFromContent(content: string): number | null {
    if (!content) return null;

    // Pattern: "XX%" or "XX % "
    const percentageMatch = content.match(/(\d{1,3})\s*%/);
    if (percentageMatch) {
      const progress = parseInt(percentageMatch[1], 10);
      if (progress >= 0 && progress <= 100) {
        return progress;
      }
    }

    // Pattern: "X of Y" or "X/Y" (e.g., "3 of 5", "2/4")
    const fractionMatch = content.match(/(\d+)\s*(?:of|\/)\s*(\d+)/);
    if (fractionMatch) {
      const numerator = parseInt(fractionMatch[1], 10);
      const denominator = parseInt(fractionMatch[2], 10);
      if (denominator > 0) {
        return Math.round((numerator / denominator) * 100);
      }
    }

    // Pattern: "halfway", "half done", "50 percent"
    const halfwayPatterns = ['halfway', 'half done', 'half complete', '50 percent'];
    if (halfwayPatterns.some(p => content.toLowerCase().includes(p))) {
      return 50;
    }

    // Pattern: "almost done", "nearly there", "90%"
    const almostDonePatterns = ['almost done', 'nearly there', 'almost complete', 'close to finish'];
    if (almostDonePatterns.some(p => content.toLowerCase().includes(p))) {
      return 90;
    }

    // Pattern: "just started", "beginning", "10%"
    const justStartedPatterns = ['just started', 'beginning', 'getting started', 'first steps'];
    if (justStartedPatterns.some(p => content.toLowerCase().includes(p))) {
      return 10;
    }

    return null;
  }

  /**
   * Generate or update private Axiom summary for a user
   * This summary is only visible to admins and Axiom itself
   * Prevents re-reading the same material over multiple scans
   */
  async generateAxiomSummary(userId: string, notebookEntries: any[]): Promise<void> {
    try {
      logger.info(`[AxiomSummary] Generating summary for user ${userId}`);

      // Get last processed timestamp from previous summary
      const { data: existingSummary } = await supabase
        .from('axiom_private_summaries')
        .select('last_processed_at, summary')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastProcessedAt = existingSummary?.last_processed_at 
        ? new Date(existingSummary.last_processed_at)
        : new Date(0);

      // Filter entries created/updated since last scan
      const newEntries = notebookEntries.filter(e => 
        new Date(e.occurred_at || e.created_at) > lastProcessedAt
      );

      if (newEntries.length === 0) {
        logger.info(`[AxiomSummary] No new entries for user ${userId}`);
        return;
      }

      logger.info(`[AxiomSummary] Processing ${newEntries.length} new entries for user ${userId}`);

      // Analyze new entries
      const analysis = await this.analyzeEntriesForSummary(newEntries);

      // Build updated summary
      const updatedSummary = {
        last_processed_at: new Date().toISOString(),
        total_entries_processed: (existingSummary?.summary?.total_entries_processed || 0) + newEntries.length,
        recent_themes: analysis.themes,
        recent_achievements: analysis.achievements,
        recent_challenges: analysis.challenges,
        goal_progress_updates: analysis.goalUpdates,
        mood_patterns: analysis.moodPatterns,
        activity_summary: {
          checkins: analysis.checkinCount,
          notes: analysis.noteCount,
          tracker_logs: analysis.trackerCount,
        },
        insights: analysis.insights,
      };

      // Upsert summary
      const { error } = await supabase
        .from('axiom_private_summaries')
        .upsert({
          user_id: userId,
          summary: updatedSummary,
          last_processed_at: updatedSummary.last_processed_at,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        logger.error(`[AxiomSummary] Failed to save summary for user ${userId}:`, error.message);
      } else {
        logger.info(`[AxiomSummary] Summary updated for user ${userId}`);
      }
    } catch (error: any) {
      logger.error(`[AxiomSummary] Error for user ${userId}:`, error.message);
    }
  }

  /**
   * Analyze entries to extract summary information
   */
  private async analyzeEntriesForSummary(entries: any[]) {
    const themes = new Map<string, number>();
    const achievements: string[] = [];
    const challenges: string[] = [];
    const goalUpdates: Array<{ goalId: string; goalName: string; oldProgress: number; newProgress: number }> = [];
    const moodCounts: Record<string, number> = {};
    let checkinCount = 0;
    let noteCount = 0;
    let trackerCount = 0;

    entries.forEach(entry => {
      // Count by type
      if (entry.entry_type === 'checkin') checkinCount++;
      else if (entry.entry_type === 'note' || entry.entry_type === 'journal') noteCount++;
      else if (entry.entry_type === 'tracker') trackerCount++;

      // Extract themes from titles
      if (entry.title && entry.title !== 'Shared Item') {
        const words: string[] = entry.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
        words.forEach((w: string) => themes.set(w, (themes.get(w) || 0) + 1));
      }

      // Detect achievements
      if (entry.content?.includes('completed') || 
          entry.content?.includes('achieved') || 
          entry.content?.includes('100%') ||
          entry.title?.includes('✅')) {
        achievements.push(entry.title || 'Achievement detected');
      }

      // Detect challenges
      if (entry.mood === '😔' ||
          entry.content?.toLowerCase().includes('stuck') ||
          entry.content?.toLowerCase().includes('struggling')) {
        challenges.push(entry.title || 'Challenge detected');
      }

      // Track mood patterns
      if (entry.mood) {
        moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
      }
    });

    // Get top themes
    const topThemes = Array.from(themes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([theme, count]) => ({ theme, count }));

    // Calculate dominant mood
    const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    // Generate insights
    const insights: string[] = [];
    if (checkinCount >= 5) insights.push('High check-in consistency');
    if (noteCount >= 10) insights.push('Active journaling');
    if (achievements.length > 0) insights.push(`${achievements.length} achievements detected`);
    if (challenges.length > 0) insights.push(`${challenges.length} challenges identified`);

    return {
      themes: topThemes,
      achievements,
      challenges,
      goalUpdates,
      moodPatterns: { dominant: dominantMood, distribution: moodCounts },
      checkinCount,
      noteCount,
      trackerCount,
      insights,
    };
  }

  /**
   * Get private Axiom summary for a user (admin-only or Axiom)
   */
  async getAxiomSummary(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('axiom_private_summaries')
      .select('summary, last_processed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data.summary;
  }
}

export default AxiomProgressEstimationService;
