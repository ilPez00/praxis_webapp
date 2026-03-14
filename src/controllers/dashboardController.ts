import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError } from '../utils/appErrors';
import { cacheGet, cacheSet, TTL } from '../utils/cache';

/**
 * GET /dashboard/summary?userId=:userId
 *
 * Replaces 4 individual startup API calls (goals, bets, checkin, axiom briefs)
 * with a single parallel-fetched response, reducing browser round-trips on
 * the dashboard from ~5 down to 2 (this + AccountabilityNetworkWidget).
 */
export const getDashboardSummary = catchAsync(async (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  if (!userId) throw new BadRequestError('userId is required');

  const cacheKey = `dashboard:${userId}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return res.json(cached);

  const today = new Date().toISOString().slice(0, 10);

  const [goalTreeRes, betsRes, checkinRes, briefsRes] = await Promise.allSettled([
    supabase
      .from('goal_trees')
      .select('id, user_id, nodes, root_nodes')
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('bets')
      .select('id, goal_node_id, stake_points, deadline, status, goal_name')
      .eq('user_id', userId)
      .eq('status', 'active'),

    supabase
      .from('checkins')
      .select('id')
      .eq('user_id', userId)
      .gte('checked_in_at', `${today}T00:00:00Z`)
      .limit(1),

    supabase
      .from('axiom_daily_briefs')
      .select('date, brief, generated_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(14),
  ]);

  const summary = {
    goalTree:   goalTreeRes.status  === 'fulfilled' ? goalTreeRes.value.data   : null,
    activeBets: betsRes.status      === 'fulfilled' ? (betsRes.value.data ?? []) : [],
    checkedIn:  checkinRes.status   === 'fulfilled' ? (checkinRes.value.data?.length ?? 0) > 0 : false,
    briefs:     briefsRes.status    === 'fulfilled' ? (briefsRes.value.data ?? []) : [],
  };

  // Cache for 2 min — short enough that a check-in refresh feels instant
  cacheSet(cacheKey, summary, 2 * 60);
  res.json(summary);
});
