import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError } from '../utils/appErrors';
import { pushNotification } from './notificationController';

/**
 * GET /open-bets
 * List open bets available to join (status='open'), newest first.
 */
export const listOpenBets = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const domain = req.query.domain as string | undefined;

  let query = supabase
    .from('open_bets')
    .select(`
      id, title, description, domain, stake_points, stake_euros,
      is_real_money, deadline, max_participants, status, created_at, creator_id,
      creator:profiles!creator_id(id, name, avatar_url),
      open_bet_participants(user_id, status)
    `)
    .eq('status', 'open')
    .gte('deadline', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (domain) query = query.eq('domain', domain);

  const { data, error } = await query;
  if (error) throw error;

  // Annotate with participant count + whether current user joined
  const bets = (data ?? []).map((bet: any) => ({
    ...bet,
    participant_count: (bet.open_bet_participants ?? []).length,
    joined: userId ? (bet.open_bet_participants ?? []).some((p: any) => p.user_id === userId) : false,
    open_bet_participants: undefined,
  }));

  res.json(bets);
});

/**
 * GET /open-bets/mine
 * Open bets created by or joined by the current user.
 */
export const myOpenBets = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new BadRequestError('Authentication required.');

  const [created, joined] = await Promise.all([
    supabase
      .from('open_bets')
      .select(`
        id, title, description, domain, stake_points, stake_euros,
        is_real_money, deadline, max_participants, status, created_at,
        open_bet_participants(user_id, status)
      `)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('open_bet_participants')
      .select(`
        status, joined_at,
        open_bet:open_bets(
          id, title, description, domain, stake_points, stake_euros,
          is_real_money, deadline, max_participants, status, created_at, creator_id,
          creator:profiles!creator_id(id, name, avatar_url)
        )
      `)
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(20),
  ]);

  res.json({
    created: (created.data ?? []).map((bet: any) => ({
      ...bet,
      participant_count: (bet.open_bet_participants ?? []).length,
      open_bet_participants: undefined,
    })),
    joined: (joined.data ?? [])
      .filter((p: any) => p.open_bet)
      .map((p: any) => ({
        ...p.open_bet,
        my_status: p.status,
        joined_at: p.joined_at,
      })),
  });
});

/**
 * POST /open-bets
 * Create a new open bet challenge.
 */
export const createOpenBet = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new BadRequestError('Authentication required.');

  const { title, description, domain, stakePoints, stakeEuros, isRealMoney, deadline, maxParticipants } = req.body;

  if (!title?.trim()) throw new BadRequestError('title is required.');
  if (!deadline) throw new BadRequestError('deadline is required.');
  if (!stakePoints && !stakeEuros) throw new BadRequestError('stake_points or stake_euros is required.');
  if (new Date(deadline) <= new Date()) throw new BadRequestError('deadline must be in the future.');

  const stake = parseInt(stakePoints) || 0;
  const euros = parseFloat(stakeEuros) || 0;

  // Deduct PP stake from creator immediately
  if (stake > 0) {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('praxis_points')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) throw new BadRequestError('Profile not found.');
    if ((profile.praxis_points ?? 0) < stake) {
      throw new BadRequestError(`Insufficient PP. You have ${profile.praxis_points}, need ${stake}.`);
    }

    await supabase
      .from('profiles')
      .update({ praxis_points: (profile.praxis_points ?? 0) - stake })
      .eq('id', userId);
  }

  const { data: bet, error } = await supabase
    .from('open_bets')
    .insert({
      creator_id: userId,
      title: title.trim(),
      description: description?.trim() || null,
      domain: domain || null,
      stake_points: stake,
      stake_euros: euros || null,
      is_real_money: isRealMoney ?? false,
      deadline,
      max_participants: Math.min(parseInt(maxParticipants) || 10, 100),
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;

  // Creator auto-joins
  await supabase.from('open_bet_participants').insert({
    open_bet_id: bet.id,
    user_id: userId,
    status: 'active',
  });

  logger.info(`[openBets] Created open bet ${bet.id} by ${userId}`);
  res.status(201).json(bet);
});

