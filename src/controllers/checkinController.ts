import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, NotFoundError } from '../utils/appErrors';
import { cacheDelete } from '../utils/cache';

/**
 * Computes streak update from last_activity_date.
 * Mirrors the logic in goalController.ts.
 */
function computeStreakUpdate(
  lastActivityDate: string | null | undefined,
  currentStreak: number,
  streakShield: boolean = false
): { current_streak: number; last_activity_date: string; shield_consumed: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  if (!lastActivityDate) {
    return { current_streak: 1, last_activity_date: todayStr, shield_consumed: false };
  }

  const last = new Date(lastActivityDate);
  last.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);

  if (diffDays === 0) {
    return { current_streak: currentStreak, last_activity_date: todayStr, shield_consumed: false };
  } else if (diffDays === 1) {
    return { current_streak: currentStreak + 1, last_activity_date: todayStr, shield_consumed: false };
  } else if (streakShield) {
    // Shield absorbs the missed day — keep streak, consume shield
    return { current_streak: currentStreak, last_activity_date: todayStr, shield_consumed: true };
  } else {
    return { current_streak: 1, last_activity_date: todayStr, shield_consumed: false };
  }
}

/**
 * POST /checkins
 * Body: { userId }
 * Awards 10 praxis_points and updates streak.
 */
export const checkIn = catchAsync(async (req: Request, res: Response) => {
  const { userId, mood, winOfTheDay } = req.body as { userId?: string; mood?: string; winOfTheDay?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Verify user exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, current_streak, last_activity_date, praxis_points, streak_shield')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new NotFoundError('User profile not found');
  }

  // Check if already checked in today (UTC date)
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from('checkins')
    .select('id, streak_day')
    .eq('user_id', userId)
    .gte('checked_in_at', `${todayStr}T00:00:00.000Z`)
    .lt('checked_in_at', `${todayStr}T23:59:59.999Z`)
    .maybeSingle();

  if (existing) {
    return res.json({
      alreadyCheckedIn: true,
      streak: profile.current_streak ?? 0,
      points: profile.praxis_points ?? 0,
    });
  }

  // Compute new streak (shield absorbs a missed day if active)
  const streakUpdate = computeStreakUpdate(
    profile.last_activity_date,
    profile.current_streak ?? 0,
    profile.streak_shield ?? false
  );

  // Base 5 PP + streak bonus: +10 at 7d, +20 at 30d — total 10–25 PP/day
  const streakBonus =
    streakUpdate.current_streak >= 30 ? 20 :
    streakUpdate.current_streak >= 7  ? 10 : 5;
  const DAILY_CHECKIN_CAP = 50; // hard anti-inflation guard
  const pointsAwarded = Math.min(5 + streakBonus, DAILY_CHECKIN_CAP);
  const newPoints = (profile.praxis_points ?? 0) + pointsAwarded;
  
  // XP calculation: base 20 XP + streak bonus (×2 at 7d, ×3 at 30d)
  const xpMultiplier = 
    streakUpdate.current_streak >= 30 ? 3 :
    streakUpdate.current_streak >= 7  ? 2 : 1;
  const xpAwarded = 20 * xpMultiplier;

  // Insert checkin record
  await supabase.from('checkins').insert({
    user_id: userId,
    streak_day: streakUpdate.current_streak,
    ...(mood ? { mood } : {}),
    ...(winOfTheDay ? { win_of_the_day: winOfTheDay } : {}),
  });

  // Award XP and PP using the gamification function
  const { data: levelData } = await supabase.rpc('add_xp_to_user', {
    p_user_id: userId,
    p_xp_amount: xpAwarded,
    p_pp_amount: pointsAwarded,
    p_source: 'daily_checkin',
  });
  
  const { data: profileWithLevel } = await supabase
    .from('profiles')
    .select('level')
    .eq('id', userId)
    .single();
  
  const leveledUp = levelData?.[0]?.leveled_up || false;
  const newLevel = levelData?.[0]?.new_level || profileWithLevel?.level || 1;

  // Progress daily quest for check-in
  await supabase.rpc('progress_user_quest', {
    p_user_id: userId,
    p_quest_type: 'check_in',
    p_amount: 1,
  });
  
  // Check for streak milestone achievements
  if (streakUpdate.current_streak >= 7) {
    await supabase.rpc('check_user_achievements', { p_user_id: userId });
  }

  // Compute Reliability Score R using the whitepaper formula:
  //   R = 0.50*C + 0.25*V + 0.10*S + 0.15*K
  //   C = Check-in Consistency: checkins in last 30 days / 30
  //   V = Verified Completion rate: approved completion_requests / total requested (last 90 days)
  //   S = Streak Stability: min(streak, 30) / 30
  //   K = Karma signal: tanh(karma_score / 50), bounded (-1, 1)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { count: recentCount } = await supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('checked_in_at', thirtyDaysAgo.toISOString());

  // V: peer-verified completions (best-effort — table may not exist yet)
  let verificationRate = 0;
  try {
    const [{ count: approvedCount }, { count: totalCount }] = await Promise.all([
      supabase.from('completion_requests').select('id', { count: 'exact', head: true })
        .eq('requester_id', userId).eq('status', 'approved')
        .gte('created_at', ninetyDaysAgo.toISOString()),
      supabase.from('completion_requests').select('id', { count: 'exact', head: true })
        .eq('requester_id', userId)
        .gte('created_at', ninetyDaysAgo.toISOString()),
    ]);
    if ((totalCount ?? 0) > 0) {
      verificationRate = Math.min((approvedCount ?? 0) / (totalCount ?? 1), 1);
    }
  } catch {
    // Non-fatal — table may not exist in all environments
  }

  const C = Math.min(((recentCount ?? 0) + 1) / 30, 1);
  const V = verificationRate;
  const S = Math.min(streakUpdate.current_streak, 30) / 30;

  // K: karma signal — read from current profile row (written by vote handler)
  const { data: karmaRow } = await supabase.from('profiles').select('karma_score').eq('id', userId).single();
  const K = Math.tanh((karmaRow?.karma_score ?? 0) / 50);

  const reliabilityScore = Math.max(0, Math.min(1, 0.50 * C + 0.25 * V + 0.10 * S + 0.15 * K));

  // Update profile (clear streak shield if it was consumed)
  const profileUpdate: Record<string, unknown> = {
    current_streak: streakUpdate.current_streak,
    last_activity_date: streakUpdate.last_activity_date,
    praxis_points: newPoints,
    reliability_score: reliabilityScore,
  };
  if (streakUpdate.shield_consumed) profileUpdate.streak_shield = false;

  await supabase.from('profiles').update(profileUpdate).eq('id', userId);
  cacheDelete(`dashboard:${userId}`); // invalidate cached summary so fresh checkedIn state is served

  return res.json({
    alreadyCheckedIn: false,
    streak: streakUpdate.current_streak,
    pointsAwarded,
    streakBonus,
    totalPoints: newPoints,
    shieldConsumed: streakUpdate.shield_consumed,
    // Gamification
    xpAwarded,
    leveledUp,
    newLevel,
  });
});

