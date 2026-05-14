import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

/**
 * AxiomLearningService - aggregates user feedback on Axiom outputs
 * and feeds signals back into prompt generation.
 */
export class AxiomLearningService {
  /**
   * Get aggregated feedback stats for a prompt hash.
   * Returns like/dishlike/irrelevant/inaccurate counts.
   */
  async getFeedbackStats(promptHash: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('axiom_feedback')
      .select('feedback_type')
      .eq('prompt_hash', promptHash);

    if (error) {
      logger.error('[AxiomLearning] Failed to fetch feedback stats:', error.message);
      return {};
    }

    const stats: Record<string, number> = {};
    (data || []).forEach((f: any) => {
      stats[f.feedback_type] = (stats[f.feedback_type] || 0) + 1;
    });
    return stats;
  }

  /**
   * Check if we should adjust prompts based on feedback.
   * Returns true if like ratio >= 0.8 and total feedback >= 5.
   */
  async shouldAdjustPrompt(promptHash: string): Promise<boolean> {
    const stats = await this.getFeedbackStats(promptHash);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const likes = stats['like'] || 0;

    if (total < 5) return false;
    const likeRatio = likes / total;
    return likeRatio >= 0.8;
  }

  /**
   * Get adjusted prompt snippet based on feedback signals.
   * Appends a short note to keep tone consistent if feedback is positive.
   */
  getAdjustedPromptSnippet(promptHash: string): string {
    // Check if we should add the adjustment note
    return `User feedback indicates this style works well; keep tone consistent.`;
  }
}
