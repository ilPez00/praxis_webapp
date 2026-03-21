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
 *
 * Returns null on DB error (callers skip the notification body in that case).
 */
async function computeHonorScore(targetId: string): Promise<number | null> {
  // Fetch all votes for this target
  const { data: votes, error: votesError } = await supabase
    .from('honor_votes')
    .select('voter_id, created_at')
    .eq('target_id', targetId);

  if (votesError) {
    logger.error('computeHonorScore fetch votes error:', votesError.message);
    return null;
  }

  if (!votes || votes.length === 0) {
    await supabase.from('profiles').update({ honor_score: 0 }).eq('id', targetId);
    return 0;
  }

  // Fetch giver reliability scores in a single batch query
  const voterIds = votes.map(v => v.voter_id);
  const { data: givers, error: giversError } = await supabase
    .from('profiles')
    .select('id, reliability_score')
    .in('id', voterIds);

  if (giversError) {
    logger.error('computeHonorScore fetch givers error:', giversError.message);
    return null;
  }

  const reliabilityMap = new Map<string, number>();
  for (const g of givers ?? []) {
    reliabilityMap.set(g.id, g.reliability_score ?? 0);
  }

  const now = Date.now();
  let score = 0;
  for (const vote of votes) {
    const reliability = reliabilityMap.get(vote.voter_id) ?? 0;
    const ageDays = (now - new Date(vote.created_at).getTime()) / 86400000;

    let weight: number;
    if (ageDays <= 60) weight = 1.0;
    else if (ageDays <= 120) weight = 0.5;
    else continue; // older than 120d — excluded

    score += reliability * weight;
  }

  const rounded = Math.round(score * 100) / 100;

  // Only write if the score has meaningfully changed
  const { data: current } = await supabase.from('profiles').select('honor_score').eq('id', targetId).single();
  if (Math.abs(rounded - ((current?.honor_score as number) ?? 0)) > 0.01) {
    await supabase.from('profiles').update({ honor_score: rounded }).eq('id', targetId);
  }

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
    .select('id')
    .eq('id', targetId)
    .single();
  if (targetError || !target) throw new NotFoundError('User not found.');

  // Check giver has enough PP
  const { data: voter } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', voterId)
    .single();
  if (!voter) throw new NotFoundError('Your profile was not found.');
  const voterPP = voter.praxis_points ?? 0;
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

  if (newScore !== null) {
    pushNotification({
      userId: targetId,
      type: 'honor',
      title: 'Someone honoured you',
      body: `Your honor score is now ${newScore.toFixed(2)}.`,
      link: `/profile/${targetId}`,
      actorId: voterId,
    }).catch(err => logger.warn('Fire-and-forget failed:', err?.message));
  }

  res.json({ message: 'Honor given.', honor_score: newScore ?? 0 });
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

  res.json({ message: 'Honor revoked.', honor_score: newScore ?? 0 });
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

  res.json({ honor_score: honorScore ?? 0, has_honored: hasHonored });
});
