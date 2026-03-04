import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, NotFoundError } from '../utils/appErrors';

/**
 * Computes streak update from last_activity_date.
 * Mirrors the logic in goalController.ts.
 */
function computeStreakUpdate(
  lastActivityDate: string | null | undefined,
  currentStreak: number
): { current_streak: number; last_activity_date: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  if (!lastActivityDate) {
    return { current_streak: 1, last_activity_date: todayStr };
  }

  const last = new Date(lastActivityDate);
  last.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);

  if (diffDays === 0) {
    return { current_streak: currentStreak, last_activity_date: todayStr };
  } else if (diffDays === 1) {
    return { current_streak: currentStreak + 1, last_activity_date: todayStr };
  } else {
    return { current_streak: 1, last_activity_date: todayStr };
  }
}

/**
 * POST /checkins
 * Body: { userId }
 * Awards 10 praxis_points and updates streak.
 */
export const checkIn = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Verify user exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, current_streak, last_activity_date, praxis_points')
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

  // Compute new streak
  const streakUpdate = computeStreakUpdate(
    profile.last_activity_date,
    profile.current_streak ?? 0
  );

  const newPoints = (profile.praxis_points ?? 0) + 10;

  // Insert checkin record
  await supabase.from('checkins').insert({
    user_id: userId,
    streak_day: streakUpdate.current_streak,
  });

  // Update profile
  await supabase
    .from('profiles')
    .update({
      current_streak: streakUpdate.current_streak,
      last_activity_date: streakUpdate.last_activity_date,
      praxis_points: newPoints,
    })
    .eq('id', userId);

  return res.json({
    alreadyCheckedIn: false,
    streak: streakUpdate.current_streak,
    pointsAwarded: 10,
    totalPoints: newPoints,
  });
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
