import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, InternalServerError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';

/**
 * POST /axiom/feedback
 * Store user feedback on Axiom outputs for learning.
 * Body: { promptHash, feedbackType, feedbackText? }
 */
export const submitAxiomFeedback = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { promptHash, feedbackType, feedbackText } = req.body;

  if (!promptHash || !feedbackType) {
    throw new BadRequestError('promptHash and feedbackType are required');
  }

  const validTypes = ['like', 'dislike', 'irrelevant', 'inaccurate'];
  if (!validTypes.includes(feedbackType)) {
    throw new BadRequestError(`feedbackType must be one of: ${validTypes.join(', ')}`);
  }

  const { data: feedback, error } = await supabase
    .from('axiom_feedback')
    .insert([{
      user_id: userId,
      prompt_hash: promptHash,
      feedback_type: feedbackType,
      feedback_text: feedbackText || null,
    }])
    .select()
    .single();

  if (error) {
    throw new InternalServerError('Failed to store feedback');
  }

  res.status(201).json({ success: true, feedback });
});

/**
 * GET /axiom/feedback/stats?promptHash=:hash
 * Get aggregated feedback stats for a prompt.
 */
export const getFeedbackStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { promptHash } = req.query;

  if (!promptHash) {
    throw new BadRequestError('promptHash query param required');
  }

  const { data: feedbacks, error } = await supabase
    .from('axiom_feedback')
    .select('feedback_type')
    .eq('prompt_hash', promptHash);

  if (error) {
    throw new InternalServerError('Failed to fetch feedback stats');
  }

  const stats: Record<string, number> = {};
  (feedbacks || []).forEach((f: any) => {
    stats[f.feedback_type] = (stats[f.feedback_type] || 0) + 1;
  });

  res.json({ success: true, stats });
});