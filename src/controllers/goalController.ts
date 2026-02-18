import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import { GoalTree } from '../models/GoalTree'; // Type definition for GoalTree
import { GoalNode } from '../models/GoalNode'; // Type definition for GoalNode
import { Domain } from '../models/Domain'; // Enum for Goal Domain
import { createAchievementFromGoal } from './achievementController'; // Import function to create achievements from goals

/**
 * @description Helper function to fetch user profile details (name and avatar URL).
 * Used for denormalizing user info when creating achievements.
 * @param userId - The ID of the user whose profile to fetch.
 * @returns An object containing user's name and avatarUrl, or default values if not found.
 */
const getUserProfileDetails = async (userId: string) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('name, avatar_url') // Select name and avatar_url from the profiles table
    .eq('id', userId)
    .single(); // Expect a single matching profile

  if (error) {
    console.error('Error fetching user profile for achievement:', error);
  }
  // Return fetched profile or default values if profile is null or error occurs
  return profile || { name: 'Unknown User', avatar_url: null };
};

/**
 * @description HTTP endpoint to retrieve a user's entire goal tree.
 * @param req - The Express request object, with userId in params.
 * @param res - The Express response object.
 */
export const getGoalTree = async (req: Request, res: Response) => {
  const { userId } = req.params; // Extract user ID from request parameters

  // Query Supabase for the goal tree associated with the userId
  const { data, error } = await supabase
    .from('goal_trees')
    .select('*') // Select all columns of the goal tree
    .eq('userId', userId)
    .single(); // Expect a single goal tree per user

  // Handle errors, excluding 'PGRST116' which indicates no rows found (expected for new users)
  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ message: error.message });
  }

  // Respond with the fetched goal tree or a 404 if not found
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ message: 'Goal tree not found' });
  }
};

/**
 * @description HTTP endpoint to create or update a user's goal tree.
 * This function also checks for newly completed goals and triggers achievement creation.
 * @param req - The Express request object, containing userId, nodes, and rootNodes in the body.
 * @param res - The Express response object.
 */
export const createOrUpdateGoalTree = async (req: Request, res: Response) => {
  const { userId, nodes, rootNodes } = req.body; // Extract user ID, all goal nodes, and root nodes

  // --- Achievement Creation Logic (before updating the tree) ---
  let existingNodes: GoalNode[] = [];
  // Fetch the user's existing goal tree to compare against new changes
  const { data: existingTreeData, error: fetchExistingTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('userId', userId)
    .single();

  if (fetchExistingTreeError && fetchExistingTreeError.code !== 'PGRST116') {
    console.error('Error fetching existing goal tree for achievement check:', fetchExistingTreeError.message);
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
    return res.status(500).json({ message: fetchError.message });
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
      return res.status(500).json({ message: error.message });
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
      return res.status(500).json({ message: error.message });
    }
    res.status(201).json(data); // Respond with the newly created goal tree
  }
};
