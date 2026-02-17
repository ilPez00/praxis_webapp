import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client

export const getUserProfile = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  if (!data) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json(data);
};

export const updateUserProfile = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, age, bio } = req.body;

  const { data, error } = await supabase
    .from('profiles')
    .update({ name, age, bio })
    .eq('id', id)
    .single();

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  if (!data) {
    return res.status(404).json({ message: 'User not found or nothing to update.' });
  }

  res.status(200).json({ message: 'User profile updated successfully.', user: data });
};


