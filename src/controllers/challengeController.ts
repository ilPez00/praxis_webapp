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
  const { userId } = req.body;
  if (!userId) throw new BadRequestError('userId is required.');
  const { error } = await supabase
    .from('challenge_participants')
    .upsert({ challenge_id: challengeId, user_id: userId }, { onConflict: 'challenge_id,user_id' });
  if (error) throw new InternalServerError('Failed to join challenge.');
  res.json({ message: 'Joined challenge.' });
});

export const leaveChallenge = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { challengeId } = req.params;
  const { userId } = req.body;
  if (!userId) throw new BadRequestError('userId is required.');
  await supabase.from('challenge_participants')
    .delete().eq('challenge_id', challengeId).eq('user_id', userId);
  res.json({ message: 'Left challenge.' });
});
