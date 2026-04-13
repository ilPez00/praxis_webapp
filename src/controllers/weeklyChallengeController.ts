/**
 * Weekly Challenge Track Controller
 * 7-tier weekly progression system — cumulative XP thresholds reset each Monday
 */

import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError } from '../utils/appErrors';
import logger from '../utils/logger';

// =============================================================================
// Configuration — 7 tiers per week
// =============================================================================

const WEEKLY_TIERS = [
  { tier: 1, xp_threshold:   100, pp_reward: 10, xp_reward:  50, label: 'Warm-Up',     badge: null },
  { tier: 2, xp_threshold:   300, pp_reward: 20, xp_reward: 100, label: 'Getting Going', badge: null },
  { tier: 3, xp_threshold:   600, pp_reward: 30, xp_reward: 150, label: 'On Track',     badge: null },
  { tier: 4, xp_threshold:  1000, pp_reward: 50, xp_reward: 200, label: 'Strong Week',  badge: 'weekly_strong' },
  { tier: 5, xp_threshold:  1500, pp_reward: 75, xp_reward: 300, label: 'Powerhouse',   badge: null },
  { tier: 6, xp_threshold:  2200, pp_reward: 100, xp_reward: 400, label: 'Unstoppable',  badge: null },
  { tier: 7, xp_threshold:  3000, pp_reward: 150, xp_reward: 500, label: 'Weekly Legend', badge: 'weekly_legend' },
];

/** Returns ISO week string like "2026-W15" */
function getCurrentWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Returns days left until next Monday 00:00 UTC */
function daysLeftInWeek(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon...
  return day === 0 ? 1 : 8 - day;
}

// =============================================================================
// GET /weekly-challenge — current week progress
// =============================================================================

export const getWeeklyProgress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const weekKey = getCurrentWeekKey();

  // Upsert a row for this week if it doesn't exist
  const { data: progress } = await supabase
    .from('weekly_challenge_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('week_key', weekKey)
    .maybeSingle();

  const weeklyXP = progress?.weekly_xp ?? 0;
  const claimedTiers: number[] = progress?.claimed_tiers ?? [];

  // Calculate current tier and next threshold
  let currentTier = 0;
  for (const t of WEEKLY_TIERS) {
    if (weeklyXP >= t.xp_threshold) currentTier = t.tier;
    else break;
  }

  const nextTier = WEEKLY_TIERS.find(t => t.tier === currentTier + 1);

  return res.json({
    weekKey,
    weeklyXP,
    currentTier,
    daysLeft: daysLeftInWeek(),
    tiers: WEEKLY_TIERS.map(t => ({
      ...t,
      unlocked: weeklyXP >= t.xp_threshold,
      claimed: claimedTiers.includes(t.tier),
    })),
    nextTier: nextTier ? {
      tier: nextTier.tier,
      xpNeeded: nextTier.xp_threshold - weeklyXP,
      xpThreshold: nextTier.xp_threshold,
    } : null,
  });
});

// =============================================================================
// POST /weekly-challenge/add-xp — called internally when user earns XP
// =============================================================================

export const addWeeklyXP = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { amount, source } = req.body as { amount?: number; source?: string };
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!amount || amount <= 0) throw new BadRequestError('amount must be positive');

  const weekKey = getCurrentWeekKey();

  // Get or create weekly progress
  const { data: existing } = await supabase
    .from('weekly_challenge_progress')
    .select('id, weekly_xp, claimed_tiers')
    .eq('user_id', userId)
    .eq('week_key', weekKey)
    .maybeSingle();

  const oldXP = existing?.weekly_xp ?? 0;
  const newXP = oldXP + amount;
  const claimedTiers: number[] = existing?.claimed_tiers ?? [];

  if (existing) {
    await supabase
      .from('weekly_challenge_progress')
      .update({ weekly_xp: newXP })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('weekly_challenge_progress')
      .insert({ user_id: userId, week_key: weekKey, weekly_xp: newXP, claimed_tiers: [] });
  }

  // Check which tiers were just unlocked
  const newlyUnlocked = WEEKLY_TIERS.filter(
    t => oldXP < t.xp_threshold && newXP >= t.xp_threshold
  );

  return res.json({
    weeklyXP: newXP,
    newlyUnlocked: newlyUnlocked.map(t => ({
      tier: t.tier,
      label: t.label,
      pp_reward: t.pp_reward,
      xp_reward: t.xp_reward,
    })),
  });
});

// =============================================================================
// POST /weekly-challenge/claim/:tier — claim a tier reward
// =============================================================================

export const claimTierReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const tier = parseInt(req.params.tier as string, 10);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const tierConfig = WEEKLY_TIERS.find(t => t.tier === tier);
  if (!tierConfig) throw new BadRequestError('Invalid tier');

  const weekKey = getCurrentWeekKey();

  const { data: progress } = await supabase
    .from('weekly_challenge_progress')
    .select('id, weekly_xp, claimed_tiers')
    .eq('user_id', userId)
    .eq('week_key', weekKey)
    .maybeSingle();

  if (!progress) throw new BadRequestError('No weekly progress found');
  if ((progress.weekly_xp ?? 0) < tierConfig.xp_threshold) {
    throw new BadRequestError('Tier not yet unlocked');
  }

  const claimedTiers: number[] = progress.claimed_tiers ?? [];
  if (claimedTiers.includes(tier)) {
    throw new BadRequestError('Tier already claimed');
  }

  // Mark tier as claimed
  claimedTiers.push(tier);
  await supabase
    .from('weekly_challenge_progress')
    .update({ claimed_tiers: claimedTiers })
    .eq('id', progress.id);

  // Award PP + XP
  await supabase.rpc('add_xp_to_user', {
    p_user_id: userId,
    p_xp_amount: tierConfig.xp_reward,
    p_pp_amount: tierConfig.pp_reward,
    p_source: `weekly_tier_${tier}`,
  });

  // Award badge if applicable
  if (tierConfig.badge) {
    await supabase.from('user_badges').upsert(
      { user_id: userId, badge_key: tierConfig.badge, earned_at: new Date().toISOString() },
      { onConflict: 'user_id,badge_key' }
    );
  }

  logger.info(`[WeeklyChallenge] User ${userId} claimed tier ${tier} (${tierConfig.label})`);

  return res.json({
    success: true,
    tier,
    label: tierConfig.label,
    pp_earned: tierConfig.pp_reward,
    xp_earned: tierConfig.xp_reward,
    badge: tierConfig.badge,
  });
});

// =============================================================================
// GET /weekly-challenge/history — past weeks
// =============================================================================

export const getWeeklyHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { data: history } = await supabase
    .from('weekly_challenge_progress')
    .select('week_key, weekly_xp, claimed_tiers')
    .eq('user_id', userId)
    .order('week_key', { ascending: false })
    .limit(12);

  return res.json({
    history: (history ?? []).map(h => {
      let maxTier = 0;
      for (const t of WEEKLY_TIERS) {
        if (h.weekly_xp >= t.xp_threshold) maxTier = t.tier;
      }
      return {
        weekKey: h.week_key,
        weeklyXP: h.weekly_xp,
        maxTier,
        maxLabel: WEEKLY_TIERS[maxTier - 1]?.label ?? 'None',
        claimedAll: (h.claimed_tiers ?? []).length >= maxTier,
      };
    }),
  });
});
