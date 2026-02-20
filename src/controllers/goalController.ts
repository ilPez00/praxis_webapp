import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import { GoalTree } from '../models/GoalTree'; // Type definition for GoalTree
import { GoalNode } from '../models/GoalNode'; // Type definition for GoalNode
import { Domain } from '../models/Domain'; // Enum for Goal Domain
import { createAchievementFromGoal } from './achievementController'; // Import function to create achievements from goals
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync

/**
 * @description Computes the new streak values based on last activity date.
 * Rules:
 *   - If last activity was today: no change (already counted)
 *   - If last activity was yesterday: increment streak
 *   - If last activity was > 1 day ago (or never): reset to 1
 */
const computeStreakUpdate = (
  lastActivityDate: string | null | undefined,
  currentStreak: number
): { current_streak: number; last_activity_date: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  if (!lastActivityDate) {
    return { current_streak: 1, last_activity_date: todayStr };
  }

  const last = new Date(lastActivityDate);
  last.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);

  if (diffDays === 0) {
    // Already logged today — keep streak unchanged
    return { current_streak: currentStreak, last_activity_date: todayStr };
  } else if (diffDays === 1) {
    // Consecutive day — extend streak
    return { current_streak: currentStreak + 1, last_activity_date: todayStr };
  } else {
    // Streak broken — reset to 1
    return { current_streak: 1, last_activity_date: todayStr };
  }
};

/**
 * @description Helper function to fetch user profile details (name and avatar URL).
 * Used for denormalizing user info when creating achievements.
 * @param userId - The ID of the user whose profile to fetch.
 * @returns An object containing user's name and avatarUrl.
 */
const getUserProfileDetails = async (userId: string) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('name, avatar_url') // Select name and avatar_url from the profiles table
    .eq('id', userId)
    .single(); // Expect a single matching profile

  if (error) {
    // Non-fatal: achievement creation is a nice-to-have; don't block goal tree save
    logger.warn('Could not fetch user profile for achievement (non-fatal):', error.message);
    return { name: 'Unknown User', avatar_url: null };
  }
  // Return fetched profile or default values if profile is null or error occurs
  return profile || { name: 'Unknown User', avatar_url: null };
};

/**
 * @description HTTP endpoint to retrieve a user's entire goal tree.
 * @param req - The Express request object, with userId in params.
 * @param res - The Express response object.
 */
export const getGoalTree = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params; // Extract user ID from request parameters

  // Query Supabase for the goal tree associated with the userId
  const { data, error } = await supabase
    .from('goal_trees')
    .select('*') // Select all columns of the goal tree
    .eq('userId', userId)
    .single(); // Expect a single goal tree per user

  // Handle errors, excluding 'PGRST116' which indicates no rows found (expected for new users)
  if (error && error.code !== 'PGRST116') {
    logger.error('Error fetching goal tree:', error.message);
    throw new InternalServerError('Failed to fetch goal tree data.');
  }

  // Respond with the fetched goal tree or a 404 if not found
  if (data) {
    res.json(data);
  } else {
    throw new NotFoundError('Goal tree not found');
  }
});

/**
 * @description HTTP endpoint to create or update a user's goal tree.
 * This function also checks for newly completed goals and triggers achievement creation.
 * @param req - The Express request object, containing userId, nodes, and rootNodes in the body.
 * @param res - The Express response object.
 */