/**
 * POST /open-bets/:id/join
 * Join an open bet.
 */
export const joinOpenBet = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new BadRequestError('Authentication required.');

  const { id } = req.params;

  const { data: bet, error: betErr } = await supabase
    .from('open_bets')
    .select('*, open_bet_participants(user_id)')
    .eq('id', id)
    .single();

  if (betErr || !bet) throw new NotFoundError('Open bet not found.');
  if (bet.status !== 'open') throw new BadRequestError('This bet is no longer open for joining.');
  if (new Date(bet.deadline) <= new Date()) throw new BadRequestError('Bet deadline has passed.');

  const participants = bet.open_bet_participants ?? [];
  if (participants.some((p: any) => p.user_id === userId)) {
    throw new BadRequestError('Already joined this bet.');
  }
  if (participants.length >= bet.max_participants) {
    throw new BadRequestError('Bet is full.');
  }

  // Deduct PP
  if (bet.stake_points > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('praxis_points')
      .eq('id', userId)
      .single();

    if ((profile?.praxis_points ?? 0) < bet.stake_points) {
      throw new BadRequestError(`Insufficient PP. Need ${bet.stake_points}.`);
    }
    await supabase
      .from('profiles')
      .update({ praxis_points: (profile!.praxis_points ?? 0) - bet.stake_points })
      .eq('id', userId);
  }

  await supabase.from('open_bet_participants').insert({
    open_bet_id: id,
    user_id: userId,
    status: 'active',
  });

  // Notify creator
  try {
    await pushNotification({ userId: bet.creator_id, type: 'bet_result', title: 'Someone joined your challenge!', body: bet.title, link: '/open-bets' });
  } catch {}

  logger.info(`[openBets] User ${userId} joined bet ${id}`);
  res.json({ joined: true });
});

/**
 * DELETE /open-bets/:id/leave
 * Leave an open bet (only if still open and not the creator).
 */
export const leaveOpenBet = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new BadRequestError('Authentication required.');

  const { id } = req.params;

  const { data: bet } = await supabase
    .from('open_bets')
    .select('creator_id, stake_points, status')
    .eq('id', id)
    .single();

  if (!bet) throw new NotFoundError('Bet not found.');
  if (bet.creator_id === userId) throw new ForbiddenError('Creator cannot leave their own bet. Cancel it instead.');
  if (bet.status !== 'open') throw new BadRequestError('Cannot leave a bet that has already started.');

  await supabase.from('open_bet_participants')
    .delete()
    .eq('open_bet_id', id)
    .eq('user_id', userId);

  // Refund PP
  if (bet.stake_points > 0) {
    const { data: profile } = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
    await supabase.from('profiles')
      .update({ praxis_points: (profile?.praxis_points ?? 0) + bet.stake_points })
      .eq('id', userId);
  }

  res.json({ left: true });
});

/**
 * PATCH /open-bets/:id/resolve
 * Creator marks bet as resolved; sets winner statuses.
 * Body: { winners: string[] } — array of user_ids who won
 */
