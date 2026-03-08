import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, InternalServerError, BadRequestError, UnauthorizedError } from '../utils/appErrors'; // Import custom errors and catchAsync

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
    .select('id, name, avatar_url, praxis_points, is_premium, current_streak, reliability_score, honor_score')
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

// ---------------------------------------------------------------------------
// GET /users/nearby?userId=<uuid>&radiusKm=100
// Returns users within radiusKm of the requesting user (requires lat/lng on profiles)
// ---------------------------------------------------------------------------
export const getNearbyUsers = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, radiusKm = '100' } = req.query as { userId?: string; radiusKm?: string };
  if (!userId) throw new BadRequestError('userId is required.');

  const radius = Math.min(Number(radiusKm) || 100, 1000);

  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('latitude, longitude')
    .eq('id', userId)
    .single();

  if (meError || !me?.latitude || !me?.longitude) {
    return res.status(200).json([]); // no location set — nothing to show
  }

  function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, bio, city, honor_score, reliability_score, latitude, longitude')
    .neq('id', userId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) return res.status(200).json([]);

  const nearby = (profiles ?? [])
    .map((p: any) => ({
      ...p,
      distanceKm: Math.round(haversineKm(me.latitude!, me.longitude!, p.latitude!, p.longitude!)),
    }))
    .filter((p: any) => p.distanceKm <= radius)
    .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
    .slice(0, 20);

  return res.status(200).json(nearby);
});

/**
 * POST /users/complete-onboarding
 * Marks onboarding_completed = true for the given userId.
 */
export const completeOnboarding = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.body;
  if (!userId) throw new BadRequestError('userId is required.');
  // Check if already onboarded (idempotent — don't double-grant PP)
  const { data: existing } = await supabase
    .from('profiles')
    .select('onboarding_completed, praxis_points')
    .eq('id', userId)
    .single();

  const alreadyOnboarded = existing?.onboarding_completed === true;
  const currentPP = existing?.praxis_points ?? 0;
  const grant = alreadyOnboarded ? 0 : 200;

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true, praxis_points: currentPP + grant })
    .eq('id', userId);
  if (error) throw new InternalServerError(`Failed to complete onboarding: ${error.message}`);
  res.status(200).json({ message: 'Onboarding complete.', pointsGranted: grant });
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

/**
 * GET /users/:userId/percentile
 * Returns the user's discipline percentile: streak rank and reliability rank
 * among all profiles. E.g. streak_percentile=88 means top 12%.
 */
export const getUserPercentile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;

  const { data: user, error: userErr } = await supabase
    .from('profiles')
    .select('current_streak, reliability_score')
    .eq('id', userId)
    .single();

  if (userErr || !user) throw new NotFoundError('User not found.');

  const userStreak = user.current_streak ?? 0;
  const userReliability = user.reliability_score ?? 0;

  const [{ count: streakBelow }, { count: total }, { count: relBelow }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).lt('current_streak', userStreak),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).lt('reliability_score', userReliability),
  ]);

  const n = total ?? 1;
  const streakPercentile = Math.round(((streakBelow ?? 0) / n) * 100);
  const reliabilityPercentile = Math.round(((relBelow ?? 0) / n) * 100);

  res.json({
    streak: userStreak,
    reliability: userReliability,
    streak_percentile: streakPercentile,
    reliability_percentile: reliabilityPercentile,
    total_users: n,
  });
});


/**
 * DELETE /users/me — hard-delete the authenticated user's account.
 * Removes: goal_tree, profile data (cascades messages, etc. via FK).
 * Auth: removes the user from Supabase Auth (service-role required).
 */
export const deleteMyAccount = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  // Delete goal tree first (not always cascade-linked)
  await supabase.from('goal_trees').delete().eq('"userId"', userId);

  // Delete profile — FK cascades handle most related data
  await supabase.from('profiles').delete().eq('id', userId);

  // Delete from Supabase Auth (requires service-role key)
  const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
  if (authErr) {
    logger.warn(`Could not delete auth user ${userId}: ${authErr.message}`);
    // Non-fatal: profile is gone, auth entry will be orphaned but harmless
  }

  res.json({ success: true, message: 'Account deleted.' });
});

/**
 * POST /users/me/reset-goals — delete the user's goal tree (fresh start)
 */
export const resetMyGoals = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { error } = await supabase.from('goal_trees').delete().eq('"userId"', userId);
  if (error) throw new InternalServerError('Failed to reset goal tree.');

  // Also reset edit count so they get a free initial setup
  await supabase.from('profiles').update({ goal_tree_edit_count: 0 }).eq('id', userId);

  res.json({ success: true, message: 'Goal tree reset. You can start fresh.' });
});

// ---------------------------------------------------------------------------
// Public stats — no auth required, used by HomePage social proof
// GET /users/stats/public
// ---------------------------------------------------------------------------
export const getPublicStats = catchAsync(async (_req: Request, res: Response, _next: NextFunction) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [profilesRes, treesRes, checkinsRes] = await Promise.allSettled([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('goal_trees').select('userId', { count: 'exact', head: true }),
    supabase.from('checkins').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ]);

  res.json({
    userCount: profilesRes.status === 'fulfilled' ? (profilesRes.value.count ?? 0) : 0,
    goalsTracked: treesRes.status === 'fulfilled' ? (treesRes.value.count ?? 0) : 0,
    checkInsThisWeek: checkinsRes.status === 'fulfilled' ? (checkinsRes.value.count ?? 0) : 0,
  });
});
