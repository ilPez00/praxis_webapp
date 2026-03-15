import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';

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

  // Get recent briefs (last 24 hours)
  const recentBriefsRes = await supabase
    .from('axiom_daily_briefs')
    .select(`
      id,
      user_id,
      date,
      generated_at,
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

export default router;
