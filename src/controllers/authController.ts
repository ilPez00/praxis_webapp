import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient'; // Import the backend Supabase client
// import { User } from '../models/User'; // User model type is not directly used after Supabase integration

export const signup = async (req: Request, res: Response) => { // Make function async
  const { email, password, name, age, bio } = req.body;

  if (!email || !password || !name || !age || !bio) {
    return res.status(400).json({ message: 'All fields are required for signup.' });
  }

  // Supabase handles checking if user with that email already exists
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        age,
        bio,
      },
    },
  });

  if (error) {
    return res.status(400).json({ message: error.message });
  }

  // Supabase takes care of user creation.
  // The handle_new_user trigger in Supabase will create the profile in public.profiles table.
  res.status(201).json({ message: 'User registered successfully. Please check your email for verification.', user: data.user });
};

export const login = async (req: Request, res: Response) => { // Make function async
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required for login.' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ message: error.message });
  }

  // Supabase takes care of authentication.
  // We can return the user info from the session.
  res.status(200).json({ message: 'Login successful.', user: data.user });
};
