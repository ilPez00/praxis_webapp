import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { GoalNode } from '../models/GoalNode';
import { GoalTree } from '../models/GoalTree';
import { Achievement } from '../models/Achievement';
import { FeedbackGrade } from '../models/FeedbackGrade';
import logger from '../utils/logger';
import { catchAsync, NotFoundError, ForbiddenError, InternalServerError, BadRequestError } from '../utils/appErrors';
import { cacheGet, cacheSet, TTL } from '../utils/cache';

/**
 * @description Helper to check if a user is premium.
 */
async function isUserPremium(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', userId)
    .single();

  if (error) {
    logger.error('Error checking premium status:', error);
    return false;
  }
  return data?.is_premium || false;
}

/**
 * @description Retrieves a user's goal progress over time.
 * For this iteration, we'll simulate "over time" by reporting current progress.
 * A more advanced implementation would require historical data storage.
 */
export const getProgressOverTime = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.userId as string;
  if (!userId) throw new BadRequestError('User ID is required.');

  const cacheKey = `analytics:progress:${userId}`;
  const cached = cacheGet<any[]>(cacheKey);
  if (cached) return res.json(cached);

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  const { data: goalTreeData, error: goalTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('user_id', userId)
    .single();

  if (goalTreeError && goalTreeError.code !== 'PGRST116') {
    logger.error('Error fetching goal tree for progress:', goalTreeError.message);
    throw new InternalServerError('Failed to fetch goal data.');
  }

  const goals: GoalNode[] = goalTreeData?.nodes || [];
  const progressData = goals.map(goal => ({
    goalId: goal.id,
    goalName: goal.name,
    domain: goal.domain,
    progress: goal.progress,
    weight: goal.weight,
    timestamp: new Date().toISOString(),
  }));

  cacheSet(cacheKey, progressData, TTL.LONG);
  res.json(progressData);
});

/**
 * @description Retrieves a user's domain performance breakdown.
 * Calculates average progress and total weighted progress per domain.
 */
export const getDomainPerformance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.userId as string;
  if (!userId) throw new BadRequestError('User ID is required.');

  const cacheKey = `analytics:domain:${userId}`;
  const cached = cacheGet<any[]>(cacheKey);
  if (cached) return res.json(cached);

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  const { data: goalTreeData, error: goalTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('user_id', userId)
    .single();

  if (goalTreeError && goalTreeError.code !== 'PGRST116') {
    logger.error('Error fetching goal tree for domain performance:', goalTreeError.message);
    throw new InternalServerError('Failed to fetch goal data.');
  }

  const goals: GoalNode[] = goalTreeData?.nodes || [];
  const domainPerformance: { [key: string]: { totalProgress: number; totalWeight: number; goalCount: number } } = {};

  goals.forEach(goal => {
    if (!domainPerformance[goal.domain]) {
      domainPerformance[goal.domain] = { totalProgress: 0, totalWeight: 0, goalCount: 0 };
    }
    domainPerformance[goal.domain].totalProgress += goal.progress;
    domainPerformance[goal.domain].totalWeight += goal.weight;
    domainPerformance[goal.domain].goalCount += 1;
  });

  const result = Object.entries(domainPerformance).map(([domain, data]) => ({
    domain,
    averageProgress: data.goalCount > 0 ? data.totalProgress / data.goalCount : 0,
    totalWeightedProgress: data.totalWeight > 0 ? (data.totalProgress * data.totalWeight) / data.goalCount : 0, // Simplified metric
    goalCount: data.goalCount,
  }));

  cacheSet(cacheKey, result, TTL.LONG);
  res.json(result);
});

/**
 * @description Retrieves a user's feedback trends.
 * Counts occurrences of each feedback grade.
 */
