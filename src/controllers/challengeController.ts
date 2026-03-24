import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors';

export const listChallenges = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_participants(count)')
    .order('created_at', { ascending: false });
  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found')) {
      return res.json([]);
    }
    throw new InternalServerError('Failed to fetch challenges.');
  }
  res.json(data ?? []);
});

export const joinChallenge = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { challengeId } = req.params;
  const userId = (req as any).user?.id;
  if (!userId) throw new BadRequestError('Authentication required.');

  // Check if already joined (upsert won't tell us)
  const { data: existing } = await supabase
    .from('challenge_participants')
    .select('challenge_id')
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .maybeSingle();

  const { error } = await supabase
    .from('challenge_participants')
    .upsert({ challenge_id: challengeId, user_id: userId }, { onConflict: 'challenge_id,user_id' });
  if (error) throw new InternalServerError('Failed to join challenge.');

  // Award +30 PP for first-time join
  if (!existing) {
    const { data: prof } = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
    if (prof) {
      await supabase.from('profiles').update({ praxis_points: (prof.praxis_points ?? 0) + 30 }).eq('id', userId);
    }
  }

  res.json({ message: 'Joined challenge.', pp_awarded: !existing ? 30 : 0 });
});

export const leaveChallenge = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { challengeId } = req.params;
  const userId = (req as any).user?.id;
  if (!userId) throw new BadRequestError('Authentication required.');
  await supabase.from('challenge_participants')
    .delete().eq('challenge_id', challengeId).eq('user_id', userId);
  res.json({ message: 'Left challenge.' });
});
