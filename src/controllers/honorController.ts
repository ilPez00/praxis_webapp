import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError, ForbiddenError, NotFoundError, InternalServerError } from '../utils/appErrors';
import logger from '../utils/logger';
import { pushNotification } from './notificationController';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('does not exist') || msg?.includes('42P01');

/**
 * POST /honor/:targetId
 * Give honor to another user. Each user can honor each target at most once.
 * Increments honor_score on the target's profile.
 */
export const giveHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const voterId = req.user?.id;
  if (!voterId) throw new ForbiddenError('Authentication required.');

  const { targetId } = req.params;
  if (targetId === voterId) throw new BadRequestError('You cannot honor yourself.');

  // Check target exists
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, honor_score')
    .eq('id', targetId)
    .single();
  if (targetError || !target) throw new NotFoundError('User not found.');

  // Insert vote (unique constraint will reject duplicates)
  const { error: voteError } = await supabase
    .from('honor_votes')
    .insert({ voter_id: voterId, target_id: targetId });

  if (voteError) {
    if (SCHEMA_MISSING(voteError.message)) {
      return res.status(503).json({ message: 'Honor system not yet enabled. Run DB migrations.' });
    }
    if (voteError.code === '23505') {
      throw new BadRequestError('You have already honored this user.');
    }
    logger.error('Error giving honor:', voteError.message);
    throw new InternalServerError('Failed to give honor.');
  }

  // Increment honor_score
  const newScore = (target.honor_score ?? 0) + 1;
  await supabase.from('profiles').update({ honor_score: newScore }).eq('id', targetId);

  pushNotification({
    userId: targetId as string,
    type: 'honor',
    title: 'Someone honoured you',
    body: `Your honor score is now ${newScore}.`,
    link: `/profile/${targetId}`,
    actorId: voterId,
  }).catch(() => {});

  res.json({ message: 'Honor given.', honor_score: newScore });
});

/**
 * DELETE /honor/:targetId
 * Revoke a previously given honor vote.
 */
export const revokeHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const voterId = req.user?.id;
  if (!voterId) throw new ForbiddenError('Authentication required.');

  const { targetId } = req.params;

  const { error, count } = await supabase
    .from('honor_votes')
    .delete({ count: 'exact' })
    .eq('voter_id', voterId)
    .eq('target_id', targetId);

  if (error) throw new InternalServerError('Failed to revoke honor.');
  if ((count ?? 0) === 0) throw new NotFoundError('No honor vote found to revoke.');

  // Decrement honor_score (floor at 0)
  const { data: target } = await supabase.from('profiles').select('honor_score').eq('id', targetId).single();
  if (target) {
    const newScore = Math.max(0, (target.honor_score ?? 0) - 1);
    await supabase.from('profiles').update({ honor_score: newScore }).eq('id', targetId);
  }

  res.json({ message: 'Honor revoked.' });
});

/**
 * GET /honor/:userId
 * Get honor score + whether the requesting user has already honored this user.
 */
export const getHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const requesterId = req.user?.id;
  const { userId } = req.params;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('honor_score')
    .eq('id', userId)
    .single();

  if (error || !profile) throw new NotFoundError('User not found.');

  let hasHonored = false;
  if (requesterId && requesterId !== userId) {
    const { data: vote } = await supabase
      .from('honor_votes')
      .select('voter_id')
      .eq('voter_id', requesterId)
      .eq('target_id', userId)
      .maybeSingle();
    hasHonored = !!vote;
  }

  res.json({
    honor_score: profile.honor_score ?? 0,
    has_honored: hasHonored,
  });
});
