import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, ForbiddenError, NotFoundError, InternalServerError } from '../utils/appErrors';
import { pushNotification } from './notificationController';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('42P01') || msg?.includes('42703');

const HOUSE_FEE = 0.05; // 5% platform cut on winnings

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deduct PP from a user's balance (floored at 0). Returns false if insufficient funds. */
async function deductPP(userId: string, amount: number): Promise<boolean> {
  const { data: prof } = await supabase
    .from('profiles').select('praxis_points').eq('id', userId).single();
  if (!prof || (prof.praxis_points ?? 0) < amount) return false;
  await supabase.from('profiles')
    .update({ praxis_points: prof.praxis_points - amount })
    .eq('id', userId);
  return true;
}

/** Award PP to a user. */
async function awardPP(userId: string, amount: number): Promise<void> {
  const { data } = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
  await supabase.from('profiles')
    .update({ praxis_points: (data?.praxis_points ?? 0) + amount })
    .eq('id', userId);
}

/** Compute a relevance score for an open duel relative to the viewer's goal domains. */
function relevanceScore(
  duel: any,
  viewerDomains: Set<string>,
  challengerDomains: Set<string>
): number {
  // 1. Domain match (does the duel category overlap with viewer's goals?)
  const domainMatch = viewerDomains.has(duel.category) ? 1.0
    : [...challengerDomains].some(d => viewerDomains.has(d)) ? 0.5
    : 0.0;

  // 2. Freshness decay: e^(-hours / 72) — challenges fade over 3 days
  const hoursOld = (Date.now() - new Date(duel.created_at).getTime()) / 3_600_000;
  const freshness = Math.exp(-hoursOld / 72);

  // 3. Stake interest (capped at 500 PP)
  const stakeInterest = Math.min(duel.stake_pp, 500) / 500;

  return 0.50 * domainMatch + 0.30 * freshness + 0.20 * stakeInterest;
}

// ---------------------------------------------------------------------------
// GET /duels — open challenge feed, sorted by relevance to viewer
// ---------------------------------------------------------------------------
export const listDuels = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const viewerId = req.user?.id;
  const { category, status = 'open' } = req.query;

  let query = supabase
    .from('duels')
    .select(`
      *,
      creator:profiles!creator_id(id, name, avatar_url, current_streak, praxis_points),
      opponent:profiles!opponent_id(id, name, avatar_url)
    `)
    .order('created_at', { ascending: false });

  // Filter by status or show public open ones
  if (status === 'open') {
    query = query.eq('status', 'open').is('opponent_id', null); // open = public, no specific opponent
  } else {
    query = query.eq('status', status as string);
  }

  if (category) query = query.eq('category', category as string);

  const { data, error } = await query;

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      logger.warn('duels table not found — returning []. Run migrations.');
      return res.json([]);
    }
    throw new InternalServerError('Failed to fetch duels.');
  }

  const duels = data || [];

  if (!viewerId || duels.length === 0) {
    return res.json(duels);
  }

  // Fetch viewer's goal domains for relevance scoring
  const { data: goalTree } = await supabase
    .from('goal_trees').select('nodes').eq('user_id', viewerId).single();
  const viewerDomains = new Set<string>(
    ((goalTree as any)?.nodes || []).map((n: any) => n.domain).filter(Boolean)
  );

  // Fetch challenger goal domains in bulk
  const creatorIds = [...new Set(duels.map((d: any) => d.creator_id))];
  const { data: creatorTrees } = await supabase
    .from('goal_trees').select('user_id, nodes').in('user_id', creatorIds);

  const creatorDomainMap = new Map<string, Set<string>>();
  for (const tree of creatorTrees || []) {
    const uid = (tree as any).user_id;
    const domains = new Set<string>(
      ((tree as any).nodes || []).map((n: any) => n.domain).filter(Boolean)
    );
    creatorDomainMap.set(uid, domains);
  }

  // Score and sort
  const scored = duels.map((duel: any) => ({
    ...duel,
    _relevance: relevanceScore(
      duel,
      viewerDomains,
      creatorDomainMap.get(duel.creator_id) ?? new Set()
    ),
  }));
  scored.sort((a: any, b: any) => b._relevance - a._relevance);

  res.json(scored);
});

// ---------------------------------------------------------------------------
// GET /duels/mine — duels involving the auth user
// ---------------------------------------------------------------------------
export const myDuels = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { data, error } = await supabase
    .from('duels')
    .select(`
      *,
      creator:profiles!creator_id(id, name, avatar_url, current_streak),
      opponent:profiles!opponent_id(id, name, avatar_url, current_streak)
    `)
    .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    if (SCHEMA_MISSING(error.message)) return res.json([]);
    throw new InternalServerError('Failed to fetch your duels.');
  }

  res.json(data || []);
});

