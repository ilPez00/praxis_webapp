import { Request, Response } from 'express';
import { MatchingEngineService } from '../services/MatchingEngineService';
import { supabase } from '../lib/supabaseClient';
import { GoalTree } from '../models/GoalTree';
import { User } from '../models/User'; // Assuming a User model exists

const matchingEngine = new MatchingEngineService();

export const getMatchesForUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // 1. Fetch the requesting user's goal tree
    const { data: userGoalTree, error: userGoalTreeError } = await supabase
      .from('goal_trees')
      .select('*')
      .eq('userId', userId)
      .single();

    if (userGoalTreeError && userGoalTreeError.code !== 'PGRST116') {
      return res.status(500).json({ message: userGoalTreeError.message });
    }
    if (!userGoalTree) {
      return res.status(404).json({ message: 'User goal tree not found.' });
    }

    // 2. Fetch all other users' goal trees
    const { data: allGoalTrees, error: allGoalTreesError } = await supabase
      .from('goal_trees')
      .select('*')
      .neq('userId', userId);

    if (allGoalTreesError) {
      return res.status(500).json({ message: allGoalTreesError.message });
    }

    const potentialMatches: { user: string; score: number; goalTree: GoalTree }[] = [];

    for (const otherGoalTree of allGoalTrees || []) {
      const score = matchingEngine.calculateCompatibilityScore(userGoalTree as GoalTree, otherGoalTree as GoalTree);
      if (score > 0) { // Only consider matches with a positive score
        potentialMatches.push({ user: otherGoalTree.userId, score, goalTree: otherGoalTree as GoalTree });
      }
    }

    // Sort by score in descending order
    potentialMatches.sort((a, b) => b.score - a.score);

    // For now, let's just return the user IDs and their scores.
    // In a real application, you'd probably fetch more user details.
    res.json(potentialMatches.map(match => ({ userId: match.user, score: match.score })));

  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
