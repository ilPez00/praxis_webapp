import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, NotFoundError, BadRequestError, InternalServerError } from '../utils/appErrors';

const handleSupabaseError = (error: any) => {
  logger.error('Supabase error (coach):', error);
  throw new InternalServerError(error.message || 'Internal server error during Supabase operation.');
};

// ---------------------------------------------------------------------------
// GET /coaches?userId=<uuid>
// Returns all coach profiles, optionally re-ranked by domain similarity to
// the requesting user's goals.
// ---------------------------------------------------------------------------
export const listCoaches = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.query as { userId?: string };

  const { data: coaches, error } = await supabase
    .from('coach_profiles')
    .select('*, profiles(id, name, avatar_url, is_verified, is_premium)')
    .eq('is_available', true)
    .order('rating', { ascending: false });

  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found')) {
      logger.warn('coach_profiles table not found — returning empty list.');
      return res.status(200).json([]);
    }
    handleSupabaseError(error);
  }

  const coachList = (coaches ?? []).map((c: any) => ({
    ...c,
    bio: c.bio ?? '',
    skills: Array.isArray(c.skills) ? c.skills : [],
    domains: Array.isArray(c.domains) ? c.domains : [],
  }));

  if (!userId || coachList.length === 0) return res.status(200).json(coachList);

  // Compute domain similarity with the requesting user
  const { data: myTree } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('"userId"', userId)
    .single();

  const myNodes: any[] = Array.isArray(myTree?.nodes) ? myTree!.nodes : [];
  const myDomains = new Set<string>(myNodes.map((n: any) => n?.domain).filter(Boolean));

  if (myDomains.size === 0) return res.status(200).json(coachList);

  const scored = coachList.map((coach: any) => {
    const coachDomains = new Set<string>(Array.isArray(coach.domains) ? coach.domains : []);
    let overlap = 0;
    for (const d of Array.from(myDomains)) {
      if (coachDomains.has(d)) overlap++;
    }
    const union = new Set([...Array.from(myDomains), ...Array.from(coachDomains)]).size;
    const similarity = union > 0 ? overlap / union : 0;
    return { ...coach, similarity: Math.round(similarity * 100) };
  });

  // Sort: 60% rating + 40% similarity
  const maxRating = 5;
  scored.sort((a: any, b: any) => {
    const scoreA = 0.6 * ((a.rating ?? 0) / maxRating) + 0.4 * (a.similarity / 100);
    const scoreB = 0.6 * ((b.rating ?? 0) / maxRating) + 0.4 * (b.similarity / 100);
    return scoreB - scoreA;
  });

  return res.status(200).json(scored);
});

// ---------------------------------------------------------------------------
// GET /coaches/:userId
// Returns a single user's coach profile.
// ---------------------------------------------------------------------------
export const getCoachByUserId = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('coach_profiles')
    .select('*, profiles(id, name, avatar_url, is_verified, is_premium)')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') handleSupabaseError(error);
  if (!data) throw new NotFoundError('Coach profile not found.');

  res.status(200).json(data);
});

// ---------------------------------------------------------------------------
// POST /coaches
// Creates or updates (upserts) the authenticated user's coach profile.
// Body: { userId, bio, skills, domains, hourlyRate, isAvailable }
// ---------------------------------------------------------------------------
export const upsertCoachProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, bio, skills, domains, hourlyRate, isAvailable } = req.body;

  if (!userId) throw new BadRequestError('userId is required.');
  if (!bio) throw new BadRequestError('bio is required.');

  const { data, error } = await supabase
    .from('coach_profiles')
    .upsert(
      {
        user_id: userId,
        bio,
        skills: Array.isArray(skills) ? skills : [],
        domains: Array.isArray(domains) ? domains : [],
        hourly_rate: hourlyRate ?? null,
        is_available: isAvailable !== false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) handleSupabaseError(error);
  if (!data) throw new InternalServerError('Upsert returned no data.');

  res.status(200).json(data);
});

// ---------------------------------------------------------------------------
// PATCH /coaches/:userId
// Partial update of a coach profile.
// ---------------------------------------------------------------------------
export const updateCoachProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;
  const { bio, skills, domains, hourlyRate, isAvailable } = req.body;

  const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (bio !== undefined) updatePayload.bio = bio;
  if (skills !== undefined) updatePayload.skills = skills;
  if (domains !== undefined) updatePayload.domains = domains;
  if (hourlyRate !== undefined) updatePayload.hourly_rate = hourlyRate;
  if (isAvailable !== undefined) updatePayload.is_available = isAvailable;

  const { data, error } = await supabase
    .from('coach_profiles')
    .update(updatePayload)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) handleSupabaseError(error);
  if (!data) throw new NotFoundError('Coach profile not found.');

  res.status(200).json(data);
});

// ---------------------------------------------------------------------------
// DELETE /coaches/:userId
// ---------------------------------------------------------------------------
export const deleteCoachProfile = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;

  const { error } = await supabase
    .from('coach_profiles')
    .delete()
    .eq('user_id', userId);

  if (error) handleSupabaseError(error);

  res.status(204).send();
});
