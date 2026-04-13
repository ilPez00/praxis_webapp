/**
 * Shared helper: bump weekly challenge XP for a user.
 * Call this whenever a user earns XP from any source.
 * Fire-and-forget — errors are logged but don't propagate.
 */

import { supabase } from '../lib/supabaseClient';
import logger from './logger';

function getCurrentWeekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export async function bumpWeeklyXP(userId: string, xpAmount: number): Promise<void> {
  if (xpAmount <= 0) return;
  try {
    const weekKey = getCurrentWeekKey();
    const { data: existing } = await supabase
      .from('weekly_challenge_progress')
      .select('id, weekly_xp')
      .eq('user_id', userId)
      .eq('week_key', weekKey)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('weekly_challenge_progress')
        .update({ weekly_xp: (existing.weekly_xp ?? 0) + xpAmount })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('weekly_challenge_progress')
        .insert({ user_id: userId, week_key: weekKey, weekly_xp: xpAmount, claimed_tiers: [] });
    }
  } catch (err) {
    logger.warn('[WeeklyXP] Failed to bump weekly XP (non-fatal):', err);
  }
}
