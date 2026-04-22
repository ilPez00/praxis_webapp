import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync } from '../utils/appErrors';

type FailType = 'missed_deadline' | 'failed_bet' | 'missed_event' | 'missed_checkin';

export const logFail = async (
  failType: FailType,
  goalName?: string,
  details?: string
): Promise<void> => {
  try {
    await supabase.from('fails').insert({
      fail_type: failType,
      goal_name: goalName || null,
      details: details || null,
    });
  } catch (err: any) {
    logger.warn(`[Fails] Failed to log fail: ${err.message}`);
  }
};

export const getFails = catchAsync(async (_req: Request, res: Response, _next: NextFunction) => {
  const { limit = '50', offset = '0', type } = _req.query as {
    limit?: string;
    offset?: string;
    type?: string;
  };

  const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
  const offsetNum = parseInt(offset, 10) || 0;

  let query = supabase
    .from('fails')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offsetNum, offsetNum + limitNum - 1);

  if (type) {
    query = query.eq('fail_type', type);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error('[Fails] Fetch error:', error.message, error.details, error.hint, error.code);
    throw error;
  }

  res.json({
    fails: data || [],
    total: count || 0,
    limit: limitNum,
    offset: offsetNum,
  });
});

export const getFailsStats = catchAsync(async (_req: Request, res: Response, _next: NextFunction) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('fails')
    .select('fail_type')
    .gte('created_at', oneWeekAgo.toISOString());

  if (error) {
    logger.error('[Fails] Stats error:', error.message);
    throw error;
  }

  const stats = {
    total: data?.length || 0,
    byType: {} as Record<string, number>,
  };

  for (const fail of data || []) {
    stats.byType[fail.fail_type] = (stats.byType[fail.fail_type] || 0) + 1;
  }

  res.json(stats);
});
