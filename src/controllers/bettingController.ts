import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors';
import { pushNotification } from './notificationController';
import { logFail } from './failsController';

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
  const userId = req.user?.id;
  const { goalNodeId, goalName, deadline, stakePoints, opponentType } = req.body;

  logger.info('[createBet] Received:', { userId, goalName, deadline, stakePoints, opponentType });

  if (!userId) {
    throw new BadRequestError('Authentication required.');
  }
  if (!goalName || !deadline || !stakePoints) {
    logger.warn('[createBet] Missing required fields');
    throw new BadRequestError('goalName, deadline, and stakePoints are required.');
  }
  if (typeof stakePoints !== 'number' || stakePoints < 1) {
    throw new BadRequestError('stakePoints must be a positive integer.');
  }

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

  // Max stake: 500 PP or 50% of balance
  const maxStake = Math.min(500, Math.floor(currentPoints * 0.5));
  if (stakePoints > maxStake) {
    throw new BadRequestError(`Maximum stake is ${maxStake} PP.`);
  }

  // Max 3 active bets
  const { count: activeBetCount } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  if ((activeBetCount ?? 0) >= 3) {
    throw new BadRequestError('You can have at most 3 active bets.');
  }

  logger.info('[createBet] All validations passed, deducting points...');

  // Deduct points
  await supabase
    .from('profiles')
    .update({ praxis_points: currentPoints - stakePoints })
    .eq('id', userId);

  logger.info('[createBet] Points deducted, creating bet...');

  // Create the bet - SIMPLIFIED, no duel
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      goal_node_id: null,
      goal_name: goalName,
      deadline,
      stake_points: stakePoints,
      status: 'active',
    })
    .select()
    .single();

  if (betError) {
    logger.error('[createBet] Bet insert failed:', betError);
    // Refund points
    await supabase
      .from('profiles')
      .update({ praxis_points: currentPoints })
      .eq('id', userId);
    throw new InternalServerError('Failed to create bet: ' + betError.message);
  }

  logger.info('[createBet] Bet created successfully:', bet.id);

  // Skip duel creation for now (debugging)
  res.status(201).json({ bet, duel: null, message: 'Bet created successfully (duel creation disabled for debugging)' });
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
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

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
    .select('id, user_id, goal_node_id, goal_name, stake_points, status, deadline')
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
      
      logFail('failed_bet', bet.goal_name, `Lost ${bet.stake_points} PP stake`);
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
    .select('praxis_points, name')
    .eq('id', userId)
    .single();
      // Award 1.8× stake on win (10% house edge — makes bets a net sink for the economy)
      const winnings = Math.round(bet.stake_points * 1.8);
      await supabase
        .from('profiles')
        .update({ praxis_points: (profile?.praxis_points ?? 0) + winnings })
        .eq('id', userId);
      
      // Award XP (2 XP per 1 PP won from betting)
      const xpWinnings = winnings * 2;
      await supabase.rpc('add_xp_to_user', {
        p_user_id: userId,
        p_xp_amount: xpWinnings,
        p_pp_amount: 0, // PP already awarded above
        p_source: 'bet_win',
      });
      
      // Progress quest for winning bet
      await supabase.rpc('progress_user_quest', {
        p_user_id: userId,
        p_quest_type: 'win_bet',
        p_amount: 1,
      });
      
      // Check achievements for bet wins
      await supabase.rpc('check_user_achievements', { p_user_id: userId });
      
      logger.info(`Bet ${bet.id} WON for user ${userId}: +${winnings} PP, +${xpWinnings} XP`);
      
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

/**
 * POST /bets/challenge
 * Create a duel challenge against an opponent
 * Body: { goalName, deadline, stakePoints, opponentType: 'random' | 'specific', opponentId? }
 */
