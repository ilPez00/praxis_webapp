import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, InternalServerError, BadRequestError } from '../utils/appErrors'; // Import custom errors and catchAsync

/**
 * @description HTTP endpoint to retrieve a user's profile details.
 * @param req - The Express request object, with userId in params.
 * @param res - The Express response object.
 */
export const getUserProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params as { id: string }; // Extract user ID from request parameters

  // Query Supabase for the user's profile
  const { data, error } = await supabase
    .from('profiles')
    .select('*') // Select all columns from the profiles table
    .eq('id', id) // Filter by user ID
    .single(); // Expect a single matching profile

  // Handle Supabase query errors
  if (error) {
    logger.error('Supabase error fetching user profile:', error.message);
    throw new InternalServerError('Failed to fetch user profile.');
  }

  // If no data is returned, the user's profile was not found
  if (!data) {
    throw new NotFoundError('User not found.');
  }

  res.status(200).json(data); // Respond with the user's profile data
});

/**
 * @description HTTP endpoint to update a user's profile details.
 * This includes fields like name, age, bio, and avatarUrl.
 * Assumes authorization (that the user is updating their own profile) is handled
 * by Supabase RLS policies if enforced, or by prior middleware.
 * @param req - The Express request object, with userId in params and updated fields in body.
 * @param res - The Express response object.
 */
export const updateUserProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params as { id: string }; // Extract user ID from request parameters
  const { name, age, bio, avatarUrl } = req.body; // Extract updated profile fields from the request body

  // Update the user's profile record in Supabase
  const { data, error } = await supabase
    .from('profiles')
    .update({ name, age, bio, avatarUrl }) // Fields to update
    .eq('id', id) // Filter by user ID
    .single(); // Expect a single updated record

  // Handle Supabase update errors
  if (error) {
    logger.error('Supabase error updating user profile:', error.message);
    throw new InternalServerError('Failed to update user profile.');
  }

  // If no data is returned, the user's profile was not found or no changes were applied
  if (!data) {
    throw new NotFoundError('User not found or nothing to update.');
  }

  res.status(200).json({ message: 'User profile updated successfully.', user: data }); // Respond with success message and updated user data
});

/**
 * POST /users/complete-onboarding
 * Marks onboarding_completed = true for the given userId.
 */
export const completeOnboarding = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.body;
  if (!userId) throw new BadRequestError('userId is required.');
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', userId);
  if (error) throw new InternalServerError(`Failed to complete onboarding: ${error.message}`);
  res.status(200).json({ message: 'Onboarding complete.' });
});