export const createOrUpdateGoalTree = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId, nodes, rootNodes } = req.body;

  // Fetch user's premium status and edit count
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError) {
    logger.error('Error fetching user profile for premium status:', profileError.message);
    throw new InternalServerError('Failed to retrieve user premium status.');
  }

  const isPremium = profile?.is_premium || false;
  // goal_tree_edit_count may be null if the column hasn't been added yet — treat as 0
  const editCount: number = profile?.goal_tree_edit_count ?? 0;
  const rootGoalLimit = 3;
  const safeRootNodes = rootNodes || [];

  // Enforce root goal limit for non-premium users
  if (!isPremium && safeRootNodes.length > rootGoalLimit) {
    throw new ForbiddenError(`Non-premium users are limited to ${rootGoalLimit} primary goals. Upgrade to premium for unlimited goals.`);
  }

  // --- Achievement Creation Logic ---
  // When any goal's progress reaches >= 1.0 (100%) and it wasn't completed before,
  // createAchievementFromGoal() is automatically called. This creates a public
  // achievement entry visible to the whole community on the dashboard.
  // The check compares the incoming `nodes` against the existing tree's nodes;
  // newly completed goals (progress was < 1 or node didn't exist before) trigger creation.
  let existingNodes: GoalNode[] = [];
  // Fetch the user's existing goal tree to compare against new changes
  const { data: existingTreeData, error: fetchExistingTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('userId', userId)
    .single();

  if (fetchExistingTreeError && fetchExistingTreeError.code !== 'PGRST116') {
    logger.error('Error fetching existing goal tree for achievement check:', fetchExistingTreeError.message);
    // Don't throw a critical error here, as a new user won't have an existing tree
  } else if (existingTreeData) {
    existingNodes = existingTreeData.nodes; // Store existing nodes for comparison
  }

  // Fetch user profile details to be used in achievement creation (denormalized data)
  const userProfile = await getUserProfileDetails(userId);

  // Iterate through the new set of goal nodes to identify newly completed goals
  for (const newNode of nodes) {
    // Check if a goal's progress has reached 100%
    if (newNode.progress >= 1) {
      // Find the corresponding old node to see its previous progress
      const oldNode = existingNodes.find(n => n.id === newNode.id);
      // If the goal is newly completed (wasn't completed before or didn't exist)
      if (!oldNode || oldNode.progress < 1) {
        // Trigger the creation of an achievement for this completed goal
        await createAchievementFromGoal(newNode, userId, userProfile.name, userProfile.avatar_url || undefined);
      }
    }
  }
  // --- End Achievement Creation Logic ---


  // Check if a goal tree already exists for the user
  const { data: existingTree, error: fetchError } = await supabase
    .from('goal_trees')
    .select('id')
    .eq('userId', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    logger.error('Error fetching existing goal tree for update/create:', fetchError.message);
    throw new InternalServerError('Failed to check for existing goal tree.');
  }

  if (existingTree) {
    // Re-edit gate: non-premium users only get one free re-edit after their initial setup.
    // editCount === 0 → free re-edit (initial setup doesn't count against the limit)
    // editCount >= 1 → must be premium
    if (!isPremium && editCount >= 1) {
      throw new ForbiddenError('You have used your free goal tree edit. Upgrade to Premium to make further changes.');
    }

    // If a tree exists, update it with the new nodes and root nodes
    const { data, error } = await supabase
      .from('goal_trees')
      .update({ nodes, rootNodes: safeRootNodes })
      .eq('userId', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating goal tree:', error.message);
      throw new InternalServerError('Failed to update goal tree.');
    }

    // Increment edit count + update streak (best-effort — non-fatal if columns missing)
    try {
      const streakUpdate = computeStreakUpdate(profile?.last_activity_date, profile?.current_streak ?? 0);
      await supabase
        .from('profiles')
        .update({
          goal_tree_edit_count: editCount + 1,
          ...streakUpdate,
        })
        .eq('id', userId);
    } catch (incrementErr) {
      logger.warn('Could not update goal_tree_edit_count/streak (columns may not exist yet):', incrementErr);
    }

    res.json(data); // Respond with the updated goal tree
  } else {
    // If no tree exists, create a new one
    const { data, error } = await supabase
      .from('goal_trees')
      .insert([{ userId, nodes, rootNodes: safeRootNodes }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating goal tree:', error.message);
      throw new InternalServerError('Failed to create goal tree.');
    }

    // Update streak on initial save too (best-effort)
    try {
      const streakUpdate = computeStreakUpdate(profile?.last_activity_date, profile?.current_streak ?? 0);
      await supabase.from('profiles').update(streakUpdate).eq('id', userId);
    } catch (streakErr) {
      logger.warn('Could not update streak on initial save:', streakErr);
    }

    res.status(201).json(data); // Respond with the newly created goal tree
  }
});
