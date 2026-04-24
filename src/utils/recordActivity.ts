import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

/**
 * Records user activity to maintain streak.
 * Called when user performs any activity (post, notebook entry, tracker log, etc.)
 */
export async function recordActivity(userId: string): Promise<void> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, current_streak, last_activity_date, streak_shield')
      .eq('id', userId)
      .single();

    if (profileError || !profile) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    if (!profile.last_activity_date) {
      await supabase.from('profiles').update({
        current_streak: 1,
        last_activity_date: todayStr,
      }).eq('id', userId);
      return;
    }

    const last = new Date(profile.last_activity_date);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);

    let newStreak = profile.current_streak;
    if (diffDays === 0) {
      return;
    } else if (diffDays === 1) {
      newStreak = profile.current_streak + 1;
    } else if (diffDays === 2 && profile.streak_shield) {
      newStreak = profile.current_streak;
    } else {
      newStreak = 1;
    }

    await supabase.from('profiles').update({
      current_streak: newStreak,
      last_activity_date: todayStr,
      ...(diffDays === 2 && profile.streak_shield ? { streak_shield: false } : {}),
    }).eq('id', userId);

    logger.info('[recordActivity] Activity recorded:', { userId, streak: newStreak, date: todayStr });
  } catch (err) {
    logger.warn('[recordActivity] Failed:', err);
  }
}