export const createDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { goalName, deadline, stakePoints, opponentType, opponentId } = req.body;

  if (!userId) throw new BadRequestError('Authentication required.');
  if (!goalName || !deadline || !stakePoints) {
    throw new BadRequestError('goalName, deadline, and stakePoints are required.');
  }
  if (stakePoints < 50 || stakePoints > 2000) {
    throw new BadRequestError('Stake must be between 50 and 2000 PP.');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points, name')
    .eq('id', userId)
    .single();

  const currentPoints = profile?.praxis_points ?? 0;
  const totalStake = stakePoints * 1.8;

  if (currentPoints < totalStake) {
    throw new BadRequestError(`Insufficient PP. Need ${totalStake} PP (1.8× stake to cover winnings).`);
  }

  let targetOpponentId = opponentId;

  if (opponentType === 'random') {
    const { data: matches } = await supabase.rpc('match_users_by_goals', {
      query_user_id: userId,
      match_limit: 10,
    });

    if (matches && matches.length > 0) {
      const randomMatch = matches[Math.floor(Math.random() * matches.length)];
      targetOpponentId = randomMatch.id || randomMatch.user_id;
    }
  }

  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  const { data: duel, error: duelError } = await supabase
    .from('duels')
    .insert({
      creator_id: userId,
      challenger_id: userId,
      opponent_id: targetOpponentId,
      title: goalName,
      stake_pp: stakePoints,
      deadline,
      status: targetOpponentId ? 'pending' : 'open',
      opponent_type: opponentType || 'random',
      invite_code: inviteCode,
      challenger_stake_locked: true,
    })
    .select()
    .single();

  if (duelError) {
    logger.error('[createDuel] Duel insert failed:', duelError);
    throw new InternalServerError('Failed to create duel: ' + duelError.message);
  }

  await supabase
    .from('profiles')
    .update({ praxis_points: currentPoints - totalStake })
    .eq('id', userId);

  if (targetOpponentId) {
    pushNotification({
      userId: targetOpponentId,
      type: 'duel_challenge',
      title: `Duel challenge from ${profile?.name || 'Someone'}: ${goalName} (${stakePoints} PP)`,
      link: `/commitments?duel=${duel.id}`,
    });
  }

  res.status(201).json({ 
    duel, 
    message: targetOpponentId ? 'Duel created, awaiting opponent acceptance' : 'Open duel created' 
  });
});

/**
 * POST /bets/duel/:id/accept
 * Accept a duel challenge
 */
export const acceptDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: duel, error: fetchError } = await supabase
    .from('duels')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !duel) throw new NotFoundError('Duel not found.');
  if (duel.opponent_id !== userId) throw new ForbiddenError('This duel is not for you.');
  if (duel.status !== 'pending') throw new BadRequestError('Duel is not pending.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points, name')
    .eq('id', userId)
    .single();

  const totalStake = (duel.stake_pp || 100) * 1.8;

  if ((profile?.praxis_points ?? 0) < totalStake) {
    throw new BadRequestError(`Insufficient PP. Need ${totalStake} PP to match the stake.`);
  }

  await supabase
    .from('profiles')
    .update({ praxis_points: (profile?.praxis_points ?? 0) - totalStake })
    .eq('id', userId);

  const { error: updateErr } = await supabase
    .from('duels')
    .update({ 
      status: 'active',
      opponent_stake_locked: true,
    })
    .eq('id', id);

  if (updateErr) throw new InternalServerError('Failed to accept duel: ' + updateErr.message);

  pushNotification({
    userId: duel.creator_id,
    type: 'duel_accepted',
    title: `${profile?.name || 'Your opponent'} accepted your duel on ${duel.title}!`,
    link: '/commitments',
  });

  res.json({ success: true, message: 'Duel accepted! Both stakes locked.' });
});

/**
 * POST /bets/duel/:id/decline
 * Decline a duel challenge
 */
export const declineDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: duel, error: fetchError } = await supabase
    .from('duels')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !duel) throw new NotFoundError('Duel not found.');
  if (duel.opponent_id !== userId) throw new ForbiddenError('This duel is not for you.');
  if (duel.status !== 'pending') throw new BadRequestError('Duel is not pending.');

  const stakeAmount = (duel.stake_pp || 100) * 1.8;

  await Promise.all([
    supabase.from('duels').update({ status: 'declined' }).eq('id', id),
    supabase.rpc('add_xp_to_user', {
      p_user_id: duel.creator_id,
      p_xp_amount: 0,
      p_pp_amount: stakeAmount,
      p_source: 'duel_declined_refund',
    }),
  ]);

  res.json({ success: true, message: 'Duel declined. Challenger refunded.' });
});

/**
 * GET /bets/duel/:id
 * Get duel details
 */
export const getDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: duel, error } = await supabase
    .from('duels')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !duel) throw new NotFoundError('Duel not found.');
  if (duel.creator_id !== userId && duel.opponent_id !== userId && userId !== duel.creator_id) {
    throw new ForbiddenError('Not authorized to view this duel.');
  }

  res.json(duel);
});

/**
 * GET /bets/duel/invite/:code
 * Join a duel by invite code
 */
export const getDuelByInvite = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { code } = req.params;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { data: duel, error } = await supabase
    .from('duels')
    .select('*')
    .eq('invite_code', String(code).toUpperCase())
    .single();

  if (error || !duel) throw new NotFoundError('Duel not found.');
  if (duel.status !== 'open') throw new BadRequestError('Duel is no longer open.');

  res.json(duel);
});
