import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { MatchingEngineService } from '../services/MatchingEngineService';
import { supabase } from '../lib/supabaseClient';
import { GoalTree } from '../models/GoalTree';
import { User } from '../models/User'; // Assuming a User model exists
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync

const matchingEngine = new MatchingEngineService();

export const getMatchesForUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;

  // 1. Fetch the requesting user's goal tree
  const { data: userGoalTree, error: userGoalTreeError } = await supabase
    .from('goal_trees')
    .select('*')
    .eq('userId', userId)
    .single();

  if (userGoalTreeError && userGoalTreeError.code !== 'PGRST116') {
    logger.error('Supabase error fetching user goal tree:', userGoalTreeError.message);
    throw new InternalServerError('Failed to fetch user goal tree.');
  }
  if (!userGoalTree) {
    throw new NotFoundError('User goal tree not found.');
  }

  // 2. Fetch all other users' goal trees
  const { data: allGoalTrees, error: allGoalTreesError } = await supabase
    .from('goal_trees')
    .select('*')
    .neq('userId', userId);

  if (allGoalTreesError) {
    logger.error('Supabase error fetching all other goal trees:', allGoalTreesError.message);
    throw new InternalServerError('Failed to fetch other users\' goal trees.');
  }

  const potentialMatches: { user: string; score: number; goalTree: GoalTree }[] = [];

  for (const otherGoalTree of allGoalTrees || []) {
    const score = await matchingEngine.calculateCompatibilityScore(userGoalTree as GoalTree, otherGoalTree as GoalTree);
    if (score > 0) { // Only consider matches with a positive score
      potentialMatches.push({ user: otherGoalTree.userId, score, goalTree: otherGoalTree as GoalTree });
    }
  }

  // Sort by score in descending order
  potentialMatches.sort((a, b) => b.score - a.score);

  // For now, let's just return the user IDs and their scores.
  // In a real application, you'd probably fetch more user details.
  res.json(potentialMatches.map(match => ({ userId: match.user, score: match.score })));
});