/**
 * GET /checkins/mutual?partnerId=<uuid>
 * Returns the mutual streak: consecutive days both the current user and the partner have checked in.
 */
export const getMutualStreak = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { partnerId } = req.query as { partnerId?: string };
  if (!userId || !partnerId) {
    return res.status(400).json({ error: 'partnerId query param required' });
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const since = ninetyDaysAgo.toISOString();

  const [myRes, partnerRes] = await Promise.all([
    supabase.from('checkins').select('checked_in_at').eq('user_id', userId).gte('checked_in_at', since),
    supabase.from('checkins').select('checked_in_at').eq('user_id', partnerId).gte('checked_in_at', since),
  ]);

  const myDates = new Set((myRes.data || []).map((c: any) => c.checked_in_at.slice(0, 10)));
  const partnerDates = new Set((partnerRes.data || []).map((c: any) => c.checked_in_at.slice(0, 10)));

  // Walk back from today, count consecutive days where both checked in
  let mutualStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    if (myDates.has(dateStr) && partnerDates.has(dateStr)) {
      mutualStreak++;
    } else {
      break;
    }
  }

  return res.json({ mutualStreak });
});

/**
 * GET /checkins/today?userId=<uuid>
 * Returns whether the user has already checked in today.
 */
export const getTodayCheckin = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId query param is required' });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('checkins')
    .select('id, streak_day, checked_in_at')
    .eq('user_id', userId)
    .gte('checked_in_at', `${todayStr}T00:00:00.000Z`)
    .lt('checked_in_at', `${todayStr}T23:59:59.999Z`)
    .maybeSingle();

  return res.json({ checkedIn: !!data, checkin: data ?? null });
});
