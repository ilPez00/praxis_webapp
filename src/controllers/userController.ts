import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client

/**
 * @description HTTP endpoint to retrieve a user's profile details.
 * @param req - The Express request object, with userId in params.
 * @param res - The Express response object.
 */
export const getUserProfile = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string }; // Extract user ID from request parameters

  // Query Supabase for the user's profile
  const { data, error } = await supabase
    .from('profiles')
    .select('*') // Select all columns from the profiles table
    .eq('id', id) // Filter by user ID
    .single(); // Expect a single matching profile

  // Handle Supabase query errors
  if (error) {
    return res.status(500).json({ message: error.message });
  }

  // If no data is returned, the user's profile was not found
  if (!data) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json(data); // Respond with the user's profile data
};

/**
 * @description HTTP endpoint to update a user's profile details.
 * This includes fields like name, age, bio, and avatarUrl.
 * Assumes authorization (that the user is updating their own profile) is handled
 * by Supabase RLS policies if enforced, or by prior middleware.
 * @param req - The Express request object, with userId in params and updated fields in body.
 * @param res - The Express response object.
 */
export const updateUserProfile = async (req: Request, res: Response) => {
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
    return res.status(500).json({ message: error.message });
  }

  // If no data is returned, the user's profile was not found or no changes were applied
  if (!data) {
    return res.status(404).json({ message: 'User not found or nothing to update.' });
  }

  res.status(200).json({ message: 'User profile updated successfully.', user: data }); // Respond with success message and updated user data
};