// ---------------------------------------------------------------------------
// POST /duels — create a new challenge (open or targeted)
// ---------------------------------------------------------------------------
export const createDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const creatorId = req.user?.id;
  if (!creatorId) throw new ForbiddenError('Authentication required.');

  const { title, description, category, stakePP, deadlineDays, opponentId, goalNodeId } = req.body;

  if (!title?.trim() || !category?.trim()) {
    throw new BadRequestError('title and category are required.');
  }
  const stake = Math.max(10, Math.min(parseInt(stakePP) || 50, 5000));
  const days = Math.max(1, Math.min(parseInt(deadlineDays) || 7, 90));

  // Deduct stake from creator's balance
  const ok = await deductPP(creatorId, stake);
  if (!ok) throw new BadRequestError(`Insufficient PP. You need ${stake} PP to create this challenge.`);

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);

  const status = opponentId ? 'pending' : 'open'; // pending = direct challenge

  const { data, error } = await supabase
    .from('duels')
    .insert({
      creator_id: creatorId,
      opponent_id: opponentId || null,
      goal_node_id: goalNodeId || null,
      title: title.trim(),
      description: description?.trim() || null,
      category: category.trim(),
      stake_pp: stake,
      deadline_days: days,
      deadline: deadline.toISOString().slice(0, 10),
      status,
    })
    .select()
    .single();

  if (error) {
    // Refund stake on error
    await awardPP(creatorId, stake);
    if (SCHEMA_MISSING(error.message)) {
      return res.status(503).json({ message: 'Duels not yet enabled. Run DB migrations.' });
    }
    logger.error('Error creating duel:', error.message);
    throw new InternalServerError(`Failed to create duel: ${error.message}`);
  }

  // Notify the targeted opponent
  if (opponentId) {
    const { data: creatorProfile } = await supabase
      .from('profiles').select('name').eq('id', creatorId).single();
    pushNotification({
      userId: opponentId,
      type: 'challenge',
      title: `${(creatorProfile as any)?.name ?? 'Someone'} challenged you: "${title.trim()}"`,
      body: `Stake: ${stake} PP · ${days} days · Accept or decline in Challenges`,
      link: '/challenges',
    });
  }

  res.status(201).json(data);
});

// ---------------------------------------------------------------------------
// POST /duels/:id/accept — accept a direct challenge or join an open one
// ---------------------------------------------------------------------------
export const acceptDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { data: duel, error: fetchErr } = await supabase
    .from('duels').select('*').eq('id', id).single();

  if (fetchErr || !duel) throw new NotFoundError('Duel not found.');
  if (duel.status !== 'open' && duel.status !== 'pending') {
    throw new BadRequestError('This challenge is no longer open.');
  }
  if (duel.creator_id === userId) throw new BadRequestError('You cannot accept your own challenge.');
  if (duel.opponent_id && duel.opponent_id !== userId) {
    throw new ForbiddenError('This challenge is directed at someone else.');
  }

  // Opponent must also stake equal PP
  const ok = await deductPP(userId, duel.stake_pp);
  if (!ok) throw new BadRequestError(`Insufficient PP. You need ${duel.stake_pp} PP to accept.`);

  const { error: updateErr } = await supabase
    .from('duels')
    .update({ status: 'active', opponent_id: userId })
    .eq('id', id);

  if (updateErr) {
    await awardPP(userId, duel.stake_pp); // refund
    throw new InternalServerError('Failed to accept duel.');
  }

  // Notify creator
  pushNotification({
    userId: duel.creator_id,
    type: 'challenge',
    title: 'Your challenge was accepted!',
    body: `"${duel.title}" is now active. Good luck!`,
    link: '/challenges',
  });

  res.json({ success: true, message: 'Challenge accepted! Game on.' });
});

// ---------------------------------------------------------------------------
// POST /duels/:id/decline — decline a direct challenge (refunds creator)
// ---------------------------------------------------------------------------
export const declineDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { data: duel } = await supabase.from('duels').select('*').eq('id', id).single();
  if (!duel) throw new NotFoundError('Duel not found.');
  if (duel.opponent_id !== userId) throw new ForbiddenError('This challenge is not directed at you.');
  if (duel.status !== 'pending') throw new BadRequestError('Challenge is not pending.');

  await supabase.from('duels').update({ status: 'declined' }).eq('id', id);

  // Refund creator's stake in full
  await awardPP(duel.creator_id, duel.stake_pp);

  pushNotification({
    userId: duel.creator_id,
    type: 'challenge',
    title: 'Challenge declined',
    body: `Your challenge "${duel.title}" was declined. Your ${duel.stake_pp} PP has been refunded.`,
    link: '/challenges',
  });

  res.json({ success: true, message: 'Challenge declined.' });
});

// ---------------------------------------------------------------------------
// POST /duels/:id/cancel — creator cancels before opponent accepts
// ---------------------------------------------------------------------------
export const cancelDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { data: duel } = await supabase.from('duels').select('*').eq('id', id).single();
  if (!duel) throw new NotFoundError('Duel not found.');
  if (duel.creator_id !== userId) throw new ForbiddenError('Only the creator can cancel.');
  if (!['open', 'pending'].includes(duel.status)) {
    throw new BadRequestError('Can only cancel open or pending challenges.');
  }

  await supabase.from('duels').update({ status: 'cancelled' }).eq('id', id);

  // Full refund since no opponent has accepted yet
  await awardPP(userId, duel.stake_pp);

  res.json({ success: true, message: 'Challenge cancelled. Full refund issued.' });
});

