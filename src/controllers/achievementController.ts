import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient';
import { Achievement } from '../models/Achievement'; // Type definition for Achievement
import { AchievementComment } from '../models/AchievementComment'; // Type definition for AchievementComment
import { AchievementVote } from '../models/AchievementVote'; // Type definition for AchievementVote
import { GoalNode } from '../models/GoalNode'; // Import GoalNode for type checking when creating achievements from goals
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, BadRequestError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync

// Helper to ensure consistent error handling for Supabase operations
// This helper should now throw an AppError that is caught by catchAsync and then errorHandler
const handleSupabaseError = (error: any) => {
  logger.error('Supabase error:', error);
  throw new InternalServerError(error.message || 'Internal server error during Supabase operation.');
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
      logger.error('Error creating achievement from goal in Supabase:', error);
      return null;
    }

    // Award +10 Praxis Points for creating an achievement (best-effort)
    await supabase.from('profiles').select('praxis_points').eq('id', userId).single()
      .then(({ data }) => {
        if (data) supabase.from('profiles')
          .update({ praxis_points: (data.praxis_points ?? 0) + 10 })
          .eq('id', userId);
      });

    return data[0]; // Return the first (and only) inserted record
  } catch (e) {
    logger.error('Error creating achievement from goal:', e);
    return null;
  }
};

/**
 * @description HTTP endpoint to create a new achievement.
 * This can be used for achievements not directly tied to goal completion.
 * @param req - The Express request object.
 * @param res - The Express response object.
 */
export const createAchievement = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  // Extract achievement details from the request body
  const { userId, userName, userAvatarUrl, goalNodeId, title, description, domain } = req.body;

  // Validate required fields
  if (!userId || !userName || !goalNodeId || !title || !domain) {
    throw new BadRequestError('Missing required achievement fields.');
  }

  // Insert achievement into Supabase
  const { data, error } = await supabase
    .from('achievements')
    .insert({ user_id: userId, user_name: userName, user_avatar_url: userAvatarUrl, goal_node_id: goalNodeId, title, description, domain })
    .select();

  if (error) {
    handleSupabaseError(error);
  }

  if (!data) throw new InternalServerError("Insert returned no data."); res.status(201).json(data[0]); // Respond with the created achievement
});

/**
 * @description HTTP endpoint to retrieve a single achievement by its ID.
 * @param req - The Express request object, with achievement ID in params.
 * @param res - The Express response object.
 */
export const getAchievementById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // Extract achievement ID from request parameters

  // Query Supabase for the achievement
  const { data, error } = await supabase
    .from('achievements')
    .select('*') // Select all columns
    .eq('id', id) // Filter by ID
    .single(); // Expect a single result

  if (error) {
    handleSupabaseError(error);
  }
  // If no data is returned, the achievement was not found
  if (!data) {
    throw new NotFoundError('Achievement not found.');
  }

  res.status(200).json(data); // Respond with the achievement data
});

/**
 * @description HTTP endpoint to retrieve a list of all achievements.
 * Achievements are ordered by creation date in descending order.
 * @param req - The Express request object.
 * @param res - The Express response object.
 */
export const getAchievements = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('created_at', { ascending: false });

  // Return empty array if table doesn't exist yet (schema cache miss during setup)
  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found')) {
      logger.warn('achievements table not found — returning empty list. Run migrations/setup.sql.');
      return res.status(200).json([]);
    }
    handleSupabaseError(error);
  }

  res.status(200).json(data ?? []);
});

/**
 * @description HTTP endpoint to update an existing achievement.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with achievement ID in params and updated fields in body.
 * @param res - The Express response object.
 */
export const updateAchievement = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // Achievement ID to update
  const { title, description, domain } = req.body; // Fields to update

  // Update the achievement record in Supabase
  const { data, error } = await supabase
    .from('achievements')
    .update({ title, description, domain })
    .eq('id', id)
    .select(); // Select the updated record

  if (error) {
    handleSupabaseError(error);
  }
  // If no data is returned, the achievement was not found or not authorized for update
  if (!data || data.length === 0) {
    throw new NotFoundError('Achievement not found or not authorized to update.');
  }

  res.status(200).json(data[0]); // Respond with the updated achievement
});

/**
 * @description HTTP endpoint to delete an achievement.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with achievement ID in params.
 * @param res - The Express response object.
 */
export const deleteAchievement = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // Achievement ID to delete

  // Delete the achievement record from Supabase
  const { error } = await supabase
    .from('achievements')
    .delete()
    .eq('id', id); // Filter by ID

  if (error) {
    handleSupabaseError(error);
  }

  res.status(204).send(); // Respond with no content for successful deletion
});

// --- Comment Controllers ---

/**
 * @description HTTP endpoint to add a new comment to an achievement.
 * @param req - The Express request object, with achievement ID in params and comment details in body.
 * @param res - The Express response object.
 */
export const addCommentToAchievement = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // The achievement ID the comment belongs to
  const { userId, userName, userAvatarUrl, content } = req.body; // Comment details

  // Validate required fields
  if (!userId || !userName || !content) {
    throw new BadRequestError('Missing required comment fields.');
  }

  // Insert new comment into the 'achievement_comments' table
  const { data, error } = await supabase
    .from('achievement_comments')
    .insert({ achievement_id: id, user_id: userId, user_name: userName, user_avatar_url: userAvatarUrl, content })
    .select();

  if (error) {
    handleSupabaseError(error);
  }

  if (!data) throw new InternalServerError("Insert returned no data."); res.status(201).json(data[0]); // Respond with the created comment
});

