import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode'; // Import GoalNode for type checking
import { Domain } from '../models/Domain';
import { createAchievementFromGoal } from './achievementController'; // Import the new function

// Helper to get user profile details
const getUserProfileDetails = async (userId: string) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('name, avatarUrl')
    .eq('id', userId)
    .single();
  if (error) console.error('Error fetching user profile for achievement:', error);
  return profile || { name: 'Unknown User', avatarUrl: null };
};

export const getGoalTree = async (req: Request, res: Response) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('goal_trees')
    .select('*')
    .eq('userId', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    return res.status(500).json({ message: error.message });
  }

  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ message: 'Goal tree not found' });
  }
};

export const createOrUpdateGoalTree = async (req: Request, res: Response) => {
  const { userId, nodes, rootNodes } = req.body;

  // Fetch existing tree and user profile for achievement creation logic
  let existingNodes: GoalNode[] = [];
  const { data: existingTreeData, error: fetchExistingTreeError } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('userId', userId)
    .single();

  if (fetchExistingTreeError && fetchExistingTreeError.code !== 'PGRST116') {
    console.error('Error fetching existing goal tree for achievement check:', fetchExistingTreeError.message);
  } else if (existingTreeData) {
    existingNodes = existingTreeData.nodes;
  }

  const userProfile = await getUserProfileDetails(userId);


  // Check for newly completed goals
  for (const newNode of nodes) {
    if (newNode.progress >= 1) { // Goal is completed
      const oldNode = existingNodes.find(n => n.id === newNode.id);
      if (!oldNode || oldNode.progress < 1) { // It's a newly completed goal
        await createAchievementFromGoal(newNode, userId, userProfile.name, userProfile.avatarUrl || undefined);
      }
    }
  }

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
    // Update existing tree
    const { data, error } = await supabase
      .from('goal_trees')
      .update({ nodes, rootNodes })
      .eq('userId', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: error.message });
    }
    res.json(data);
  } else {
    // Create new tree
    const { data, error } = await supabase
      .from('goal_trees')
      .insert([{ userId, nodes, rootNodes }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: error.message });
    }
    res.status(201).json(data);
  }
};
