import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors';
import { pushNotification } from './notificationController';

/**
 * Find users with similar goals for duel matching
 */
async function findDuelOpponent(userId: string, goalName: string): Promise<string | null> {
  try {
    // Get current user's goal domains
    const { data: userGoals } = await supabase
      .from('goal_trees')
      .select('nodes')
      .eq('user_id', userId)
      .single();

    const userDomains = new Set<string>();
    if (userGoals?.nodes) {
      const nodes = Array.isArray(userGoals.nodes) ? userGoals.nodes : [];
      nodes.forEach((node: any) => {
        if (node?.domain) userDomains.add(node.domain);
      });
    }

    // Find other users with similar goals
    const { data: matches } = await supabase
      .from('matches')
      .select('matched_user_id')
      .eq('user_id', userId)
      .limit(10);

    if (matches && matches.length > 0) {
      // Pick a random match as opponent
      const randomMatch = matches[Math.floor(Math.random() * matches.length)];
      return randomMatch.matched_user_id;
    }

    // Fallback: find any active user with similar goals
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .neq('id', userId)
      .not('last_activity_date', 'is', null)
      .order('last_activity_date', { ascending: false })
      .limit(5);

    if (profiles && profiles.length > 0) {
      const randomProfile = profiles[Math.floor(Math.random() * profiles.length)];
      return randomProfile.id;
    }

    return null;
  } catch (err) {
    logger.error('Error finding duel opponent:', err);
    return null;
  }
}

/**
 * POST /bets
 * Create a new goal bet. Deducts stake_points from user's praxis_points.
 * Automatically creates a duel if opponentType is 'duel'.
 * Body: { userId, goalNodeId, goalName, deadline, stakePoints, opponentType: 'self' | 'duel' }
 */
export const createBet = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, goalNodeId, goalName, deadline, stakePoints, opponentType } = req.body;

  logger.info('[createBet] Received bet creation request:', {
    userId,
    goalName,
    deadline,
    stakePoints,
    opponentType,
  });

  if (!userId || !goalName || !deadline || !stakePoints) {
    logger.warn('[createBet] Missing required fields');
    throw new BadRequestError('userId, goalName, deadline, and stakePoints are required.');
  }
  if (typeof stakePoints !== 'number' || stakePoints < 1) {
    throw new BadRequestError('stakePoints must be a positive integer.');
  }

  // Axiom challenges often have same-day or next-day deadlines.
  // We'll allow any future deadline now, but warn if it's too short for standard goal nodes.
  const deadlineDate = new Date(deadline);
  const now = new Date();
  if (isNaN(deadlineDate.getTime()) || deadlineDate <= now) {
    throw new BadRequestError('Bet deadline must be in the future.');
  }

  // Check user has enough points
  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points, name')
    .eq('id', userId)
    .single();

  const currentPoints: number = profile?.praxis_points ?? 100;
  if (currentPoints < stakePoints) {
    throw new BadRequestError(`Insufficient Praxis Points (have ${currentPoints}, need ${stakePoints}).`);
  }

  // Max stake: 500 PP or 50% of balance, whichever is lower
  const maxStake = Math.min(500, Math.floor(currentPoints * 0.5));
  if (stakePoints > maxStake) {
    throw new BadRequestError(`Maximum stake is ${maxStake} PP (500 PP cap or 50% of your balance).`);
  }

  // Max 3 active bets at a time
  const { count: activeBetCount } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  if ((activeBetCount ?? 0) >= 3) {
    throw new BadRequestError('You can have at most 3 active bets at a time. Complete or cancel one first.');
  }

  // Deduct points
  await supabase
    .from('profiles')
    .update({ praxis_points: currentPoints - stakePoints })
    .eq('id', userId);

  // Create the bet
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      goal_node_id: goalNodeId || null,
      goal_name: goalName,
      deadline,
      stake_points: stakePoints,
      status: 'active',
    })
    .select()
    .single();

  if (betError) {
    // Refund points if insert failed
    await supabase
      .from('profiles')
      .update({ praxis_points: currentPoints })
      .eq('id', userId);
    logger.error('Error creating bet:', betError.message);
    throw new InternalServerError('Failed to create bet.');
  }

  // If opponentType is 'duel', automatically create a duel
  let duel = null;
  if (opponentType === 'duel') {
    logger.info(`[createBet] Creating duel for user ${userId} with opponent ${opponentId || 'to be found'}`);
    const opponentId = await findDuelOpponent(userId, goalName);
    logger.info(`[createBet] Found opponent: ${opponentId || 'none'}`);

    if (opponentId) {
      const duelDeadline = new Date();
      duelDeadline.setDate(deadlineDate.getDate());

      logger.info(`[createBet] Inserting duel with data:`, {
        creator_id: userId,
        opponent_id: opponentId,
        goal_node_id: goalNodeId,
        title: `Bet Challenge: ${goalName}`,
        stake_pp: stakePoints,
        deadline: duelDeadline.toISOString().split('T')[0],
      });

      const { data: newDuel, error: duelError } = await supabase
        .from('duels')
        .insert({
          creator_id: userId,
          opponent_id: opponentId,
          goal_node_id: goalNodeId || null,
          title: `Bet Challenge: ${goalName}`,
          description: `Staked ${stakePoints} PP on "${goalName}". Deadline: ${deadlineDate.toLocaleDateString()}`,
          stake_pp: stakePoints,
          deadline_days: Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          deadline: duelDeadline.toISOString().split('T')[0],
          status: 'pending',
        })
        .select()
        .single();

      if (duelError) {
        logger.error('[createBet] Duel creation failed:', JSON.stringify(duelError, null, 2));
        // Don't fail the bet if duel creation fails - just log it
        logger.warn('[createBet] Bet created but duel creation failed - continuing with bet only');
      } else {
        duel = newDuel;
        logger.info('[createBet] Duel created successfully:', duel.id);

        // Notify opponent
        try {
          await pushNotification({
            userId: opponentId,
            title: '🎯 Duel Challenge!',
            body: `${profile?.name || 'Someone'} challenged you to "${goalName}" for ${stakePoints} PP!`,
            type: 'duel_challenge',
          });
        } catch (err) {
          logger.error('Failed to send duel notification:', err);
        }
      }
    }
  }

  res.status(201).json({ bet, duel });
});