export const resolveOpenBet = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new BadRequestError('Authentication required.');

  const { id } = req.params;
  const { winners } = req.body as { winners: string[] };

  const { data: bet } = await supabase
    .from('open_bets')
    .select('*, open_bet_participants(user_id, status)')
    .eq('id', id)
    .single();

  if (!bet) throw new NotFoundError('Bet not found.');
  if (bet.creator_id !== userId) throw new ForbiddenError('Only the creator can resolve this bet.');
  if (bet.status === 'resolved') throw new BadRequestError('Already resolved.');

  const participants: { user_id: string }[] = bet.open_bet_participants ?? [];
  const winnerSet = new Set(winners ?? []);
  const loserIds = participants.filter(p => !winnerSet.has(p.user_id)).map(p => p.user_id);
  const winnerIds = participants.filter(p => winnerSet.has(p.user_id)).map(p => p.user_id);

  // Reward winners: stake back + 20% bonus pool from losers
  const loserPool = loserIds.length * bet.stake_points;
  const bonusEach = winnerIds.length > 0 ? Math.floor(loserPool * 0.8 / winnerIds.length) : 0;
  const winReward = bet.stake_points + bonusEach;

  await Promise.all([
    // Mark statuses
    winnerIds.length > 0 && supabase.from('open_bet_participants')
      .update({ status: 'won' })
      .eq('open_bet_id', id)
      .in('user_id', winnerIds),
    loserIds.length > 0 && supabase.from('open_bet_participants')
      .update({ status: 'lost' })
      .eq('open_bet_id', id)
      .in('user_id', loserIds),
    // Payout winners
    ...winnerIds.map(async winnerId => {
      const { data: p } = await supabase.from('profiles').select('praxis_points').eq('id', winnerId).single();
      await supabase.from('profiles')
        .update({ praxis_points: (p?.praxis_points ?? 0) + winReward })
        .eq('id', winnerId);
      try { await pushNotification({ userId: winnerId, type: 'bet_result', title: '🏆 You won!', body: `+${winReward} PP from "${bet.title}"`, link: '/open-bets' }); } catch {}
    }),
    // Notify losers
    ...loserIds.map(async loserId => {
      try { await pushNotification({ userId: loserId, type: 'bet_result', title: 'Challenge ended', body: `You lost the "${bet.title}" challenge.`, link: '/open-bets' }); } catch {}
    }),
    // Close bet
    supabase.from('open_bets').update({ status: 'resolved' }).eq('id', id),
  ]);

  logger.info(`[openBets] Resolved bet ${id}: ${winnerIds.length} winners, ${loserIds.length} losers`);
  res.json({ resolved: true, winners: winnerIds.length, losers: loserIds.length, reward: winReward });
});

/**
 * GET /open-bets/:id/participants
 * List participants for a bet (for resolve dialog).
 */
export const getParticipants = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('open_bet_participants')
    .select('user_id, status, joined_at, profile:profiles!user_id(name, avatar_url)')
    .eq('open_bet_id', id);

  if (error) throw error;
  const participants = (data ?? []).map((p: any) => ({
    user_id: p.user_id,
    name: p.profile?.name || 'User',
    avatar_url: p.profile?.avatar_url || null,
    status: p.status,
    joined_at: p.joined_at,
  }));
  res.json(participants);
});

/**
 * DELETE /open-bets/:id
 * Creator cancels their open bet (only if status=open).
 */
export const cancelOpenBet = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new BadRequestError('Authentication required.');

  const { id } = req.params;

  const { data: bet } = await supabase
    .from('open_bets')
    .select('creator_id, stake_points, status, open_bet_participants(user_id)')
    .eq('id', id)
    .single();

  if (!bet) throw new NotFoundError('Bet not found.');
  if (bet.creator_id !== userId) throw new ForbiddenError('Only the creator can cancel this bet.');
  if (bet.status !== 'open') throw new BadRequestError('Only open bets can be cancelled.');

  const participants: { user_id: string }[] = bet.open_bet_participants ?? [];

  // Refund all participants
  if (bet.stake_points > 0 && participants.length > 0) {
    await Promise.all(participants.map(async p => {
      const { data: profile } = await supabase.from('profiles').select('praxis_points').eq('id', p.user_id).single();
      await supabase.from('profiles')
        .update({ praxis_points: (profile?.praxis_points ?? 0) + bet.stake_points })
        .eq('id', p.user_id);
    }));
  }

  await supabase.from('open_bets').update({ status: 'cancelled' }).eq('id', id);

  res.json({ cancelled: true });
});
