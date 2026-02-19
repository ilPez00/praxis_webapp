import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient';
import { GoalNode } from '../models/GoalNode';
import { GoalTree } from '../models/GoalTree';
import { Achievement } from '../models/Achievement';
import { FeedbackGrade } from '../models/FeedbackGrade';
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, ForbiddenError, InternalServerError, BadRequestError } from '../utils/appErrors'; // Import custom errors and catchAsync

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
  if (!userId) {
    throw new BadRequestError('User ID is required.');
  }

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  const { data: goalTreeData, error: goalTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('userId', userId)
    .single();

  if (goalTreeError && goalTreeError.code !== 'PGRST116') {
    logger.error('Error fetching goal tree for progress:', goalTreeError.message);
    throw new InternalServerError('Failed to fetch goal data.');
  }

  const goals: GoalNode[] = goalTreeData?.nodes || [];

  // For now, we'll return the current progress of each goal.
  // In a real-world scenario, this would involve querying a time-series of progress data.
  const progressData = goals.map(goal => ({
    goalId: goal.id,
    goalName: goal.name,
    domain: goal.domain,
    progress: goal.progress, // Current progress
    weight: goal.weight,
    // Simulate historical data for visualization purposes if needed
    // For now, assume this is the 'latest' point in time.
    timestamp: new Date().toISOString(),
  }));

  res.json(progressData);
});

/**
 * @description Retrieves a user's domain performance breakdown.
 * Calculates average progress and total weighted progress per domain.
 */
export const getDomainPerformance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.userId as string;
  if (!userId) {
    throw new BadRequestError('User ID is required.');
  }

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  const { data: goalTreeData, error: goalTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('userId', userId)
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

  res.json(result);
});

/**
 * @description Retrieves a user's feedback trends.
 * Counts occurrences of each feedback grade.
 */
export const getFeedbackTrends = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.userId as string;
  if (!userId) {
    throw new BadRequestError('User ID is required.');
  }

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  const { data: feedbackData, error: feedbackError } = await supabase
    .from('feedback')
    .select('grade')
    .eq('receiverId', userId)
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
    .eq('userId', userId)
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
 * @description Provides comparative insights with anonymized similar users.
 * TODO: This endpoint is a PLACEHOLDER and returns simulated aggregate data.
 * A real implementation would require:
 *   1. A periodic aggregation job (e.g. pg_cron) to compute anonymized averages
 *      across all users, grouped by domain or goal category.
 *   2. Differential privacy measures to ensure no individual's data is exposed.
 *   3. A dedicated `aggregated_stats` table to serve pre-computed values efficiently.
 * See whitepaper §6 (Anonymized Trend Analytics API) for the full design intent.
 */
export const getComparisonData = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.userId as string;
  if (!userId) {
    throw new BadRequestError('User ID is required.');
  }

  if (!(await isUserPremium(userId))) {
    throw new ForbiddenError('Advanced Analytics is a premium feature.');
  }

  // Placeholder for fetching anonymized aggregate data.
  // In a real system, this would involve querying aggregate statistics from all users,
  // potentially filtered by domain or other similar characteristics.
  const averageProgressAcrossAllUsers = 0.65; // Simulated average
  const averageGoalsPerDomain = {
      [FeedbackGrade.SUCCEEDED]: 10,
      [FeedbackGrade.DISTRACTED]: 5,
      [FeedbackGrade.LEARNED]: 8,
      [FeedbackGrade.ADAPTED]: 7,
      [FeedbackGrade.NOT_APPLICABLE]: 2,
      // ... other grades
  };


  res.json({
    message: 'This is a placeholder for comparison data with anonymized similar users. Implement specific aggregation logic here.',
    globalAverageProgress: averageProgressAcrossAllUsers,
    globalAverageFeedbackDistribution: averageGoalsPerDomain,
    // ... more comparison metrics
  });
});
