import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import { GoalTree } from '../models/GoalTree'; // Type definition for GoalTree
import { GoalNode } from '../models/GoalNode'; // Type definition for GoalNode
import { Domain } from '../models/Domain'; // Enum for Goal Domain
import { createAchievementFromGoal } from './achievementController'; // Import function to create achievements from goals
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync

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
    logger.error('Error fetching user profile for achievement:', error);
    throw new InternalServerError('Failed to fetch user profile details.');
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

  // Fetch user's premium status
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', userId)
    .single();

  if (profileError) {
    logger.error('Error fetching user profile for premium status:', profileError.message);
    throw new InternalServerError('Failed to retrieve user premium status.');
  }

  const isPremium = profile?.is_premium || false;
  const rootGoalLimit = 3;

  // Enforce root goal limit for non-premium users
  if (!isPremium && rootNodes.length > rootGoalLimit) {
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
    // If a tree exists, update it with the new nodes and root nodes
    const { data, error } = await supabase
      .from('goal_trees')
      .update({ nodes, rootNodes })
      .eq('userId', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating goal tree:', error.message);
      throw new InternalServerError('Failed to update goal tree.');
    }
    res.json(data); // Respond with the updated goal tree
  } else {
    // If no tree exists, create a new one
    const { data, error } = await supabase
      .from('goal_trees')
      .insert([{ userId, nodes, rootNodes }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating goal tree:', error.message);
      throw new InternalServerError('Failed to create goal tree.');
    }
    res.status(201).json(data); // Respond with the newly created goal tree
  }
});
