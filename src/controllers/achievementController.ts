import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { Achievement } from '../models/Achievement'; // Type definition for Achievement
import { AchievementComment } from '../models/AchievementComment'; // Type definition for AchievementComment
import { AchievementVote } from '../models/AchievementVote'; // Type definition for AchievementVote
import { GoalNode } from '../models/GoalNode'; // Import GoalNode for type checking when creating achievements from goals

// Helper to ensure consistent error handling for Supabase operations
const handleSupabaseError = (error: any, res: Response) => {
  console.error('Supabase error:', error);
  // Send a generic 500 status if no specific error code is available
  res.status(500).json({ error: error.message || 'Internal server error' });
};

// --- Achievement Controllers ---

/**
 * @description Creates an achievement record in Supabase, typically triggered internally
 * when a user completes a goal. This function does not handle HTTP requests directly.
 * @param goalNode - The GoalNode object that was completed.
 * @param userId - The ID of the user who completed the goal.
 * @param userName - The name of the user (denormalized for display).
 * @param userAvatarUrl - The avatar URL of the user (denormalized for display, optional).
 * @returns The created achievement data or null on error.
 */
export const createAchievementFromGoal = async (
  goalNode: GoalNode,
  userId: string,
  userName: string,
  userAvatarUrl?: string
) => {
  try {
    // Insert a new achievement record into the 'achievements' table
    const { data, error } = await supabase
      .from('achievements')
      .insert({
        user_id: userId,
        user_name: userName,
        user_avatar_url: userAvatarUrl,
        goal_node_id: goalNode.id,
        title: goalNode.name, // Goal name becomes achievement title
        description: goalNode.customDetails, // Custom details become achievement description
        domain: goalNode.domain,
      })
      .select(); // Select the newly inserted data

    if (error) {
      console.error('Error creating achievement from goal in Supabase:', error);
      return null;
    }
    return data[0]; // Return the first (and only) inserted record
  } catch (e) {
    console.error('Error creating achievement from goal:', e);
    return null;
  }
};

/**
 * @description HTTP endpoint to create a new achievement.
 * This can be used for achievements not directly tied to goal completion.
 * @param req - The Express request object.
 * @param res - The Express response object.
 */
