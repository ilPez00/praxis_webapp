import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { AICoachingService } from '../services/AICoachingService';
import { supabase } from '../lib/supabaseClient'; // Assuming supabase client is configured
import logger from '../utils/logger'; // Import the logger
import { catchAsync, UnauthorizedError, ForbiddenError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync

const aiCoachingService = new AICoachingService();

/**
 * @description Retrieves all goal nodes for a specific user.
 * @param userId The ID of the user.
 * @returns An array of GoalNode objects.
 */
async function getUserGoalNodes(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('userId', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Error fetching user goal nodes:', error.message);
    // In a catchAsync context, it's better to throw an error that the errorHandler can catch
    throw new InternalServerError('Failed to fetch user goal nodes for AI coaching.');
  }
  return data?.nodes || [];
}

/**
 * @description Retrieves a user's recent feedback as a receiver.
 * @param userId The ID of the user.
 * @returns An array of feedback objects.
 */
async function getUserRecentFeedback(userId: string): Promise<any[]> {
  // Fetch feedback where the user is the receiver
  const { data, error } = await supabase
    .from('feedback')
    .select('*, giver:giverId(name), goal:goalNodeId(name)') // Join to get giver's name and goal name
    .eq('receiverId', userId)
    .order('createdAt', { ascending: false })
    .limit(5); // Limit to 5 recent feedback items

  if (error) {
    logger.error('Error fetching user feedback:', error.message);
    throw new InternalServerError('Failed to fetch user feedback for AI coaching.');
  }

  // Map to a more friendly format for the AI prompt
  return data.map(fb => ({
    grade: fb.grade,
    comment: fb.comment,
    giverName: (fb.giver as any)?.name || 'Anonymous',
    goalName: (fb.goal as any)?.name || 'Unknown Goal',
  }));
}

/**
 * @description Retrieves a user's recent achievements.
 * @param userId The ID of the user.
 * @returns An array of achievement objects.
 */
async function getUserAchievements(userId: string): Promise<any[]> {
    const { data, error } = await supabase
        .from('achievements')
        .select('*, goal:goal_id(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5); // Limit to 5 recent achievements

    if (error) {
        logger.error('Error fetching user achievements:', error.message);
        throw new InternalServerError('Failed to fetch user achievements for AI coaching.');
    }
    return data.map(ach => ({
        goalName: (ach.goal as any)?.name || 'Unknown Goal',
        createdAt: ach.created_at,
    }));
}


/**
 * @description Handles requests for AI coaching.
 * Requires the user to be authenticated and premium.
 * @param req - The Express request object, with user ID from authentication and userPrompt in body.
 * @param res - The Express response object.
 */
export const requestCoaching = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userPrompt } = req.body;
  const userId = req.user?.id; // Assuming user ID is attached to req.user by authentication middleware

  if (!userId) {
    throw new UnauthorizedError('User ID not found.');
  }

  // Check if user is premium
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_premium, name')
    .eq('id', userId)
    .single();

  if (profileError) {
    logger.error('Error fetching user profile for premium check:', profileError.message);
    throw new InternalServerError('Failed to retrieve user premium status.');
  }

  if (!profile?.is_premium) {
    throw new ForbiddenError('AI Coaching is a premium feature. Please upgrade your account.');
  }

  // Gather context data for the AI coach
  const userName = profile.name;
  const goals = await getUserGoalNodes(userId);
  const recentFeedback = await getUserRecentFeedback(userId);
  const achievements = await getUserAchievements(userId);


  const context = {
    userName,
    goals,
    recentFeedback,
    achievements,
  };

  // Generate response using AICoachingService
  const aiResponse = await aiCoachingService.generateCoachingResponse(userPrompt, context);
  res.json({ response: aiResponse });
});
