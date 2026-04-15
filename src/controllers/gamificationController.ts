/**
 * Gamification Controller
 * Handles level system, daily quests, achievements, and social rewards
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, BadRequestError, NotFoundError } from '../utils/appErrors';
import { bumpWeeklyXP } from '../utils/weeklyXP';
import logger from '../utils/logger';

// =============================================================================
// Configuration
// =============================================================================

const SOCIAL_REWARD_LIMITS = {
  posts_per_day: 10,
  posts_pp_each: 2,
  comments_per_day: 20,
  comments_pp_each: 1,
  likes_received_per_day: 50,
  likes_received_pp_each: 0.5,
  first_comment_bonus: 3,
};

const DAILY_QUEST_SLOTS = 3;

// =============================================================================
// Level & XP System
// =============================================================================

/**
 * GET /gamification/profile
 * Get user's gamification profile (level, XP, league, achievements)
 */
export const getGamificationProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id || (req.query.userId as string);
  
  if (!userId) {
    throw new BadRequestError('Authentication or userId required');
  }

  // Get profile with gamification data
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      name,
      avatar_url,
      level,
      total_xp,
      praxis_points,
      league,
      reputation_score,
      equipped_title,
      profile_theme,
      current_streak,
      badge
    `)
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new NotFoundError('User profile not found');
  }

  // Get achievement progress
  const { data: achievements } = await supabase
    .from('user_achievements')
    .select(`
      *,
      achievements_master (
        id,
        achievement_key,
        title,
        description,
        icon,
        tier,
        requirement_target
      )
    `)
    .eq('user_id', userId);

  // Get today's quests
  const { data: quests } = await supabase.rpc('get_daily_quests_for_user', {
    p_user_id: userId,
  });

  // Calculate XP to next level
  const xpForCurrentLevel = (profile.level - 1) * 1000;
  const xpForNextLevel = profile.level * 1000;
  const xpProgress = profile.total_xp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;

  return res.json({
    profile: {
      ...profile,
      xp_progress: xpProgress,
      xp_needed: xpNeeded,
      xp_percent: Math.round((xpProgress / xpNeeded) * 100),
    },
    achievements: achievements?.map((a: any) => ({
      ...a.achievements_master,
      progress: a.progress,
      completed: a.completed,
      completed_at: a.completed_at,
    })) || [],
    quests: quests || [],
    stats: {
      total_achievements: achievements?.filter((a: any) => a.completed).length || 0,
      completed_quests_today: quests?.filter((q: any) => q.completed).length || 0,
      total_quests: quests?.length || 0,
    },
  });
});

/**
 * GET /gamification/leaderboard
 * Get leaderboard filtered by league or global
 */
export const getLeaderboard = catchAsync(async (req: Request, res: Response) => {
  const { league, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('profiles')
    .select('id, name, avatar_url, level, praxis_points, league, reputation_score, current_streak, badge')
    .order('praxis_points', { ascending: false })
    .limit(Number(limit));

  if (league) {
    query = query.eq('league', league);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Leaderboard query error:', error.message);
    return res.status(200).json([]);
  }

  // Apply offset and add ranks manually
  const offsetNum = Number(offset);
  const ranked = data.map((p: any, i: number) => ({
    ...p,
    rank: offsetNum + i + 1,
  }));

  return res.json(ranked);
});

// =============================================================================
// Daily Quests System
// =============================================================================

/**
 * GET /gamification/quests
 * Get user's daily quests
 */
export const getDailyQuests = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  const { data: quests, error } = await supabase.rpc('get_daily_quests_for_user', {
    p_user_id: userId,
  });

  if (error) {
    logger.error('Get daily quests error:', error.message);
    throw new BadRequestError('Failed to fetch quests');
  }

  return res.json({ quests });
});

/**
 * POST /gamification/quests/:questType/progress
 * Progress a daily quest
 */
export const progressQuest = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { questType } = req.params;
  const { amount = 1 } = req.body;

  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  const { data, error } = await supabase.rpc('progress_user_quest', {
    p_user_id: userId,
    p_quest_type: questType,
    p_amount: amount,
  });

  if (error) {
    logger.error('Progress quest error:', error.message);
    throw new BadRequestError('Failed to progress quest');
  }

  const result = data?.[0];

  if (!result?.success) {
    return res.json({
      success: false,
      message: 'Quest not found or already completed',
    });
  }

  // Check achievements after quest completion
  if (result.completed) {
    await checkAchievements(userId);
  }

  return res.json({
    success: true,
    completed: result.completed,
    xp_earned: result.xp_earned,
    pp_earned: result.pp_earned,
    leveled_up: result.xp_earned > 0,
  });
});

/**
 * POST /gamification/quests/:questId/claim
 * Claim quest reward
 */
export const claimQuestReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { questId } = req.params;

  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  if (!questId) {
    throw new BadRequestError('Quest ID is required');
  }

  // Get quest - remove date filter to allow claiming recent quests
  const { data: quest, error: questError } = await supabase
    .from('user_daily_quests')
    .select('*, daily_quests(xp_reward, pp_reward)')
    .eq('id', questId)
    .eq('user_id', userId)
    .single();

  if (questError || !quest) {
    logger.error('Quest claim error:', questError?.message || 'Quest not found');
    throw new NotFoundError('Quest not found or already claimed');
  }

  if (!quest.completed) {
    throw new BadRequestError('Quest not completed');
  }

  if (quest.claimed) {
    throw new BadRequestError('Quest already claimed');
  }

  // Mark as claimed
  const { error: updateError } = await supabase
    .from('user_daily_quests')
    .update({ claimed: true })
    .eq('id', questId);

  if (updateError) {
    logger.error('Failed to mark quest as claimed:', updateError.message);
    throw new BadRequestError('Failed to claim quest');
  }

  // Award rewards
  const xpReward = quest.daily_quests?.xp_reward || 0;
  const ppReward = quest.daily_quests?.pp_reward || 0;

  if (xpReward > 0 || ppReward > 0) {
    const { error: rpcError } = await supabase.rpc('add_xp_to_user', {
      p_user_id: userId,
      p_xp_amount: xpReward,
      p_pp_amount: ppReward,
      p_source: 'quest_claim',
    });

    if (rpcError) {
      logger.error('Failed to award XP/PP:', rpcError.message);
      // Don't throw - quest is already marked as claimed
    }
  }

  return res.json({
    success: true,
    xp_earned: xpReward,
    pp_earned: ppReward,
  });
});

// =============================================================================
// Achievements System
// =============================================================================

/**
 * Check and award achievements for user
 */
async function checkAchievements(userId: string) {
  try {
    const { data, error } = await supabase.rpc('check_user_achievements', {
      p_user_id: userId,
    });

    if (error) {
      logger.error('Check achievements error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    logger.error('Check achievements exception:', err);
    return [];
  }
}

/**
 * GET /gamification/achievements
 * Get user's achievements
 */
export const getAchievements = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id || (req.query.userId as string);
  
  if (!userId) {
    throw new BadRequestError('Authentication or userId required');
  }

  const { data: achievements, error } = await supabase
    .from('user_achievements')
    .select(`
      *,
      achievements_master (
        id,
        achievement_key,
        title,
        description,
        icon,
        tier,
        xp_reward,
        pp_reward,
        title_unlock,
        requirement_target
      )
    `)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  if (error) {
    logger.error('Get achievements error:', error.message);
    return res.status(200).json({ achievements: [], unlocked: 0, total: 0 });
  }

  const unlocked = achievements.filter((a: any) => a.completed).length;

  return res.json({
    achievements: achievements.map((a: any) => ({
      ...a.achievements_master,
      progress: a.progress,
      completed: a.completed,
      completed_at: a.completed_at,
    })),
    unlocked,
    total: achievements.length,
  });
});

/**
 * GET /gamification/achievements/collection
 * Full achievement catalogue — locked with hints, unlocked with progress
 */
export const getAchievementCollection = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id || (req.query.userId as string);
  if (!userId) throw new BadRequestError('Authentication or userId required');

  // Get the full master catalogue
  const { data: master, error: masterErr } = await supabase
    .from('achievements_master')
    .select('id, achievement_key, title, description, icon, tier, category, xp_reward, pp_reward, title_unlock, requirement_target, hint, is_secret')
    .order('category')
    .order('tier');

  if (masterErr) {
    logger.error('Achievement master query error:', masterErr.message);
    return res.json({ categories: [], totalUnlocked: 0, totalAchievements: 0 });
  }

  // Get user's progress
  const { data: userProgress } = await supabase
    .from('user_achievements')
    .select('achievement_id, progress, completed, completed_at')
    .eq('user_id', userId);

  const progressMap = new Map(
    (userProgress ?? []).map((u: any) => [u.achievement_id, u])
  );

  // Group by category
  const categoryMap = new Map<string, any[]>();
  let totalUnlocked = 0;

  for (const a of (master ?? [])) {
    const userEntry = progressMap.get(a.id);
    const completed = userEntry?.completed ?? false;
    if (completed) totalUnlocked++;

    const entry = {
      id: a.id,
      achievement_key: a.achievement_key,
      // Secret achievements: hide title/description until unlocked
      title: a.is_secret && !completed ? '???' : a.title,
      description: a.is_secret && !completed ? (a.hint || 'Complete a hidden challenge...') : a.description,
      icon: a.is_secret && !completed ? '❓' : (a.icon || '🏆'),
      tier: a.tier,
      xp_reward: a.xp_reward,
      pp_reward: a.pp_reward,
      title_unlock: completed ? a.title_unlock : null,
      requirement_target: a.requirement_target,
      progress: userEntry?.progress ?? 0,
      completed,
      completed_at: userEntry?.completed_at ?? null,
      is_secret: a.is_secret ?? false,
      hint: a.hint,
    };

    const cat = a.category || 'General';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(entry);
  }

  const categories = Array.from(categoryMap.entries()).map(([name, achievements]) => ({
    name,
    achievements,
    unlocked: achievements.filter((a: any) => a.completed).length,
    total: achievements.length,
  }));

  return res.json({
    categories,
    totalUnlocked,
    totalAchievements: (master ?? []).length,
  });
});

// =============================================================================
// Social Interaction Rewards
// =============================================================================

/**
 * Track and reward social interactions
 */
export const trackSocialAction = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { actionType, amount = 1 } = req.body;

  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  const today = new Date().toISOString().slice(0, 10);

  // Get current tracking
  const { data: tracking } = await supabase
    .from('social_rewards_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .eq('action_date', today)
    .single();

  const currentCount = tracking?.count || 0;
  const currentEarned = tracking?.pp_earned || 0;

  // Get limits for this action type
  const limits: any = {
    post_created: {
      daily_limit: SOCIAL_REWARD_LIMITS.posts_per_day,
      pp_each: SOCIAL_REWARD_LIMITS.posts_pp_each,
      quest_type: 'create_post',
    },
    comment_created: {
      daily_limit: SOCIAL_REWARD_LIMITS.comments_per_day,
      pp_each: SOCIAL_REWARD_LIMITS.comments_pp_each,
      quest_type: 'comment_post',
    },
    like_received: {
      daily_limit: SOCIAL_REWARD_LIMITS.likes_received_per_day,
      pp_each: SOCIAL_REWARD_LIMITS.likes_received_pp_each,
      quest_type: null,
    },
  };

  const config = limits[actionType];
  if (!config) {
    throw new BadRequestError(`Unknown action type: ${actionType}`);
  }

  // Check if under daily limit
  if (currentCount >= config.daily_limit) {
    return res.json({
      success: false,
      reason: 'daily_limit_reached',
      pp_earned: 0,
      xp_earned: 0,
    });
  }

  // Calculate rewards
  const ppToAward = config.pp_each * amount;
  const xpToAward = Math.floor(ppToAward * 2); // 2 XP per 1 PP from social

  // Update tracking
  await supabase
    .from('social_rewards_tracking')
    .upsert({
      user_id: userId,
      action_type: actionType,
      action_date: today,
      count: currentCount + amount,
      pp_earned: currentEarned + ppToAward,
    })
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .eq('action_date', today);

  // Award XP and PP
  const { data: levelData } = await supabase.rpc('add_xp_to_user', {
    p_user_id: userId,
    p_xp_amount: xpToAward,
    p_pp_amount: ppToAward,
    p_source: `social_${actionType}`,
  });

  // Bump weekly challenge track
  bumpWeeklyXP(userId, xpToAward);

  // Progress quest if applicable
  if (config.quest_type) {
    await supabase.rpc('progress_user_quest', {
      p_user_id: userId,
      p_quest_type: config.quest_type,
      p_amount: amount,
    });
  }

  return res.json({
    success: true,
    pp_earned: ppToAward,
    xp_earned: xpToAward,
    leveled_up: levelData?.[0]?.leveled_up || false,
    new_level: levelData?.[0]?.new_level,
    daily_progress: {
      count: currentCount + amount,
      limit: config.daily_limit,
      remaining: config.daily_limit - (currentCount + amount),
    },
  });
});

/**
 * GET /gamification/social-tracking
 * Get user's social reward tracking for today
 */
export const getSocialTracking = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: tracking, error } = await supabase
    .from('social_rewards_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('action_date', today);

  if (error) {
    logger.error('Get social tracking error:', error.message);
    return res.status(200).json({ tracking: [] });
  }

  return res.json({
    tracking: tracking || [],
    limits: SOCIAL_REWARD_LIMITS,
  });
});

// =============================================================================
// Titles & Customization
// =============================================================================

/**
 * GET /gamification/titles
 * Get available titles for user
 */
export const getTitles = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  
  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  // Get unlocked titles from completed achievements
  const { data: achievements } = await supabase
    .from('user_achievements')
    .select(`
      achievement_id,
      completed,
      achievements_master(title_unlock)
    `)
    .eq('user_id', userId)
    .eq('completed', true);

  const unlockedTitles = achievements
    ?.filter((a: any) => a.achievements_master?.title_unlock)
    .map((a: any) => ({
      title: a.achievements_master.title_unlock,
      unlocked: true,
    })) || [];

  // Get currently equipped title
  const { data: profile } = await supabase
    .from('profiles')
    .select('equipped_title')
    .eq('id', userId)
    .single();

  return res.json({
    titles: unlockedTitles,
    equipped: profile?.equipped_title,
  });
});

/**
 * POST /gamification/titles/equip
 * Equip a title
 */
export const equipTitle = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { title } = req.body;

  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  // Get achievement IDs that unlock this title
  const { data: masterAchievements } = await supabase
    .from('achievements_master')
    .select('id')
    .eq('title_unlock', title);

  if (!masterAchievements || masterAchievements.length === 0) {
    throw new BadRequestError('Title not found');
  }

  const achievementIds = masterAchievements.map((a: any) => a.id);

  // Verify user has unlocked this title
  const { data: achievement } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', true)
    .in('achievement_id', achievementIds)
    .single();

  if (!achievement) {
    throw new BadRequestError('Title not unlocked yet');
  }

  // Equip title
  await supabase
    .from('profiles')
    .update({ equipped_title: title })
    .eq('id', userId);

  return res.json({
    success: true,
    equipped: title,
  });
});

/**
 * POST /gamification/titles/unequip
 * Unequip current title
 */
export const unequipTitle = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new BadRequestError('Authentication required');
  }

  await supabase
    .from('profiles')
    .update({ equipped_title: null })
    .eq('id', userId);

  return res.json({
    success: true,
    equipped: null,
  });
});

// =============================================================================
// Combo / Chain Bonus System
// =============================================================================

const COMBO_RECIPES: {
  id: string;
  label: string;
  actions: string[];
  xp_bonus: number;
  pp_bonus: number;
  description: string;
}[] = [
  {
    id: 'full_day',
    label: 'Full Day',
    actions: ['check_in', 'log_tracker', 'journal_entry'],
    xp_bonus: 50,
    pp_bonus: 15,
    description: 'Check in + log a tracker + write a journal entry',
  },
  {
    id: 'social_butterfly',
    label: 'Social Butterfly',
    actions: ['create_post', 'comment_post', 'give_honor'],
    xp_bonus: 40,
    pp_bonus: 10,
    description: 'Create a post + comment on someone + give honor',
  },
  {
    id: 'grind_mode',
    label: 'Grind Mode',
    actions: ['check_in', 'log_tracker', 'complete_goal'],
    xp_bonus: 75,
    pp_bonus: 25,
    description: 'Check in + log a tracker + complete a goal',
  },
];

/**
 * POST /gamification/combos/check
 * Check if any combos completed today and award bonus.
 * Called after any action that might complete a combo.
 */
export const checkCombos = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { actionType } = req.body;
  if (!userId) throw new BadRequestError('Authentication required');

  const today = new Date().toISOString().slice(0, 10);

  // Get all actions completed today from social_rewards_tracking + checkins + tracker entries
  const [trackingRes, checkinRes, trackerRes, journalRes] = await Promise.all([
    supabase.from('social_rewards_tracking')
      .select('action_type')
      .eq('user_id', userId)
      .eq('action_date', today),
    supabase.from('checkins')
      .select('id')
      .eq('user_id', userId)
      .gte('checked_in_at', `${today}T00:00:00.000Z`)
      .lt('checked_in_at', `${today}T23:59:59.999Z`)
      .limit(1),
    supabase.from('tracker_entries')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)
      .limit(1),
    supabase.from('journal_entries')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)
      .limit(1),
  ]);

  // Build set of completed actions today
  const completedActions = new Set<string>();
  if ((checkinRes.data ?? []).length > 0) completedActions.add('check_in');
  if ((trackerRes.data ?? []).length > 0) completedActions.add('log_tracker');
  if ((journalRes.data ?? []).length > 0) completedActions.add('journal_entry');

  for (const t of (trackingRes.data ?? [])) {
    // Map social tracking types to combo action names
    if (t.action_type === 'post_created') completedActions.add('create_post');
    if (t.action_type === 'comment_created') completedActions.add('comment_post');
    if (t.action_type === 'honor_given') completedActions.add('give_honor');
    if (t.action_type === 'goal_completed') completedActions.add('complete_goal');
  }

  // Also add the current action
  if (actionType) completedActions.add(actionType);

  // Check which combos are now complete
  const { data: claimedToday } = await supabase
    .from('combo_claims')
    .select('combo_id')
    .eq('user_id', userId)
    .eq('claim_date', today);

  const alreadyClaimed = new Set((claimedToday ?? []).map((c: any) => c.combo_id));

  const newCombos: typeof COMBO_RECIPES = [];
  for (const recipe of COMBO_RECIPES) {
    if (alreadyClaimed.has(recipe.id)) continue;
    if (recipe.actions.every(a => completedActions.has(a))) {
      newCombos.push(recipe);
    }
  }

  // Award combos
  const awarded = [];
  for (const combo of newCombos) {
    await supabase.rpc('add_xp_to_user', {
      p_user_id: userId,
      p_xp_amount: combo.xp_bonus,
      p_pp_amount: combo.pp_bonus,
      p_source: `combo_${combo.id}`,
    });

    bumpWeeklyXP(userId, combo.xp_bonus);

    await supabase.from('combo_claims').insert({
      user_id: userId,
      combo_id: combo.id,
      claim_date: today,
    });

    awarded.push({
      id: combo.id,
      label: combo.label,
      xp_bonus: combo.xp_bonus,
      pp_bonus: combo.pp_bonus,
    });

    logger.info(`[Combo] User ${userId} completed "${combo.label}" (+${combo.xp_bonus} XP, +${combo.pp_bonus} PP)`);
  }

  return res.json({
    completedActions: Array.from(completedActions),
    awarded,
    // Also return active combo progress for the frontend
    combos: COMBO_RECIPES.map(r => ({
      id: r.id,
      label: r.label,
      description: r.description,
      xp_bonus: r.xp_bonus,
      pp_bonus: r.pp_bonus,
      actions: r.actions,
      progress: r.actions.filter(a => completedActions.has(a)).length,
      total: r.actions.length,
      completed: r.actions.every(a => completedActions.has(a)),
      claimed: alreadyClaimed.has(r.id) || newCombos.some(n => n.id === r.id),
    })),
  });
});

/**
 * GET /gamification/combos
 * Get available combos and today's progress
 */
export const getCombos = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new BadRequestError('Authentication required');

  // Redirect to check with no action — returns current state
  const today = new Date().toISOString().slice(0, 10);

  const [trackingRes, checkinRes, trackerRes, journalRes, claimedRes] = await Promise.all([
    supabase.from('social_rewards_tracking')
      .select('action_type')
      .eq('user_id', userId)
      .eq('action_date', today),
    supabase.from('checkins')
      .select('id')
      .eq('user_id', userId)
      .gte('checked_in_at', `${today}T00:00:00.000Z`)
      .lt('checked_in_at', `${today}T23:59:59.999Z`)
      .limit(1),
    supabase.from('tracker_entries')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)
      .limit(1),
    supabase.from('journal_entries')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)
      .limit(1),
    supabase.from('combo_claims')
      .select('combo_id')
      .eq('user_id', userId)
      .eq('claim_date', today),
  ]);

  const completedActions = new Set<string>();
  if ((checkinRes.data ?? []).length > 0) completedActions.add('check_in');
  if ((trackerRes.data ?? []).length > 0) completedActions.add('log_tracker');
  if ((journalRes.data ?? []).length > 0) completedActions.add('journal_entry');
  for (const t of (trackingRes.data ?? [])) {
    if (t.action_type === 'post_created') completedActions.add('create_post');
    if (t.action_type === 'comment_created') completedActions.add('comment_post');
    if (t.action_type === 'honor_given') completedActions.add('give_honor');
    if (t.action_type === 'goal_completed') completedActions.add('complete_goal');
  }

  const alreadyClaimed = new Set((claimedRes.data ?? []).map((c: any) => c.combo_id));

  return res.json({
    completedActions: Array.from(completedActions),
    combos: COMBO_RECIPES.map(r => ({
      id: r.id,
      label: r.label,
      description: r.description,
      xp_bonus: r.xp_bonus,
      pp_bonus: r.pp_bonus,
      actions: r.actions,
      progress: r.actions.filter(a => completedActions.has(a)).length,
      total: r.actions.length,
      completed: r.actions.every(a => completedActions.has(a)),
      claimed: alreadyClaimed.has(r.id),
    })),
  });
});