export const getFeedbackTrends = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.userId as string;
  if (!userId) throw new BadRequestError('User ID is required.');

  const cacheKey = `analytics:feedback:${userId}`;
  const cached = cacheGet<any[]>(cacheKey);
  if (cached) return res.json(cached);

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  const { data: feedbackData, error: feedbackError } = await supabase
    .from('feedback')
    .select('grade')
    .eq('receiver_id', userId)
    .limit(100); // Limit to recent feedback for trends

  if (feedbackError) {
    logger.error('Error fetching feedback for trends:', feedbackError.message);
    throw new InternalServerError('Failed to fetch feedback data.');
  }

  const gradeCounts: { [key: string]: number } = {};
  Object.values(FeedbackGrade).forEach(grade => {
    gradeCounts[grade] = 0; // Initialize all grades to 0
  });

  feedbackData.forEach((fb: { grade: FeedbackGrade }) => {
    if (gradeCounts[fb.grade] !== undefined) {
      gradeCounts[fb.grade]++;
    }
  });

  const result = Object.entries(gradeCounts).map(([grade, count]) => ({
    grade,
    count,
  }));

  cacheSet(cacheKey, result, TTL.LONG);
  res.json(result);
});

/**
 * @description Retrieves a user's achievement rate.
 * Counts total goals and completed achievements.
 */
export const getAchievementRate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.userId as string;
  if (!userId) {
    throw new BadRequestError('User ID is required.');
  }

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  // Get total number of goals
  const { data: goalTreeData, error: goalTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('user_id', userId)
    .single();

  if (goalTreeError && goalTreeError.code !== 'PGRST116') {
    logger.error('Error fetching goal tree for achievement rate:', goalTreeError.message);
    // Treat as 0 goals if tree not found or error, but still log
    return res.status(200).json({ totalGoals: 0, completedAchievements: 0, achievementRate: 0 });
  }
  const totalGoals = goalTreeData?.nodes?.length || 0;

  // Get number of completed achievements
  const { count: completedAchievements, error: achievementsError } = await supabase
    .from('achievements')
    .select('id', { count: 'exact' })
    .eq('user_id', userId);

  if (achievementsError) {
    logger.error('Error fetching achievements for rate:', achievementsError.message);
    throw new InternalServerError('Failed to fetch achievement data.');
  }

  const completedCount = completedAchievements ?? 0;
  const achievementRate = totalGoals > 0 ? completedCount / totalGoals : 0;

  res.json({
    totalGoals,
    completedAchievements: completedCount,
    achievementRate: parseFloat(achievementRate.toFixed(2)),
  });
});

/**
 * @description Provides comparative insights with anonymized community averages.
 * Returns the user's stats vs. the community median/average across streak,
 * reliability, PP, and honor — plus percentile positions.
 */
export const getComparisonData = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.params.userId as string;
  if (!userId) throw new BadRequestError('User ID is required.');

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  // Fetch user's own stats + all community stats in parallel
  const [userRes, communityRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('current_streak, reliability_score, praxis_points, honor_score')
      .eq('id', userId)
      .single(),
    supabase
      .from('profiles')
      .select('current_streak, reliability_score, praxis_points, honor_score')
      .limit(1000),
  ]);

  if (userRes.error) throw new InternalServerError('Failed to fetch user stats.');

  const user = userRes.data;
  const community = (communityRes.data ?? []).filter((p: any) => p.praxis_points !== null);

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };
  const pct = (arr: number[], val: number) =>
    arr.length ? Math.round((arr.filter(x => x < val).length / arr.length) * 100) : 50;

  const streaks = community.map((p: any) => p.current_streak ?? 0);
  const reliabilities = community.map((p: any) => p.reliability_score ?? 0);
  const points = community.map((p: any) => p.praxis_points ?? 0);
  const honors = community.map((p: any) => p.honor_score ?? 0);

  res.json({
    user: {
      streak: user.current_streak ?? 0,
      reliability: user.reliability_score ?? 0,
      praxis_points: user.praxis_points ?? 0,
      honor_score: user.honor_score ?? 0,
    },
    community: {
      total_users: community.length,
      streak:       { avg: Math.round(avg(streaks)),   median: Math.round(median(streaks)) },
      reliability:  { avg: Math.round(avg(reliabilities) * 100) / 100, median: Math.round(median(reliabilities) * 100) / 100 },
      praxis_points: { avg: Math.round(avg(points)),  median: Math.round(median(points)) },
      honor_score:  { avg: Math.round(avg(honors) * 10) / 10, median: Math.round(median(honors) * 10) / 10 },
    },
    percentiles: {
      streak:       pct(streaks, user.current_streak ?? 0),
      reliability:  pct(reliabilities, user.reliability_score ?? 0),
      praxis_points: pct(points, user.praxis_points ?? 0),
      honor_score:  pct(honors, user.honor_score ?? 0),
    },
  });
});