export const createAchievement = async (req: Request, res: Response) => {
  // Extract achievement details from the request body
  const { userId, userName, userAvatarUrl, goalNodeId, title, description, domain } = req.body;

  // Validate required fields
  if (!userId || !userName || !goalNodeId || !title || !domain) {
    return res.status(400).json({ error: 'Missing required achievement fields.' });
  }

  try {
    // Insert achievement into Supabase
    const { data, error } = await supabase
      .from('achievements')
      .insert({ user_id: userId, user_name: userName, user_avatar_url: userAvatarUrl, goal_node_id: goalNodeId, title, description, domain })
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(201).json(data[0]); // Respond with the created achievement
  } catch (e) {
    console.error('Error creating achievement:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to retrieve a single achievement by its ID.
 * @param req - The Express request object, with achievement ID in params.
 * @param res - The Express response object.
 */
export const getAchievementById = async (req: Request, res: Response) => {
  const { id } = req.params; // Extract achievement ID from request parameters

  try {
    // Query Supabase for the achievement
    const { data, error } = await supabase
      .from('achievements')
      .select('*') // Select all columns
      .eq('id', id) // Filter by ID
      .single(); // Expect a single result

    if (error) {
      return handleSupabaseError(error, res);
    }
    // If no data is returned, the achievement was not found
    if (!data) {
      return res.status(404).json({ error: 'Achievement not found.' });
    }

    res.status(200).json(data); // Respond with the achievement data
  } catch (e) {
    console.error('Error fetching achievement by ID:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to retrieve a list of all achievements.
 * Achievements are ordered by creation date in descending order.
 * @param req - The Express request object.
 * @param res - The Express response object.
 */
export const getAchievements = async (req: Request, res: Response) => {
  try {
    // Fetch all achievements from Supabase
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('created_at', { ascending: false }); // Order by creation date (newest first)

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(200).json(data); // Respond with the list of achievements
  } catch (e) {
    console.error('Error fetching achievements:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to update an existing achievement.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with achievement ID in params and updated fields in body.
 * @param res - The Express response object.
 */
export const updateAchievement = async (req: Request, res: Response) => {
  const { id } = req.params; // Achievement ID to update
  const { title, description, domain } = req.body; // Fields to update

  try {
    // Update the achievement record in Supabase
    const { data, error } = await supabase
      .from('achievements')
      .update({ title, description, domain })
      .eq('id', id)
      .select(); // Select the updated record

    if (error) {
      return handleSupabaseError(error, res);
    }
    // If no data is returned, the achievement was not found or not authorized for update
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Achievement not found or not authorized to update.' });
    }

    res.status(200).json(data[0]); // Respond with the updated achievement
  } catch (e) {
    console.error('Error updating achievement:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to delete an achievement.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with achievement ID in params.
 * @param res - The Express response object.
 */
export const deleteAchievement = async (req: Request, res: Response) => {
  const { id } = req.params; // Achievement ID to delete

  try {
    // Delete the achievement record from Supabase
    const { error } = await supabase
      .from('achievements')
      .delete()
      .eq('id', id); // Filter by ID

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(204).send(); // Respond with no content for successful deletion
  } catch (e) {
    console.error('Error deleting achievement:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Comment Controllers ---

/**
 * @description HTTP endpoint to add a new comment to an achievement.
 * @param req - The Express request object, with achievement ID in params and comment details in body.
 * @param res - The Express response object.
 */
export const addCommentToAchievement = async (req: Request, res: Response) => {
  const { id } = req.params; // The achievement ID the comment belongs to
  const { userId, userName, userAvatarUrl, content } = req.body; // Comment details

  // Validate required fields
  if (!userId || !userName || !content) {
    return res.status(400).json({ error: 'Missing required comment fields.' });
  }

  try {
    // Insert new comment into the 'achievement_comments' table
    const { data, error } = await supabase
      .from('achievement_comments')
      .insert({ achievement_id: id, user_id: userId, user_name: userName, user_avatar_url: userAvatarUrl, content })
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(201).json(data[0]); // Respond with the created comment
  } catch (e) {
    console.error('Error adding comment:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to retrieve all comments for a specific achievement.
 * Comments are ordered by creation date.
 * @param req - The Express request object, with achievement ID in params.
 * @param res - The Express response object.
 */
export const getCommentsForAchievement = async (req: Request, res: Response) => {
  const { id } = req.params; // Achievement ID to fetch comments for

  try {
    // Fetch comments from Supabase, filtered by achievement ID
    const { data, error } = await supabase
      .from('achievement_comments')
      .select('*')
      .eq('achievement_id', id)
      .order('created_at', { ascending: true }); // Order by creation date (oldest first)

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(200).json(data); // Respond with the list of comments
  } catch (e) {
    console.error('Error fetching comments:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to update an existing comment.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with comment ID in params and updated content in body.
 * @param res - The Express response object.
 */
export const updateComment = async (req: Request, res: Response) => {
  const { commentId } = req.params; // Comment ID to update
  const { content } = req.body; // New comment content

  try {
    // Update comment content in Supabase
    const { data, error } = await supabase
      .from('achievement_comments')
      .update({ content })
      .eq('id', commentId)
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }
    // If no data, comment not found or not authorized
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Comment not found or not authorized to update.' });
    }

    res.status(200).json(data[0]); // Respond with the updated comment
  } catch (e) {
    console.error('Error updating comment:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to delete a comment.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with comment ID in params.
 * @param res - The Express response object.
 */
export const deleteComment = async (req: Request, res: Response) => {
  const { commentId } = req.params; // Comment ID to delete

  try {
    // Delete comment from Supabase
    const { error } = await supabase
      .from('achievement_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(204).send(); // Respond with no content
  } catch (e) {
    console.error('Error deleting comment:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Vote Controllers ---

/**
 * @description HTTP endpoint to add or update a user's vote on an achievement.
 * A user can only have one vote (upvote or downvote) per achievement.
 * @param req - The Express request object, with achievement ID in params and vote details in body.
 * @param res - The Express response object.
 */
export const addVoteToAchievement = async (req: Request, res: Response) => {
  const { id } = req.params; // achievementId
  const { userId, type } = req.body; // type: 'upvote' or 'downvote'

  // Validate required fields and vote type
  if (!userId || !type) {
    return res.status(400).json({ error: 'Missing required vote fields.' });
  }
  if (type !== 'upvote' && type !== 'downvote') {
    return res.status(400).json({ error: 'Invalid vote type. Must be "upvote" or "downvote".' });
  }

  try {
    // Check if the user has already voted on this achievement
    const { data: existingVote, error: fetchError } = await supabase
      .from('achievement_votes')
      .select('*')
      .eq('achievement_id', id)
      .eq('user_id', userId)
      .single();

    // PGRST116 means no rows found, which is not an error here, but a valid state
    if (fetchError && fetchError.code !== 'PGRST116') {
        return handleSupabaseError(fetchError, res);
    }

    if (existingVote) {
        // If an existing vote is found, update it with the new type and timestamp
        const { data, error } = await supabase
            .from('achievement_votes')
            .update({ type, created_at: new Date().toISOString() })
            .eq('id', existingVote.id)
            .select();

        if (error) {
            return handleSupabaseError(error, res);
        }
        return res.status(200).json(data[0]); // Respond with the updated vote
    } else {
        // If no existing vote, insert a new one
        const { data, error } = await supabase
            .from('achievement_votes')
            .insert({ achievement_id: id, user_id: userId, type })
            .select();

        if (error) {
            return handleSupabaseError(error, res);
        }
        return res.status(201).json(data[0]); // Respond with the new vote
    }
  } catch (e) {
    console.error('Error adding/updating vote:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to update a user's vote on an achievement.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with vote ID in params and new vote type in body.
 * @param res - The Express response object.
 */
export const updateVote = async (req: Request, res: Response) => {
  const { voteId } = req.params; // Vote ID to update
  const { type } = req.body; // New vote type

  // Validate vote type
  if (type !== 'upvote' && type !== 'downvote') {
    return res.status(400).json({ error: 'Invalid vote type. Must be "upvote" or "downvote".' });
  }

  try {
    // Update the vote record in Supabase
    const { data, error } = await supabase
      .from('achievement_votes')
      .update({ type, created_at: new Date().toISOString() })
      .eq('id', voteId)
      .select();

    if (error) {
      return handleSupabaseError(error, res);
    }
    // If no data, vote not found or not authorized
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Vote not found or not authorized to update.' });
    }

    res.status(200).json(data[0]); // Respond with the updated vote
  } catch (e) {
    console.error('Error updating vote:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @description HTTP endpoint to delete a user's vote on an achievement.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with vote ID in params.
 * @param res - The Express response object.
 */
export const deleteVote = async (req: Request, res: Response) => {
  const { voteId } = req.params; // Vote ID to delete

  try {
    // Delete the vote record from Supabase
    const { error } = await supabase
      .from('achievement_votes')
      .delete()
      .eq('id', voteId);

    if (error) {
      return handleSupabaseError(error, res);
    }

    res.status(204).send(); // Respond with no content
  } catch (e) {
    console.error('Error deleting vote:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
};
