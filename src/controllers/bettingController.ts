import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors';

/**
 * POST /bets
 * Create a new goal bet. Deducts stake_points from user's praxis_points.
 * Body: { userId, goalNodeId, goalName, deadline, stakePoints }
 */
export const createBet = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, goalNodeId, goalName, deadline, stakePoints } = req.body;

  if (!userId || !goalNodeId || !goalName || !deadline || !stakePoints) {
    throw new BadRequestError('userId, goalNodeId, goalName, deadline, and stakePoints are required.');
  }
  if (typeof stakePoints !== 'number' || stakePoints < 1) {
    throw new BadRequestError('stakePoints must be a positive integer.');
  }

  // Check user has enough points (best-effort — column may not exist yet)
  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single();

  const currentPoints: number = profile?.praxis_points ?? 100;
  if (currentPoints < stakePoints) {
    throw new BadRequestError(`Insufficient Praxis Points (have ${currentPoints}, need ${stakePoints}).`);
  }

  // Deduct points (best-effort)
  await supabase
    .from('profiles')
    .update({ praxis_points: currentPoints - stakePoints })
    .eq('id', userId);

  const { data: bet, error } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      goal_node_id: goalNodeId,
      goal_name: goalName,
      deadline,
      stake_points: stakePoints,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    // Refund points if insert failed
    await supabase
      .from('profiles')
      .update({ praxis_points: currentPoints })
      .eq('id', userId);
    logger.error('Error creating bet:', error.message);
    throw new InternalServerError('Failed to create bet.');
  }

  res.status(201).json(bet);
});

/**
 * GET /bets/:userId
 * Returns all bets for a user, ordered by created_at desc.
 */
export const getUserBets = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new InternalServerError('Failed to fetch bets.');
  res.json(data || []);
});

/**
 * DELETE /bets/:betId
 * Cancel a bet (only if still active). Refunds stake_points.
 * Body: { userId }
 */
export const cancelBet = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { betId } = req.params;
  const { userId } = req.body;

  if (!userId) throw new BadRequestError('userId is required.');

  const { data: bet, error: fetchError } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .single();

  if (fetchError || !bet) throw new NotFoundError('Bet not found.');
  if (bet.user_id !== userId) throw new ForbiddenError('Not your bet.');
  if (bet.status !== 'active') throw new BadRequestError('Only active bets can be cancelled.');

  const { error: updateError } = await supabase
    .from('bets')
    .update({ status: 'cancelled' })
    .eq('id', betId);

  if (updateError) throw new InternalServerError('Failed to cancel bet.');

  // Refund points
  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single();
  await supabase
    .from('profiles')
    .update({ praxis_points: (profile?.praxis_points ?? 0) + bet.stake_points })
    .eq('id', userId);

  res.json({ message: 'Bet cancelled. Points refunded.', refunded: bet.stake_points });
});

/**
 * Internal: called from completionController when a goal is peer-verified as approved.
 * Resolves any active bets on the given goalNodeId for that user as 'won',
 * and awards double the stake_points back as winnings.
 */
export const resolveBetsOnGoalCompletion = async (userId: string, goalNodeId: string): Promise<void> => {
  try {
    const { data: activeBets } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('goal_node_id', goalNodeId)
      .eq('status', 'active');

    if (!activeBets || activeBets.length === 0) return;

    for (const bet of activeBets) {
      await supabase.from('bets').update({ status: 'won' }).eq('id', bet.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('praxis_points')
        .eq('id', userId)
        .single();
      // Award 2× stake on win
      await supabase
        .from('profiles')
        .update({ praxis_points: (profile?.praxis_points ?? 0) + bet.stake_points * 2 })
        .eq('id', userId);
      logger.info(`Bet ${bet.id} WON for user ${userId}: +${bet.stake_points * 2} Praxis Points`);
    }
  } catch (err) {
    // Non-fatal — bet resolution failure shouldn't block goal verification
    logger.error('Bet resolution failed (non-fatal):', err);
  }
};
