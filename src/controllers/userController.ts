import { Request, Response } from 'express';
import { mockDatabase } from '../services/MockDatabase';
import { User } from '../models/User';
import { GoalNode } from '../models/GoalNode';
import { v4 as uuidv4 } from 'uuid';

export const getUserProfile = (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json(user);
};

export const updateUserProfile = (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, age, bio } = req.body;

  let user = mockDatabase.getUserById(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (name !== undefined) user.name = name;
  if (age !== undefined) user.age = age;
  if (bio !== undefined) user.bio = bio;
  // goalTree update logic removed

  const updatedUser = mockDatabase.updateUser(user);

  if (!updatedUser) {
    return res.status(500).json({ message: 'Failed to update user profile.' });
  }

  res.status(200).json({ message: 'User profile updated successfully.', user: updatedUser });
};