/**
 * GET /bets/:userId
 * Returns all bets for a user, ordered by created_at desc.
 */
export const getUserBets = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('bets')
    .select('id, user_id, goal_node_id, goal_name, deadline, stake_points, status, outcome, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found')) {
      logger.warn('bets table not found — returning empty list. Run migrations/setup.sql.');
      return res.json([]);
    }
    throw new InternalServerError('Failed to fetch bets.');
  }
  res.json(data || []);
});

/**
 * GET /bets/bet/:betId
 * Returns a single bet by ID.
 */
export const getBetById = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { betId } = req.params;

  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .single();

  if (error || !data) throw new NotFoundError('Bet not found.');

  res.json(data);
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

  // Refund 75% of stake (25% cancellation fee — discourages using bets as risk-free PP)
  const refunded = Math.floor(bet.stake_points * 0.75);
  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single();
  await supabase
    .from('profiles')
    .update({ praxis_points: (profile?.praxis_points ?? 0) + refunded })
    .eq('id', userId);

  res.json({ message: 'Bet cancelled. 75% of stake refunded (25% cancellation fee).', refunded });
});

/**
 * POST /bets/resolve-webhook
 * Sweeps all active bets whose deadline has passed and marks them 'lost'.
 * Stake was already deducted on creation, so no further points adjustment is needed.
 * Intended to be called by a scheduled cron job (e.g. Railway cron, Supabase pg_cron).
 * Forfeited totals are logged for charity/escrow processing in production.
 */
export const resolveExpiredBets = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const now = new Date().toISOString();

  const { data: expiredBets, error } = await supabase
    .from('bets')
    .select('id, user_id, goal_node_id, stake_points, status, deadline')
    .eq('status', 'active')
    .lt('deadline', now);

  if (error) throw new InternalServerError('Failed to fetch expired bets.');

  if (!expiredBets || expiredBets.length === 0) {
    return res.json({ resolved: 0, message: 'No expired bets found.' });
  }

  let resolved = 0;
  let totalForfeited = 0;

  for (const bet of expiredBets) {
    const { error: updateErr } = await supabase
      .from('bets')
      .update({ status: 'lost' })
      .eq('id', bet.id);

    if (!updateErr) {
      resolved++;
      totalForfeited += bet.stake_points;
      logger.info(`Bet ${bet.id} EXPIRED/LOST for user ${bet.user_id}: ${bet.stake_points} pts forfeited`);
    }
  }

  // STUB: in production, route forfeited real-money stakes to charity escrow via Stripe transfer
  if (totalForfeited > 0) {
    logger.info(`[CHARITY STUB] ${totalForfeited} pts forfeited across ${resolved} bets — would trigger Stripe transfer to charity escrow in production`);
  }

  res.json({ resolved, totalForfeited, message: `${resolved} expired bet(s) resolved.` });
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
      .select('id, user_id, goal_node_id, stake_points, status, goal_name')
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
      // Award 1.8× stake on win (10% house edge — makes bets a net sink for the economy)
      const winnings = Math.round(bet.stake_points * 1.8);
      await supabase
        .from('profiles')
        .update({ praxis_points: (profile?.praxis_points ?? 0) + winnings })
        .eq('id', userId);
      logger.info(`Bet ${bet.id} WON for user ${userId}: +${winnings} Praxis Points (1.8× payout)`);
      pushNotification({
        userId,
        type: 'bet_result',
        title: `Goal completed! You won ${winnings} PP on "${bet.goal_name}"`,
        link: '/betting',
      });
    }
  } catch (err) {
    // Non-fatal — bet resolution failure shouldn't block goal verification
    logger.error('Bet resolution failed (non-fatal):', err);
  }
};
