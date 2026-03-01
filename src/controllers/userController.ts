import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, InternalServerError, BadRequestError } from '../utils/appErrors'; // Import custom errors and catchAsync

// ---------------------------------------------------------------------------
// Leaderboard
// GET /users/leaderboard?userId=<uuid>
// Returns top 10 users by praxis_points, sorted by domain-similarity first
// when a userId is provided.
// ---------------------------------------------------------------------------
export const getLeaderboard = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.query as { userId?: string };

  // 1. Fetch top 50 profiles by praxis_points
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, praxis_points, is_premium')
    .order('praxis_points', { ascending: false })
    .limit(50);

  if (profilesError) {
    logger.error('Leaderboard profiles query error:', profilesError.message);
    // Return empty rather than 500 if table columns are missing
    return res.status(200).json([]);
  }

  const profileList = profiles ?? [];
  if (profileList.length === 0) return res.status(200).json([]);

  // 2. Fetch goal_trees for all those users in one query
  const profileIds = profileList.map((p) => p.id);
  const { data: goalTrees } = await supabase
    .from('goal_trees')
    .select('"userId", nodes')
    .in('"userId"', profileIds);

  // Build a map: userId → Set of domains
  const domainsByUser: Record<string, Set<string>> = {};
  for (const tree of goalTrees ?? []) {
    const uid = (tree as any).userId;
    const nodes: any[] = Array.isArray((tree as any).nodes) ? (tree as any).nodes : [];
    const domains = new Set<string>();
    for (const node of nodes) {
      if (node?.domain) domains.add(node.domain);
    }
    domainsByUser[uid] = domains;
  }

  // 3. Determine current user's domains (for similarity scoring)
  let currentUserDomains: Set<string> = new Set();
  if (userId) {
    const { data: myTree } = await supabase
      .from('goal_trees')
      .select('nodes')
      .eq('"userId"', userId)
      .single();
    const myNodes: any[] = Array.isArray(myTree?.nodes) ? myTree!.nodes : [];
    for (const node of myNodes) {
      if (node?.domain) currentUserDomains.add(node.domain);
    }
  }

  // 4. Score each profile
  const scored = profileList.map((profile, index) => {
    const theirDomains = domainsByUser[profile.id] ?? new Set<string>();
    let similarity = 0;
    if (currentUserDomains.size > 0 && theirDomains.size > 0) {
      let overlap = 0;
      for (const d of Array.from(currentUserDomains)) {
        if (theirDomains.has(d)) overlap++;
      }
      const union = new Set([...Array.from(currentUserDomains), ...Array.from(theirDomains)]).size;
      similarity = overlap / union; // Jaccard similarity [0,1]
    }
    return {
      ...profile,
      rank: index + 1, // rank by raw points before similarity re-sort
      similarity: Math.round(similarity * 100),
      domains: Array.from(theirDomains),
    };
  });

  // 5. Re-sort: 70% praxis_points weight + 30% similarity boost
  const maxPoints = scored[0]?.praxis_points ?? 1;
  const reranked = scored
    .map((s) => ({
      ...s,
      score: 0.7 * (s.praxis_points / Math.max(maxPoints, 1)) + 0.3 * (s.similarity / 100),
    }))
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }))
    .slice(0, 10);

  return res.status(200).json(reranked);
});

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

/**
 * POST /users/:id/verify
 * Records successful client-side identity verification by setting is_verified = true.
 * No auth required — the face check happened client-side; this just records the result.
 */
export const verifyIdentity = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: true })
    .eq('id', id);
  if (error) {
    logger.error('Supabase error verifying identity:', error.message);
    throw new InternalServerError('Failed to verify identity.');
  }
  res.status(200).json({ message: 'Identity verified.' });
});


