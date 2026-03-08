import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError, ForbiddenError, NotFoundError, InternalServerError } from '../utils/appErrors';
import logger from '../utils/logger';
import { pushNotification } from './notificationController';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('does not exist') || msg?.includes('42P01');

const HONOR_COST = 10;      // PP deducted from giver
const GIVER_REBATE = 5;     // PP returned to giver (net cost = 5)
const RECIPIENT_AWARD = 20; // PP awarded to recipient

/**
 * Recomputes the weighted, age-decaying honor score for a user and writes it back.
 * honor_score = SUM(giver_reliability * age_weight) over active votes where:
 *   0-60 days:   weight 1.0
 *   61-120 days: weight 0.5
 *   >120 days:   excluded
 */
async function computeHonorScore(targetId: string): Promise<number> {
  const { data: votes, error } = await supabase
    .from('honor_votes')
    .select('voter_id, created_at, profiles!honor_votes_voter_id_fkey(reliability_score)')
    .eq('target_id', targetId);

  if (error) {
    logger.error('computeHonorScore fetch error:', error.message);
    return 0;
  }

  const now = Date.now();
  let score = 0;

  for (const vote of votes ?? []) {
    const giverReliability: number = (vote.profiles as any)?.reliability_score ?? 0;
    const ageMs = now - new Date(vote.created_at).getTime();
    const ageDays = ageMs / 86400000;

    let weight: number;
    if (ageDays <= 60) weight = 1.0;
    else if (ageDays <= 120) weight = 0.5;
    else continue; // older than 120d — excluded

    score += giverReliability * weight;
  }

  const rounded = Math.round(score * 100) / 100;
  await supabase.from('profiles').update({ honor_score: rounded }).eq('id', targetId);
  return rounded;
}

/**
 * POST /honor/:targetId
 * Give honor to another user.
 * Cost: -10 PP from giver, +5 PP rebate to giver (net -5), +20 PP to recipient.
 */
export const giveHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const voterId = req.user?.id;
  if (!voterId) throw new ForbiddenError('Authentication required.');

  const { targetId } = req.params as Record<string, string>;
  if (targetId === voterId) throw new BadRequestError('You cannot honor yourself.');

  // Check target exists
  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', targetId)
    .single();
  if (targetError || !target) throw new NotFoundError('User not found.');

  // Check giver has enough PP
  const { data: voter } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', voterId)
    .single();
  const voterPP = voter?.praxis_points ?? 0;
  if (voterPP < HONOR_COST) {
    throw new BadRequestError(`Not enough PP — you need ${HONOR_COST} PP to give honor.`);
  }

  // Insert vote (unique constraint rejects duplicates)
  const { error: voteError } = await supabase
    .from('honor_votes')
    .insert({ voter_id: voterId, target_id: targetId });

  if (voteError) {
    if (SCHEMA_MISSING(voteError.message)) {
      return res.status(503).json({ message: 'Honor system not yet enabled. Run DB migrations.' });
    }
    if (voteError.code === '23505') throw new BadRequestError('You have already honored this user.');
    logger.error('Error giving honor:', voteError.message);
    throw new InternalServerError('Failed to give honor.');
  }

  // Deduct cost from giver, return rebate (net: -HONOR_COST + GIVER_REBATE)
  await supabase.from('profiles').update({
    praxis_points: voterPP - HONOR_COST + GIVER_REBATE,
  }).eq('id', voterId);

  // Award PP to recipient
  const { data: recipientRow } = await supabase.from('profiles').select('praxis_points').eq('id', targetId).single();
  await supabase.from('profiles').update({
    praxis_points: (recipientRow?.praxis_points ?? 0) + RECIPIENT_AWARD,
  }).eq('id', targetId);

  // Recompute weighted honor score
  const newScore = await computeHonorScore(targetId);

  pushNotification({
    userId: targetId,
    type: 'honor',
    title: 'Someone honoured you',
    body: `Your honor score is now ${newScore.toFixed(2)}.`,
    link: `/profile/${targetId}`,
    actorId: voterId,
  }).catch(() => {});

  res.json({ message: 'Honor given.', honor_score: newScore });
});

/**
 * DELETE /honor/:targetId
 * Revoke a previously given honor vote.
 * Refunds HONOR_COST PP to giver; deducts RECIPIENT_AWARD PP from recipient.
 */
export const revokeHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const voterId = req.user?.id;
  if (!voterId) throw new ForbiddenError('Authentication required.');

  const { targetId } = req.params as Record<string, string>;

  const { error, count } = await supabase
    .from('honor_votes')
    .delete({ count: 'exact' })
    .eq('voter_id', voterId)
    .eq('target_id', targetId);

  if (error) throw new InternalServerError('Failed to revoke honor.');
  if ((count ?? 0) === 0) throw new NotFoundError('No honor vote found to revoke.');

  // Refund HONOR_COST to giver
  const { data: voterRow } = await supabase.from('profiles').select('praxis_points').eq('id', voterId).single();
  await supabase.from('profiles').update({
    praxis_points: (voterRow?.praxis_points ?? 0) + HONOR_COST,
  }).eq('id', voterId);

  // Deduct RECIPIENT_AWARD from recipient (floor PP at 0)
  const { data: recipientRow } = await supabase.from('profiles').select('praxis_points').eq('id', targetId).single();
  await supabase.from('profiles').update({
    praxis_points: Math.max(0, (recipientRow?.praxis_points ?? 0) - RECIPIENT_AWARD),
  }).eq('id', targetId);

  // Recompute weighted honor score
  const newScore = await computeHonorScore(targetId);

  res.json({ message: 'Honor revoked.', honor_score: newScore });
});

/**
 * GET /honor/:userId
 * Returns the on-demand computed honor score + whether the requester has honored this user.
 */
export const getHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const requesterId = req.user?.id;
  const { userId } = req.params as Record<string, string>;

  // Verify user exists
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();
  if (error || !profile) throw new NotFoundError('User not found.');

  // Recompute on demand
  const honorScore = await computeHonorScore(userId);

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

  res.json({ honor_score: honorScore, has_honored: hasHonored });
});
