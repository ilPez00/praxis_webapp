import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { Achievement } from '../models/Achievement';
import { AchievementComment } from '../models/AchievementComment';
import { AchievementVote } from '../models/AchievementVote';
import { GoalNode } from '../models/GoalNode'; // Import GoalNode

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, res: Response) => {
  console.error('Supabase error:', error);
  res.status(500).json({ error: error.message || 'Internal server error' });
};

// --- Achievement Controllers ---

// Function to create an achievement from a completed goal
export const createAchievementFromGoal = async (
  goalNode: GoalNode,
  userId: string,
  userName: string,
  userAvatarUrl?: string
) => {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .insert({
        user_id: userId,
        user_name: userName,
        user_avatar_url: userAvatarUrl,
        goal_node_id: goalNode.id,
        title: goalNode.name,
        description: goalNode.customDetails, // Use customDetails as description
        domain: goalNode.domain,
      })
      .select();

    if (error) {
      console.error('Error creating achievement from goal in Supabase:', error);
      return null;
    }
    return data[0];
  } catch (e) {
    console.error('Error creating achievement from goal:', e);
    return null;
  }
};

// Original createAchievement for external API calls
export const createAchievement = async (req: Request, res: Response) => {
  const { userId, userName, userAvatarUrl, goalNodeId, title, description, domain } = req.body;

  if (!userId || !userName || !goalNodeId || !title || !domain) {
    return res.status(400).json({ error: 'Missing required achievement fields.' });
  }

  try {
    const { data, error } = await supabase
      .from('achievements')
      .insert({ user_id: userId, user_name: userName, user_avatar_url: userAvatarUrl, goal_node_id: goalNodeId, title, description, domain })
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(201).json(data[0]);
  } catch (e) {
    console.error('Error creating achievement:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAchievementById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return handleSupabaseError(error, res);
    }
    if (!data) {
      return res.status(404).json({ error: 'Achievement not found.' });
    }

    res.status(200).json(data);
  } catch (e) {
    console.error('Error fetching achievement by ID:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAchievements = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(200).json(data);
  } catch (e) {
    console.error('Error fetching achievements:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAchievement = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, domain } = req.body;

  try {
    const { data, error } = await supabase
      .from('achievements')
      .update({ title, description, domain })
      .eq('id', id)
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Achievement not found or not authorized to update.' });
    }

    res.status(200).json(data[0]);
  } catch (e) {
    console.error('Error updating achievement:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAchievement = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('achievements')
      .delete()
      .eq('id', id);

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(204).send(); // No content
  } catch (e) {
    console.error('Error deleting achievement:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Comment Controllers ---

export const addCommentToAchievement = async (req: Request, res: Response) => {
  const { id } = req.params; // achievementId
  const { userId, userName, userAvatarUrl, content } = req.body;

  if (!userId || !userName || !content) {
    return res.status(400).json({ error: 'Missing required comment fields.' });
  }

  try {
    const { data, error } = await supabase
      .from('achievement_comments')
      .insert({ achievement_id: id, user_id: userId, user_name: userName, user_avatar_url: userAvatarUrl, content })
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(201).json(data[0]);
  } catch (e) {
    console.error('Error adding comment:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCommentsForAchievement = async (req: Request, res: Response) => {
  const { id } = req.params; // achievementId

  try {
    const { data, error } = await supabase
      .from('achievement_comments')
      .select('*')
      .eq('achievement_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(200).json(data);
  } catch (e) {
    console.error('Error fetching comments:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateComment = async (req: Request, res: Response) => {
  const { commentId } = req.params;
  const { content } = req.body;

  try {
    const { data, error } = await supabase
      .from('achievement_comments')
      .update({ content })
      .eq('id', commentId)
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Comment not found or not authorized to update.' });
    }

    res.status(200).json(data[0]);
  } catch (e) {
    console.error('Error updating comment:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  const { commentId } = req.params;

  try {
    const { error } = await supabase
      .from('achievement_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(204).send();
  } catch (e) {
    console.error('Error deleting comment:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Vote Controllers ---

export const addVoteToAchievement = async (req: Request, res: Response) => {
  const { id } = req.params; // achievementId
  const { userId, type } = req.body; // type: 'upvote' or 'downvote'

  if (!userId || !type) {
    return res.status(400).json({ error: 'Missing required vote fields.' });
  }
  if (type !== 'upvote' && type !== 'downvote') {
    return res.status(400).json({ error: 'Invalid vote type. Must be "upvote" or "downvote".' });
  }

  try {
    // Check if user has already voted on this achievement
    const { data: existingVote, error: fetchError } = await supabase
      .from('achievement_votes')
      .select('*')
      .eq('achievement_id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found (not an actual error)
        // If there's an actual error during fetch, return it
        return handleSupabaseError(fetchError, res);
    }

    if (existingVote) {
        // If an existing vote is found, update it
        const { data, error } = await supabase
            .from('achievement_votes')
            .update({ type, created_at: new Date().toISOString() }) // Update timestamp on change
            .eq('id', existingVote.id)
            .select();

        if (error) {
            return handleSupabaseError(error, res);
        }
        return res.status(200).json(data[0]);
    } else {
        // No existing vote, insert new one
        const { data, error } = await supabase
            .from('achievement_votes')
            .insert({ achievement_id: id, user_id: userId, type })
            .select();

        if (error) {
            return handleSupabaseError(error, res);
        }
        return res.status(201).json(data[0]);
    }
  } catch (e) {
    console.error('Error adding/updating vote:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateVote = async (req: Request, res: Response) => {
  const { voteId } = req.params;
  const { type } = req.body;

  if (type !== 'upvote' && type !== 'downvote') {
    return res.status(400).json({ error: 'Invalid vote type. Must be "upvote" or "downvote".' });
  }

  try {
    const { data, error } = await supabase
      .from('achievement_votes')
      .update({ type, created_at: new Date().toISOString() }) // Update timestamp on change
      .eq('id', voteId)
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Vote not found or not authorized to update.' });
    }

    res.status(200).json(data[0]);
  } catch (e) {
    console.error('Error updating vote:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteVote = async (req: Request, res: Response) => {
  const { voteId } = req.params;

  try {
    const { error } = await supabase
      .from('achievement_votes')
      .delete()
      .eq('id', voteId);

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(204).send();
  } catch (e) {
    console.error('Error deleting vote:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};
