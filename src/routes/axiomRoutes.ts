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
import logger from '../utils/logger';

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
    const response = await aiCoachingService.generateCoachingResponse(prompt, context, true, 'fast');
    
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

// =============================================================================
// NOTEBOOKLM INTEGRATION
// =============================================================================

/**
 * POST /axiom/notebooklm/connect
 * Connect user's NotebookLM account by storing auth cookies
 * Body: { cookies: { "SNlM0e": "...", "FdrFJe": "..." } }
 */
router.post('/notebooklm/connect', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { cookies } = req.body as { cookies?: Record<string, string> };
  if (!cookies || !cookies['SNlM0e'] || !cookies['FdrFJe']) {
    return res.status(400).json({
      error: 'INVALID_COOKIES',
      message: 'cookies must include SNlM0e and FdrFJe (get these from browser DevTools)',
    });
  }

  // Verify cookies work by listing notebooks
  const { execFile: execFileSync } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFileSync);
  const path = await import('path');
  const scriptPath = path.join(__dirname, '../services/AxiomNotebookLMPython.py');

  const cookiesJson = JSON.stringify(cookies);
  try {
    const { stdout } = await execFileAsync('python3', [scriptPath, 'list', cookiesJson], { timeout: 20000 });
    const result = JSON.parse(stdout.trim());

    if (result.error && result.error.includes('HTTP 4')) {
      return res.status(401).json({
        error: 'AUTH_FAILED',
        message: 'Invalid cookies. Please get fresh ones from notebooklm.google.com DevTools → Application → Cookies',
      });
    }

    // Store tokens
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        notebooklm_tokens: { cookies, stored: new Date().toISOString() },
        notebooklm_enabled: true,
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    const notebooks = Array.isArray(result) ? result : [];
    res.json({
      success: true,
      message: 'NotebookLM connected successfully',
      notebooksCount: notebooks.length,
    });
  } catch (err: any) {
    logger.error('[NotebookLM] Connect failed:', err.message);
    res.status(500).json({ error: 'CONNECTION_FAILED', message: err.message });
  }
}));

/**
 * GET /axiom/notebooklm/status
 * Check NotebookLM connection status
 */
router.get('/notebooklm/status', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data } = await supabase
    .from('profiles')
    .select('notebooklm_enabled, notebooklm_tokens, notebooklm_notebook_ids')
    .eq('id', userId)
    .single();

  const isConnected = !!(data?.notebooklm_tokens && data?.notebooklm_enabled);
  const notebooksCount = Array.isArray(data?.notebooklm_notebook_ids) ? data.notebooklm_notebook_ids.length : 0;

  res.json({
    isConnected,
    notebooksCount,
    notebookIds: data?.notebooklm_notebook_ids || [],
  });
}));

/**
 * POST /axiom/notebooklm/disconnect
 * Remove NotebookLM connection
 */
router.post('/notebooklm/disconnect', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  await supabase
    .from('profiles')
    .update({
      notebooklm_tokens: null,
      notebooklm_notebook_ids: [],
      notebooklm_enabled: false,
    })
    .eq('id', userId);

  res.json({ success: true, message: 'NotebookLM disconnected' });
}));

/**
 * GET /axiom/notebooklm/notebooks
 * List user's NotebookLM notebooks
 */
router.get('/notebooklm/notebooks', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { axiomNotebookLMService } = await import('../services/AxiomNotebookLMService');
  const notebooks = await axiomNotebookLMService.listNotebooks(userId);

  res.json({ notebooks: notebooks.map((nb: any) => ({
    id: nb.notebookId || nb.id,
    title: nb.title || nb.name || 'Untitled',
    description: nb.description || '',
    createdAt: nb.createdAt || nb.created_at,
  })) });
}));

/**
 * PUT /axiom/notebooklm/notebooks
 * Select which notebooks to query during midnight scan
 * Body: { notebookIds: string[] }
 */
router.put('/notebooklm/notebooks', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { notebookIds } = req.body as { notebookIds?: string[] };
  if (!Array.isArray(notebookIds)) {
    return res.status(400).json({ error: 'notebookIds must be an array' });
  }

  await supabase
    .from('profiles')
    .update({ notebooklm_notebook_ids: notebookIds.slice(0, 10) })
    .eq('id', userId);

  res.json({ success: true, notebookIds });
}));

export default router;
