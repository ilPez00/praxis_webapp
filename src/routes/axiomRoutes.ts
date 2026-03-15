import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AxiomScanService } from '../services/AxiomScanService';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';

const router = Router();

/**
 * POST /axiom/regenerate
 * Regenerate daily Axiom message with LLM
 */
router.post('/regenerate', catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  // Get user info
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('name, is_premium, is_admin, minimal_ai_mode')
    .eq('id', userId)
    .single();

  if (userError) throw userError;

  const userName = user?.name || 'Student';
  const useLLM = true; // Always use LLM for on-demand regeneration

  // Generate new daily brief
  await AxiomScanService.generateDailyBrief(userId, userName, 'Unknown', useLLM);

  // Fetch the newly generated brief
  const today = new Date().toISOString().slice(0, 10);
  const { data: brief, error: briefError } = await supabase
    .from('axiom_daily_briefs')
    .select('brief')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (briefError) throw briefError;

  res.json({
    success: true,
    message: 'Axiom message regenerated with LLM',
    brief: brief?.brief,
  });
}));

export default router;
