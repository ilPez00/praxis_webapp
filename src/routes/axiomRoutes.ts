import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AxiomScanService } from '../services/AxiomScanService';
import { AxiomDailySummaryService } from '../services/AxiomDailySummaryService';
import { AxiomProgressEstimationService } from '../services/AxiomProgressEstimationService';
import { AxiomUnifiedScanService } from '../services/AxiomUnifiedScanService';
import { AICoachingService } from '../services/AICoachingService';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';
import * as axiomAgentController from '../controllers/axiomAgentController';

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

/**
 * POST /axiom/agent
 * Interactive Axiom agent that can search notebooks and the web
 * Body: { query: string, allow_web_search?: boolean }
 */
router.post('/agent', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, allow_web_search = false } = req.body;
    if (!query?.trim()) {
      return res.status(400).json({ error: 'QUERY_REQUIRED', message: 'query is required' });
    }
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
    
    const aiCoachingService = new AICoachingService();
    if (!aiCoachingService.isConfigured) {
      return res.status(503).json({ error: 'AXIOM_OFFLINE', message: 'Axiom is not configured on this server' });
    }
    
    const { buildAgentContext, searchNotebooks, buildAgentPrompt } = await import('../controllers/axiomAgentController');
    const context = await buildAgentContext(userId, query);
    const notebookResults = await searchNotebooks(userId, query);
    const prompt = buildAgentPrompt(context, query, notebookResults, []);
    const response = await aiCoachingService.generateCoachingResponse(prompt, context, true);
    
    const sources = notebookResults.slice(0, 5).map((e: any) => ({
      type: e.entry_type,
      id: e.id,
      title: e.title,
      content: e.content?.slice(0, 100),
    }));
    
    res.json({ message: response, sources, notebookResultsCount: notebookResults.length });
  } catch (err) {
    next(err);
  }
});

export default router;
