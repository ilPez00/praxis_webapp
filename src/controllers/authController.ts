import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient'; // Import the backend Supabase client
import logger from '../utils/logger'; // Import the logger
import { catchAsync, BadRequestError, UnauthorizedError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync

export const signup = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, name, age, bio } = req.body;

  if (!email || !password || !name || !age || !bio) {
    throw new BadRequestError('All fields are required for signup.');
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
    logger.error('Supabase signup error:', error.message);
    // Supabase can return 400 for existing user, etc.
    throw new BadRequestError(error.message);
  }

  // Supabase takes care of user creation.
  // The handle_new_user trigger in Supabase will create the profile in public.profiles table.
  res.status(201).json({ message: 'User registered successfully. Please check your email for verification.', user: data.user });
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Email and password are required for login.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logger.error('Supabase login error:', error.message);
    throw new UnauthorizedError(error.message); // Unauthorized for bad credentials
  }

  // Supabase takes care of authentication.
  // We can return the user info from the session.
  res.status(200).json({ message: 'Login successful.', user: data.user });
});
