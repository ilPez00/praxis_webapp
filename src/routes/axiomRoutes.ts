import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AxiomScanService } from '../services/AxiomScanService';
import { AxiomDailySummaryService } from '../services/AxiomDailySummaryService';
import { AxiomProgressEstimationService } from '../services/AxiomProgressEstimationService';
import { AxiomUnifiedScanService } from '../services/AxiomUnifiedScanService';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';

const router = Router();
const unifiedScanService = new AxiomUnifiedScanService();

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

/**
 * POST /axiom/generate-daily-summaries
 * Run unified midnight scan (brief + progress + summaries) for all users
 * Admin/cron only - runs once per day at midnight
 */
router.post('/generate-daily-summaries', catchAsync(async (req: Request, res: Response) => {
  // Run unified scan that does everything in one pass
  await unifiedScanService.runMidnightScan();

  res.json({
    success: true,
    message: 'Unified midnight scan complete (briefs + progress + summaries)',
  });
}));

/**
 * POST /axiom/estimate-progress
 * Deprecated - progress estimation now runs as part of unified scan
 */
router.post('/estimate-progress', catchAsync(async (req: Request, res: Response) => {
  // For backwards compatibility, run unified scan
  await unifiedScanService.runMidnightScan();

  res.json({
    success: true,
    message: 'Progress estimation complete (via unified scan)',
  });
}));

/**
 * POST /axiom/run-unified-scan
 * Manually trigger unified scan for all users
 * Admin only
 */
router.post('/run-unified-scan', catchAsync(async (req: Request, res: Response) => {
  await unifiedScanService.runMidnightScan();

  res.json({
    success: true,
    message: 'Unified scan complete',
  });
}));

export default router;
