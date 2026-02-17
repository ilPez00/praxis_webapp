import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import { GoalTree } from '../models/GoalTree';
import { Domain } from '../models/Domain';

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