// ---------------------------------------------------------------------------
// POST /duels/:id/claim — claim you completed the challenge
// Both parties can claim. Resolution logic: see resolveDuel().
// ---------------------------------------------------------------------------
export const claimDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { data: duel } = await supabase.from('duels').select('*').eq('id', id).single();
  if (!duel) throw new NotFoundError('Duel not found.');
  if (duel.status !== 'active') throw new BadRequestError('Duel is not active.');

  const isCreator = duel.creator_id === userId;
  const isOpponent = duel.opponent_id === userId;
  if (!isCreator && !isOpponent) throw new ForbiddenError('You are not part of this duel.');

  // Mark this user's claim
  const updateField = isCreator ? { creator_claimed: true } : { opponent_claimed: true };
  await supabase.from('duels').update(updateField).eq('id', id);

  // Re-fetch to check both claims
  const { data: updated } = await supabase.from('duels').select('*').eq('id', id).single();
  if (!updated) throw new InternalServerError('Failed to update duel.');

  // Resolve if both have claimed
  if (updated.creator_claimed && updated.opponent_claimed) {
    await resolveDuel(updated);
    return res.json({ success: true, message: 'Both parties claimed — duel resolved! Winner gets the pot.' });
  }

  // Notify the other party to also claim (or concede)
  const otherId = isCreator ? duel.opponent_id : duel.creator_id;
  if (otherId) {
    pushNotification({
      userId: otherId,
      type: 'challenge',
      title: 'Your opponent claimed victory!',
      body: `Claim your win or concede in the Challenges tab — "${duel.title}"`,
      link: '/challenges',
    });
  }

  res.json({ success: true, message: 'Win claimed! Waiting for opponent to respond.' });
});

// ---------------------------------------------------------------------------
// POST /duels/:id/concede — admit defeat; opponent wins
// ---------------------------------------------------------------------------
export const concedeDuel = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { data: duel } = await supabase.from('duels').select('*').eq('id', id).single();
  if (!duel) throw new NotFoundError('Duel not found.');
  if (duel.status !== 'active') throw new BadRequestError('Duel is not active.');

  const isCreator = duel.creator_id === userId;
  const isOpponent = duel.opponent_id === userId;
  if (!isCreator && !isOpponent) throw new ForbiddenError('You are not part of this duel.');

  const winnerId = isCreator ? duel.opponent_id : duel.creator_id;
  await supabase.from('duels')
    .update({ status: 'completed', won_by: winnerId })
    .eq('id', id);

  await awardWinner(winnerId, duel.stake_pp, duel.title);
  res.json({ success: true, message: 'You conceded. Better luck next time!' });
});

// ---------------------------------------------------------------------------
// Internal: resolve a duel where both parties have claimed
// ---------------------------------------------------------------------------

/**
 * Called when both creator_claimed and opponent_claimed are true.
 *
 * Resolution strategy: when both parties claim they won, the system needs
 * to pick a winner. Currently uses a "first-claim" tiebreak:
 * whoever filed their claim first (lower created_at of the claim row) wins.
 * This encourages prompt completion reporting.
 *
 * Alternative strategies you could implement here:
 *   - Community vote: create a poll visible to matched users
 *   - Peer verification: route to the existing completionController flow
 *   - Admin arbitration: flag for manual review
 *   - Random tiebreak (fair but unsatisfying)
 */
async function resolveDuel(duel: any): Promise<void> {
  // Both claimed: tiebreak by who claimed first.
  // creator_claimed_at vs opponent_claimed_at track timestamps.
  // If equal (same update tick), creator wins (they took initiative to challenge).
  const winnerId = duel.creator_claimed_at && duel.opponent_claimed_at
    ? (new Date(duel.creator_claimed_at) <= new Date(duel.opponent_claimed_at)
        ? duel.creator_id
        : duel.opponent_id)
    : (duel.creator_claimed ? duel.creator_id : duel.opponent_id);

  await supabase.from('duels')
    .update({ status: 'completed', won_by: winnerId })
    .eq('id', duel.id);

  await awardWinner(winnerId, duel.stake_pp, duel.title);
}

async function awardWinner(winnerId: string, stakePerSide: number, title: string): Promise<void> {
  // Winner gets both stakes minus house fee: 2 × stake × (1 - HOUSE_FEE)
  const winnings = Math.floor(stakePerSide * 2 * (1 - HOUSE_FEE));
  await awardPP(winnerId, winnings);
  pushNotification({
    userId: winnerId,
    type: 'challenge',
    title: `You won the duel! +${winnings} PP`,
    body: `"${title}" — ${winnings} PP added to your balance.`,
    link: '/challenges',
  });
  logger.info(`Duel resolved: winner ${winnerId} awarded ${winnings} PP`);
}
