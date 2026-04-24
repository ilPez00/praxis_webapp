import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';
import { AxiomScanService } from '../services/AxiomScanService';
import { AxiomProgressEstimationService } from '../services/AxiomProgressEstimationService';
import { AICoachingService } from '../services/AICoachingService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /admin/axiom/stats
 * Get Axiom usage statistics including top users
 */
router.get('/stats', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get total briefs generated (all time, 7 days, 30 days)
  const [totalBriefsRes, weekBriefsRes, monthBriefsRes] = await Promise.all([
    supabase.from('axiom_daily_briefs').select('id', { count: 'exact', head: true }),
    supabase.from('axiom_daily_briefs').select('id', { count: 'exact', head: true }).gte('date', sevenDaysAgo.toISOString().slice(0, 10)),
    supabase.from('axiom_daily_briefs').select('id', { count: 'exact', head: true }).gte('date', thirtyDaysAgo.toISOString().slice(0, 10)),
  ]);

  // Get top users by brief count - use raw query for grouping
  const { data: topUsersData, error: topUsersError } = await supabase.rpc('get_top_axiom_users', { limit_count: 10 });
  
  let topUsersWithDetails: any[] = [];
  
  if (topUsersData && Array.isArray(topUsersData)) {
    // Get user details for top users
    const topUserIds = topUsersData.map((u: any) => u.user_id);
    
    if (topUserIds.length > 0) {
      const profilesRes = await supabase
        .from('profiles')
        .select('id, name, email, is_premium, current_streak, praxis_points')
        .in('id', topUserIds);

      const briefCountsMap = Object.fromEntries(topUsersData.map((u: any) => [u.user_id, u.count]));

      topUsersWithDetails = (profilesRes.data || []).map((profile: any) => ({
        ...profile,
        brief_count: briefCountsMap[profile.id] || 0,
      })).sort((a: any, b: any) => b.brief_count - a.brief_count);
    }
  }

  // Get recent briefs (last 24 hours) — include brief JSON for source tag
  const recentBriefsRes = await supabase
    .from('axiom_daily_briefs')
    .select(`
      id,
      user_id,
      date,
      generated_at,
      brief,
      profiles!inner(name)
    `)
    .gte('generated_at', new Date(Date.now() - 86400000).toISOString())
    .order('generated_at', { ascending: false })
    .limit(20);

  // Get daily generation count (last 7 days)
  const dailyCountsRes = await supabase
    .from('axiom_daily_briefs')
    .select('date, generated_at')
    .gte('date', sevenDaysAgo.toISOString().slice(0, 10))
    .order('date', { ascending: true });

  // Aggregate by date
  const dailyCounts: Record<string, number> = {};
  (dailyCountsRes.data || []).forEach((brief: any) => {
    const date = brief.date;
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
  });

  res.json({
    summary: {
      total_briefs: totalBriefsRes.count || 0,
      week_briefs: weekBriefsRes.count || 0,
      month_briefs: monthBriefsRes.count || 0,
      today_briefs: dailyCounts[today] || 0,
    },
    top_users: topUsersWithDetails.slice(0, 10),
    recent_briefs: recentBriefsRes.data || [],
    daily_counts: dailyCounts,
  });
}));

/**
 * POST /admin/axiom/force-push
 * Force-generate a brief for a single user or all users.
 * Body: { userId?: string }  — omit userId to push to ALL active users.
 */
router.post('/force-push', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (userId) {
    // Single user
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, city')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    await AxiomScanService.generateDailyBrief(
      profile.id,
      profile.name || 'Student',
      profile.city || 'Unknown',
      true,
    );

    // Read back the stored brief to report source
    const today = new Date().toISOString().slice(0, 10);
    const { data: briefRow } = await supabase
      .from('axiom_daily_briefs')
      .select('brief')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    const brief = briefRow?.brief || {};
    const source = brief.source || 'unknown';
    const llmError = brief.llm_error || null;

    logger.info(`[Admin] Force-pushed Axiom brief for ${profile.name || userId} (source: ${source})`);

    if (source === 'algorithm' && llmError) {
      return res.json({
        success: true,
        source,
        message: `Brief generated for ${profile.name || userId} (ALGORITHM FALLBACK — LLM failed)`,
        llm_error: llmError,
      });
    }

    return res.json({
      success: true,
      source,
      message: `Brief generated for ${profile.name || userId} (source: ${source})`,
    });
  }

  // All active users — run in background
  AxiomScanService.runGlobalScan().catch(err => {
    logger.error('[Admin] Force-push all background failure:', err.message);
  });

  return res.json({ success: true, message: 'Global scan triggered in background for all active users' });
}));

/**
 * GET /admin/axiom/summaries
 * Get private Axiom summaries (admin-only)
 */
router.get('/summaries', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  const { userId, limit = 50 } = req.query;
  
  let query = supabase
    .from('axiom_private_summaries')
    .select('user_id, summary, last_processed_at, created_at')
    .order('last_processed_at', { ascending: false })
    .limit(Number(limit));
  
  if (userId) {
    query = query.eq('user_id', userId as string);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  
  res.json({ summaries: data || [] });
}));

/**
 * GET /admin/axiom/summaries/:userId
 * Get private Axiom summary for a specific user
 */
router.get('/summaries/:userId', authenticateToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  if (Array.isArray(userId)) {
    return res.status(400).json({ message: 'Invalid userId' });
  }
  
  const progressService = new AxiomProgressEstimationService();
  const summary = await progressService.getAxiomSummary(userId);
  
  if (!summary) {
    return res.status(404).json({ message: 'No summary found for this user' });
  }
  
  res.json({ summary });
}));

/**
 * GET /admin/axiom/key-usage
 * Get API key usage statistics per provider/key
 */
router.get('/key-usage', authenticateToken, requireAdmin, catchAsync(async (_req: Request, res: Response) => {
  const aiService = new AICoachingService();
  const keyUsage = await aiService.getKeyUsage();
  res.json({ keys: keyUsage });
}));

export default router;
