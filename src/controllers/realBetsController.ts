import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors';
import { pushNotification } from './notificationController';

let _stripe: Stripe;

function ensureStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new InternalServerError('Stripe secret key not configured.');
  _stripe = new Stripe(key, { apiVersion: '2026-01-28.clover' as unknown as Stripe.LatestApiVersion });
  return _stripe;
}

const MIN_EUROS = 1;
const MAX_EUROS = 500;
const PLATFORM_FEE_PCT = 0.08; // 8% of stake on win; loss goes fully to charity

/**
 * POST /bets/real/checkout
 * Creates Stripe Checkout Session in payment mode.
 * Inserts a pending bet record; webhook activates it on payment confirmation.
 * Body: { goalName, goalNodeId?, deadline, stakeEuros }
 */
export const createRealBetCheckout = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const email = req.user?.email;
  const { goalName, goalNodeId, deadline, stakeEuros } = req.body;

  if (!userId || !email) throw new BadRequestError('Authentication required.');
  if (!goalName || !deadline || stakeEuros == null) {
    throw new BadRequestError('goalName, deadline, and stakeEuros are required.');
  }

  const euros = parseFloat(stakeEuros);
  if (isNaN(euros) || euros < MIN_EUROS || euros > MAX_EUROS) {
    throw new BadRequestError(`Stake must be between €${MIN_EUROS} and €${MAX_EUROS}.`);
  }

  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
    throw new BadRequestError('Deadline must be in the future.');
  }

  const { count: activeCount } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_real_money', true)
    .in('status', ['active', 'pending']);

  if ((activeCount ?? 0) >= 3) {
    throw new BadRequestError('You can have at most 3 active real-money bets.');
  }

  const { data: bet, error: betError } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      goal_node_id: goalNodeId || null,
      goal_name: goalName,
      deadline,
      stake_points: 0,
      stake_euros: euros,
      is_real_money: true,
      status: 'pending',
    })
    .select()
    .single();

  if (betError || !bet) {
    logger.error('[createRealBetCheckout] Bet insert failed:', betError);
    throw new InternalServerError('Failed to create bet record.');
  }

  const amountCents = Math.round(euros * 100);
  const deadlineStr = new Date(deadline).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const session = await ensureStripe().checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: amountCents,
        product_data: {
          name: `Real commitment: "${goalName}"`,
          description: `Held in escrow until ${deadlineStr}. Win → refund + PP bonus. Miss → donated to charity.`,
        },
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/commitments?bet_placed=real&betId=${bet.id}`,
    cancel_url: `${process.env.CLIENT_URL}/commitments?bet_cancelled=1`,
    client_reference_id: userId,
    customer_email: email,
    metadata: {
      purchase_type: 'real_bet',
      userId,
      betId: bet.id,
      goalName,
      stakeEuros: String(euros),
    },
  });

  await supabase
    .from('bets')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', bet.id);

  logger.info(`[createRealBetCheckout] Pending bet ${bet.id}, session ${session.id}`);
  res.status(200).json({ url: session.url, betId: bet.id, sessionId: session.id });
});

/**
 * Internal: called from resolveBetsOnGoalCompletion for real-money bets.
 * Issues partial Stripe refund (stake minus 8% platform fee) + PP bonus.
 */
export const resolveRealBetWin = async (userId: string, goalNodeId: string): Promise<void> => {
  try {
    const { data: activeBets } = await supabase
      .from('bets')
      .select('id, user_id, goal_node_id, goal_name, stake_euros, stripe_payment_intent_id')
      .eq('user_id', userId)
      .eq('goal_node_id', goalNodeId)
      .eq('is_real_money', true)
      .eq('status', 'active');

    if (!activeBets || activeBets.length === 0) return;

    for (const bet of activeBets) {
      if (!bet.stripe_payment_intent_id) {
        logger.warn(`[resolveRealBetWin] Bet ${bet.id} missing payment_intent_id — skipping refund`);
        continue;
      }

      const stakeEuros = parseFloat(bet.stake_euros ?? '0');
      const totalCents = Math.round(stakeEuros * 100);
      const feeCents = Math.round(totalCents * PLATFORM_FEE_PCT);
      const refundCents = totalCents - feeCents;

      try {
        await ensureStripe().refunds.create({
          payment_intent: bet.stripe_payment_intent_id,
          amount: refundCents,
        });
        logger.info(`[resolveRealBetWin] Refunded €${(refundCents / 100).toFixed(2)} for bet ${bet.id}`);
      } catch (stripeErr) {
        logger.error(`[resolveRealBetWin] Stripe refund failed for bet ${bet.id}:`, stripeErr);
        // Mark won anyway — manual refund can be triggered from Stripe dashboard
      }

      await supabase.from('bets').update({ status: 'won' }).eq('id', bet.id);

      // 50 PP per €1 staked as win bonus
      const ppBonus = Math.round(stakeEuros * 50);
      const { data: profile } = await supabase
        .from('profiles')
        .select('praxis_points')
        .eq('id', userId)
        .single();
      await supabase
        .from('profiles')
        .update({ praxis_points: (profile?.praxis_points ?? 0) + ppBonus })
        .eq('id', userId);

      await supabase.rpc('add_xp_to_user', {
        p_user_id: userId,
        p_xp_amount: ppBonus * 2,
        p_pp_amount: 0,
        p_source: 'real_bet_win',
      }).then(({ error }) => { if (error) logger.warn('XP rpc failed:', error); });

      pushNotification({
        userId,
        type: 'bet_result',
        title: `Real commitment won! €${(refundCents / 100).toFixed(2)} refunded + ${ppBonus} PP bonus for "${bet.goal_name}"`,
        link: '/commitments',
      });

      logger.info(`[resolveRealBetWin] Bet ${bet.id} WON: €${(refundCents / 100).toFixed(2)} refunded, +${ppBonus} PP`);
    }
  } catch (err) {
    logger.error('[resolveRealBetWin] Non-fatal:', err);
  }
};

/**
 * Internal: sweeps expired real-money bets.
 * Stale pending (>2h, payment never confirmed): cancelled.
 * Active past deadline: marked lost + charity_logged.
 */
export const resolveExpiredRealBets = async (): Promise<{ resolved: number; charityTotalEuros: number }> => {
  const now = new Date().toISOString();
  let resolved = 0;
  let charityTotalEuros = 0;

  // Cancel stale pending bets (payment window expired)
  const staleCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: stalePending } = await supabase
    .from('bets')
    .select('id')
    .eq('is_real_money', true)
    .eq('status', 'pending')
    .lt('created_at', staleCutoff);

  if (stalePending && stalePending.length > 0) {
    await supabase
      .from('bets')
      .update({ status: 'cancelled' })
      .in('id', stalePending.map(b => b.id));
    logger.info(`[resolveExpiredRealBets] Cancelled ${stalePending.length} stale pending real-money bets`);
  }

  // Expire active real-money bets past deadline
  const { data: expiredBets } = await supabase
    .from('bets')
    .select('id, user_id, goal_name, stake_euros, stripe_payment_intent_id')
    .eq('is_real_money', true)
    .eq('status', 'active')
    .eq('charity_logged', false)
    .lt('deadline', now);

  if (!expiredBets || expiredBets.length === 0) {
    return { resolved, charityTotalEuros };
  }

  for (const bet of expiredBets) {
    const { error } = await supabase
      .from('bets')
      .update({ status: 'lost', charity_logged: true })
      .eq('id', bet.id);

    if (!error) {
      resolved++;
      const stake = parseFloat(bet.stake_euros ?? '0');
      charityTotalEuros += stake;

      pushNotification({
        userId: bet.user_id,
        type: 'bet_result',
        title: `Commitment missed: "${bet.goal_name}" — €${stake.toFixed(2)} donated to charity`,
        link: '/commitments',
      });

      logger.info(`[resolveExpiredRealBets] Bet ${bet.id} LOST: €${stake.toFixed(2)} → charity escrow`);
    }
  }

  if (charityTotalEuros > 0) {
    logger.info(`[resolveExpiredRealBets] €${charityTotalEuros.toFixed(2)} across ${resolved} bets queued for charity Stripe transfer`);
  }

  return { resolved, charityTotalEuros };
};