/**
 * @description HTTP endpoint to retrieve all comments for a specific achievement.
 * Comments are ordered by creation date.
 * @param req - The Express request object, with achievement ID in params.
 * @param res - The Express response object.
 */
export const getCommentsForAchievement = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // Achievement ID to fetch comments for

  // Fetch comments from Supabase, filtered by achievement ID
  const { data, error } = await supabase
    .from('achievement_comments')
    .select('*')
    .eq('achievement_id', id)
    .order('created_at', { ascending: true }); // Order by creation date (oldest first)

  if (error) {
    handleSupabaseError(error);
  }

  res.status(200).json(data); // Respond with the list of comments
});

/**
 * @description HTTP endpoint to update an existing comment.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with comment ID in params and updated content in body.
 * @param res - The Express response object.
 */
export const updateComment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { commentId } = req.params; // Comment ID to update
  const { content } = req.body; // New comment content

  // Update comment content in Supabase
  const { data, error } = await supabase
    .from('achievement_comments')
    .update({ content })
    .eq('id', commentId)
    .select();

  if (error) {
    handleSupabaseError(error);
  }
  // If no data, comment not found or not authorized
  if (!data || data.length === 0) {
    throw new NotFoundError('Comment not found or not authorized to update.');
  }

  res.status(200).json(data[0]); // Respond with the updated comment
});

/**
 * @description HTTP endpoint to delete a comment.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with comment ID in params.
 * @param res - The Express response object.
 */
export const deleteComment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { commentId } = req.params; // Comment ID to delete

  // Delete comment from Supabase
  const { error } = await supabase
    .from('achievement_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    handleSupabaseError(error);
  }

  res.status(204).send(); // Respond with no content
});

// --- Vote Controllers ---

/**
 * @description HTTP endpoint to add or update a user's vote on an achievement.
 * A user can only have one vote (upvote or downvote) per achievement.
 * @param req - The Express request object, with achievement ID in params and vote details in body.
 * @param res - The Express response object.
 */
export const addVoteToAchievement = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params; // achievementId
  const { userId, type } = req.body; // type: 'upvote' or 'downvote'

  // Validate required fields and vote type
  if (!userId || !type) {
    throw new BadRequestError('Missing required vote fields.');
  }
  if (type !== 'upvote' && type !== 'downvote') {
    throw new BadRequestError('Invalid vote type. Must be "upvote" or "downvote".');
  }

  // Check if the user has already voted on this achievement
  const { data: existingVote, error: fetchError } = await supabase
    .from('achievement_votes')
    .select('*')
    .eq('achievement_id', id)
    .eq('user_id', userId)
    .single();

  // PGRST116 means no rows found, which is not an error here, but a valid state
  if (fetchError && fetchError.code !== 'PGRST116') {
      handleSupabaseError(fetchError);
  }

  if (existingVote) {
      // If an existing vote is found, update it with the new type and timestamp
      const { data, error } = await supabase
          .from('achievement_votes')
          .update({ type, created_at: new Date().toISOString() })
          .eq('id', existingVote.id)
          .select();

      if (error) {
          handleSupabaseError(error);
      }
      if (!data) throw new InternalServerError("Update returned no data.");
      return res.status(200).json(data[0]); // Respond with the updated vote
  } else {
      // If no existing vote, insert a new one
      const { data, error } = await supabase
          .from('achievement_votes')
          .insert({ achievement_id: id, user_id: userId, type })
          .select();

      if (error) {
          handleSupabaseError(error);
      }
      if (!data) throw new InternalServerError("Insert returned no data.");
      return res.status(201).json(data[0]); // Respond with the new vote
  }
});

/**
 * @description HTTP endpoint to update a user's vote on an achievement.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with vote ID in params and new vote type in body.
 * @param res - The Express response object.
 */
export const updateVote = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { voteId } = req.params; // Vote ID to update
  const { type } = req.body; // New vote type

  // Validate vote type
  if (type !== 'upvote' && type !== 'downvote') {
    throw new BadRequestError('Invalid vote type. Must be "upvote" or "downvote".');
  }

  // Update the vote record in Supabase
  const { data, error } = await supabase
    .from('achievement_votes')
    .update({ type, created_at: new Date().toISOString() })
    .eq('id', voteId)
    .select();

  if (error) {
    handleSupabaseError(error);
  }
  // If no data, vote not found or not authorized
  if (!data || data.length === 0) {
    throw new NotFoundError('Vote not found or not authorized to update.');
  }

  res.status(200).json(data[0]); // Respond with the updated vote
});

/**
 * @description HTTP endpoint to delete a user's vote on an achievement.
 * Assumes authorization is handled by RLS policies on Supabase.
 * @param req - The Express request object, with vote ID in params.
 * @param res - The Express response object.
 */
export const deleteVote = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { voteId } = req.params; // Vote ID to delete

  // Delete the vote record from Supabase
  const { error } = await supabase
    .from('achievement_votes')
    .delete()
    .eq('id', voteId);

  if (error) {
    handleSupabaseError(error);
  }

  res.status(204).send(); // Respond with no content
});
