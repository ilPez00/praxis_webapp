import { Request, Response } from 'express';
import { mockDatabase } from '../services/MockDatabase';
import { User } from '../models/User';
import { v4 as uuidv4 } from 'uuid'; // For generating unique user IDs

// In a real application, you would hash passwords and use JWTs for authentication.
// For this MVP, we'll keep it simple.

export const signup = (req: Request, res: Response) => {
  const { email, password, name, age, bio } = req.body;

  if (!email || !password || !name || !age || !bio) {
    return res.status(400).json({ message: 'All fields are required for signup.' });
  }

  if (mockDatabase.getUserByEmail(email)) {
    return res.status(409).json({ message: 'User with that email already exists.' });
  }

  const newUser: User = {
    id: uuidv4(), // Generate a unique ID for the new user
    email,
    name,
    age,
    bio,
    goalTree: [], // New users start with an empty goal tree
    hashedPassword: password, // Store the provided password directly for mock (in real app, this would be hashed)
  };

  mockDatabase.saveUser(newUser);

  // In a real app, you'd generate and return a JWT here
  res.status(201).json({ message: 'User registered successfully.', user: { id: newUser.id, email: newUser.email, name: newUser.name } });
};

export const login = (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required for login.' });
  }

  const user = mockDatabase.getUserByEmail(email);

  // For MVP, we're doing a direct comparison. In a real app: bcrypt.compare(password, user.hashedPassword)
  if (!user || user.hashedPassword !== password) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  // In a real app, you'd generate and return a JWT here
  res.status(200).json({ message: 'Login successful.', user: { id: user.id, email: user.email, name: user.name } });
};
