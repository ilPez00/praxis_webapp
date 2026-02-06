import { Request, Response } from 'express';
import { mockDatabase } from '../services/MockDatabase';
import { User } from '../models/User';
import { GoalNode } from '../models/GoalNode';
import { v4 as uuidv4 } from 'uuid';
import { matchingEngineService } from '../services/MatchingEngineService'; // Import matching service

export const getUserProfile = (req: Request, res: Response) => {
  const { id } = req.params;
  const user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json(user);
};

export const updateUserProfile = (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, age, bio, goalTree } = req.body;

  let user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (name !== undefined) user.name = name;
  if (age !== undefined) user.age = age;
  if (bio !== undefined) user.bio = bio;
  if (goalTree !== undefined) user.goalTree = goalTree;

  const updatedUser = mockDatabase.updateUser(user);

  if (!updatedUser) {
    return res.status(500).json({ message: 'Failed to update user profile.' });
  }

  res.status(200).json({ message: 'User profile updated successfully.', user: updatedUser });
};

export const getUserGoals = (req: Request, res: Response) => {
  const { id } = req.params;
  const user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json(user.goalTree);
};

export const addGoalToUser = (req: Request, res: Response) => {
  const { id } = req.params;
  const newGoalData: GoalNode = req.body;

  let user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const newGoal: GoalNode = { ...newGoalData, id: uuidv4(), subGoals: newGoalData.subGoals || [] };
  user.goalTree.push(newGoal);

  const updatedUser = mockDatabase.updateUser(user);

  if (!updatedUser) {
    return res.status(500).json({ message: 'Failed to add goal.' });
  }

  res.status(201).json({ message: 'Goal added successfully.', goal: newGoal });
};

function findAndUpdateGoal(goals: GoalNode[], goalId: string, updatedGoalData: Partial<GoalNode>): boolean {
  for (let i = 0; i < goals.length; i++) {
    if (goals[i].id === goalId) {
      goals[i] = { ...goals[i], ...updatedGoalData };
      return true;
    }
    if (goals[i].subGoals && findAndUpdateGoal(goals[i].subGoals, goalId, updatedGoalData)) {
      return true;
    }
  }
  return false;
}

export const updateUserGoal = (req: Request, res: Response) => {
  const { id, goalId } = req.params;
  const updatedGoalData: Partial<GoalNode> = req.body;

  let user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (findAndUpdateGoal(user.goalTree, goalId, updatedGoalData)) {
    const updatedUser = mockDatabase.updateUser(user);
    if (!updatedUser) {
      return res.status(500).json({ message: 'Failed to update user goal.' });
    }
    res.status(200).json({ message: 'User goal updated successfully.' });
  } else {
    res.status(404).json({ message: 'Goal not found.' });
  }
};

function findAndDeleteGoal(goals: GoalNode[], goalId: string): boolean {
  for (let i = 0; i < goals.length; i++) {
    if (goals[i].id === goalId) {
      goals.splice(i, 1);
      return true;
    }
    if (goals[i].subGoals && findAndDeleteGoal(goals[i].subGoals, goalId)) {
      return true;
    }
  }
  return false;
}

export const deleteUserGoal = (req: Request, res: Response) => {
  const { id, goalId } = req.params;

  let user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (findAndDeleteGoal(user.goalTree, goalId)) {
    const updatedUser = mockDatabase.updateUser(user);
    if (!updatedUser) {
      return res.status(500).json({ message: 'Failed to delete user goal.' });
    }
    res.status(200).json({ message: 'User goal deleted successfully.' });
  } else {
    res.status(404).json({ message: 'Goal not found.' });
  }
};

export const getUserMatches = (req: Request, res: Response) => {
  const { id } = req.params;
  const user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }
  
  // For now, we'll return previously computed matches
  // In a real scenario, this might involve fetching from a persistent store
  const matches = mockDatabase.getMatchesForUser(id);
  res.status(200).json(matches);
};

export const computeUserMatches = (req: Request, res: Response) => {
  const { id } = req.params;
  const user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const matches = matchingEngineService.findMatches(user);
  
  // In a real app, these matches would be saved persistently for the user
  // For this MVP, mockDatabase handles some saving, but it's simplified.
  res.status(200).json({ message: 'Matches computed successfully.', matches });
};

