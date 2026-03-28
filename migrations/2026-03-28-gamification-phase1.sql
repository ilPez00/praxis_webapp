-- =============================================================================
-- Praxis Gamification Phase 1 — Level System, Daily Quests, Social Rewards
-- Migration Date: 2026-03-28
-- =============================================================================

-- =============================================================================
-- 1. PROFILES — Add gamification columns
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_xp              BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level                 INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS league                TEXT DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS equipped_title        TEXT,
  ADD COLUMN IF NOT EXISTS profile_theme         TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS reputation_score      INT DEFAULT 50;

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_league ON public.profiles(league);
CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON public.profiles(reputation_score DESC);

-- =============================================================================
-- 2. DAILY_QUESTS — Quest template definitions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.daily_quests (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_type      TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  xp_reward       INT         NOT NULL DEFAULT 25,
  pp_reward       INT         NOT NULL DEFAULT 15,
  difficulty      TEXT        NOT NULL DEFAULT 'easy',
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active quests" ON public.daily_quests;
CREATE POLICY "Public can read active quests"
  ON public.daily_quests FOR SELECT
  USING (is_active = true);

-- Only admins can manage quests
DROP POLICY IF EXISTS "Admins can manage quests" ON public.daily_quests;
CREATE POLICY "Admins can manage quests"
  ON public.daily_quests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Seed default quest templates
INSERT INTO public.daily_quests (quest_type, title, description, xp_reward, pp_reward, difficulty) VALUES
  ('check_in', 'Daily Check-In', 'Complete your daily check-in', 20, 10, 'easy'),
  ('log_tracker', 'Track Your Progress', 'Log any tracker entry', 25, 15, 'easy'),
  ('journal_entry', 'Reflect & Grow', 'Write a journal entry', 30, 20, 'medium'),
  ('give_honor', 'Spread Positivity', 'Give honor to another user', 35, 20, 'medium'),
  ('comment_post', 'Join the Conversation', 'Comment on a post', 25, 15, 'easy'),
  ('create_post', 'Share Your Story', 'Create a new post', 40, 25, 'medium'),
  ('complete_goal', 'Goal Crusher', 'Complete any goal', 100, 50, 'hard'),
  ('win_bet', 'High Roller', 'Win a bet', 75, 40, 'hard'),
  ('help_peer', 'Be a Mentor', 'Verify a peer''s goal completion', 50, 30, 'medium'),
  ('streak_milestone', 'On Fire!', 'Reach a streak milestone (7/30/90 days)', 150, 100, 'legendary')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. USER_DAILY_QUESTS — User's daily quest progress
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_daily_quests (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id        UUID        NOT NULL REFERENCES public.daily_quests(id) ON DELETE CASCADE,
  progress        INT         NOT NULL DEFAULT 0,
  target          INT         NOT NULL DEFAULT 1,
  completed       BOOLEAN     DEFAULT false,
  claimed         BOOLEAN     DEFAULT false,
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  UNIQUE(user_id, quest_id, date)
);

ALTER TABLE public.user_daily_quests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own quests" ON public.user_daily_quests;
CREATE POLICY "Users can read own quests"
  ON public.user_daily_quests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quest progress" ON public.user_daily_quests;
CREATE POLICY "Users can update own quest progress"
  ON public.user_daily_quests FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert user quests" ON public.user_daily_quests;
CREATE POLICY "System can insert user quests"
  ON public.user_daily_quests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for daily reset queries
CREATE INDEX IF NOT EXISTS idx_user_quests_user_date ON public.user_daily_quests(user_id, date DESC);

-- =============================================================================
-- 4. ACHIEVEMENTS_MASTER — System-defined achievement templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.achievements_master (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  achievement_key TEXT        NOT NULL UNIQUE,
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  icon            TEXT        NOT NULL,
  tier            TEXT        NOT NULL DEFAULT 'bronze',
  xp_reward       INT         NOT NULL DEFAULT 50,
  pp_reward       INT         NOT NULL DEFAULT 25,
  title_unlock    TEXT,
  requirement_type TEXT       NOT NULL,
  requirement_target INT      NOT NULL,
  category        TEXT        NOT NULL,
  is_hidden       BOOLEAN     DEFAULT false,
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.achievements_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active achievements" ON public.achievements_master;
CREATE POLICY "Public can read active achievements"
  ON public.achievements_master FOR SELECT
  USING (is_active = true AND is_hidden = false);

-- Seed master achievements
INSERT INTO public.achievements_master (achievement_key, title, description, icon, tier, xp_reward, pp_reward, title_unlock, requirement_type, requirement_target, category) VALUES
  -- Firsts
  ('first_blood', 'First Blood', 'Complete your first goal', '🎯', 'bronze', 100, 50, 'First Timer', 'goal_completions', 1, 'goals'),
  ('first_friend', 'Social Starter', 'Add your first friend', '🤝', 'bronze', 50, 25, null, 'friends_count', 1, 'social'),
  ('first_bet', 'High Roller', 'Place your first bet', '🎲', 'bronze', 50, 25, null, 'bets_placed', 1, 'betting'),
  ('first_duel', 'Challenger', 'Participate in your first duel', '⚔️', 'bronze', 50, 25, null, 'duels_count', 1, 'duels'),
  
  -- Streak milestones
  ('streak_7', 'Week Warrior', 'Reach a 7-day streak', '🔥', 'silver', 200, 100, 'Week Warrior', 'streak_days', 7, 'streaks'),
  ('streak_30', 'Monthly Master', 'Reach a 30-day streak', '🔥🔥', 'gold', 500, 250, 'Monthly Master', 'streak_days', 30, 'streaks'),
  ('streak_90', 'Quarterly Queen/King', 'Reach a 90-day streak', '🔥🔥🔥', 'platinum', 1000, 500, 'Dedicated', 'streak_days', 90, 'streaks'),
  ('streak_365', 'Year of Power', 'Reach a 365-day streak', '👑', 'diamond', 5000, 2500, 'Legendary', 'streak_days', 365, 'streaks'),
  
  -- Social
  ('social_butterfly', 'Social Butterfly', 'Add 10 friends', '🦋', 'silver', 200, 100, 'Socialite', 'friends_count', 10, 'social'),
  ('honor_guard', 'Honor Guard', 'Give 50 honors to others', '🏅', 'gold', 300, 150, 'Honorable', 'honors_given', 50, 'social'),
  ('mentor', 'Mentor', 'Verify 20 peer goal completions', '🎓', 'platinum', 500, 250, 'Mentor', 'verifications_count', 20, 'social'),
  ('influencer', 'Influencer', 'Receive 100 upvotes on posts', '⭐', 'diamond', 1000, 500, 'Influencer', 'post_upvotes_received', 100, 'social'),
  
  -- Betting
  ('sharpshooter', 'Sharpshooter', 'Win 10 bets', '🎯', 'silver', 300, 150, 'Sharpshooter', 'bets_won', 10, 'betting'),
  ('high_stakes', 'High Stakes', 'Win a bet with 500+ PP stake', '💰', 'gold', 500, 250, 'High Roller', 'bet_stake_won', 500, 'betting'),
  ('unlucky', 'Better Luck Next Time', 'Lose 10 bets', '😅', 'bronze', 50, 25, null, 'bets_lost', 10, 'betting'),
  
  -- Goals
  ('goal_crusher', 'Goal Crusher', 'Complete 10 goals', '💪', 'gold', 500, 250, 'Crusher', 'goal_completions', 10, 'goals'),
  ('goal_master', 'Goal Master', 'Complete 50 goals', '🏆', 'platinum', 1000, 500, 'Master', 'goal_completions', 50, 'goals'),
  ('goal_legend', 'Goal Legend', 'Complete 100 goals', '👑', 'diamond', 2500, 1250, 'Legend', 'goal_completions', 100, 'goals'),
  
  -- Content
  ('storyteller', 'Storyteller', 'Create 25 posts', '📝', 'silver', 200, 100, 'Storyteller', 'posts_created', 25, 'content'),
  ('conversationalist', 'Conversationalist', 'Create 100 comments', '💬', 'gold', 300, 150, 'Conversationalist', 'comments_created', 100, 'content'),
  ('viral', 'Viral', 'Get a post with 50+ upvotes', '🚀', 'platinum', 500, 250, 'Viral', 'post_max_upvotes', 50, 'content'),
  
  -- Exploration
  ('explorer', 'Explorer', 'Visit 10 places', '🗺️', 'bronze', 100, 50, 'Explorer', 'places_visited', 10, 'exploration'),
  ('event_goer', 'Event Goer', 'Attend 5 events', '🎉', 'silver', 200, 100, 'Event Goer', 'events_attended', 5, 'exploration'),
  
  -- Economy
  ('saver', 'Saver', 'Accumulate 1000 PP', '💵', 'silver', 200, 100, 'Saver', 'pp_balance', 1000, 'economy'),
  ('spender', 'Big Spender', 'Spend 5000 PP total', '💸', 'gold', 300, 150, 'Big Spender', 'pp_spent_total', 5000, 'economy'),
  ('investor', 'Investor', 'Earn 2000 PP from bets', '📈', 'platinum', 500, 250, 'Investor', 'pp_earned_betting', 2000, 'economy')
ON CONFLICT (achievement_key) DO NOTHING;

-- =============================================================================
-- 5. USER_ACHIEVEMENTS — User's unlocked achievements
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id  UUID        NOT NULL REFERENCES public.achievements_master(id) ON DELETE CASCADE,
  progress        INT         NOT NULL DEFAULT 0,
  completed       BOOLEAN     DEFAULT false,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own achievements" ON public.user_achievements;
CREATE POLICY "Users can read own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage user achievements" ON public.user_achievements;
CREATE POLICY "System can manage user achievements"
  ON public.user_achievements FOR ALL
  USING (true);

-- Index for achievement queries
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);

-- =============================================================================
-- 6. SOCIAL_REWARDS_TRACKING — Track social interaction rewards (anti-farm)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.social_rewards_tracking (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type     TEXT        NOT NULL,
  action_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  count           INT         NOT NULL DEFAULT 0,
  pp_earned       INT         NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, action_type, action_date)
);

ALTER TABLE public.social_rewards_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own tracking" ON public.social_rewards_tracking;
CREATE POLICY "Users can read own tracking"
  ON public.social_rewards_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- Index for daily reset
CREATE INDEX IF NOT EXISTS idx_social_tracking_user_date ON public.social_rewards_tracking(user_id, action_date DESC);

-- =============================================================================
-- 7. LEVEL_REWARDS — Unlockable rewards at each level
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.level_rewards (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  level_required  INT         NOT NULL UNIQUE,
  reward_type     TEXT        NOT NULL,
  reward_data     JSONB       NOT NULL,
  claimed         BOOLEAN     DEFAULT false
);

ALTER TABLE public.level_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read level rewards" ON public.level_rewards;
CREATE POLICY "Public can read level rewards"
  ON public.level_rewards FOR SELECT
  USING (true);

-- Seed level rewards
INSERT INTO public.level_rewards (level_required, reward_type, reward_data) VALUES
  (2, 'pp_bonus', '{"amount": 50}'),
  (3, 'theme_unlock', '{"theme": "sunset"}'),
  (5, 'pp_bonus', '{"amount": 100}'),
  (5, 'badge_unlock', '{"badge": "Apprentice"}'),
  (10, 'pp_bonus', '{"amount": 250}'),
  (10, 'badge_unlock', '{"badge": "Achiever"}'),
  (10, 'theme_unlock', '{"theme": "ocean"}'),
  (15, 'pp_bonus', '{"amount": 300}'),
  (20, 'pp_bonus', '{"amount": 500}'),
  (20, 'badge_unlock', '{"badge": "Mentor"}'),
  (20, 'theme_unlock', '{"theme": "forest"}'),
  (25, 'pp_bonus', '{"amount": 750}'),
  (25, 'animated_avatar', '{"enabled": true}'),
  (30, 'pp_bonus', '{"amount": 1000}'),
  (30, 'badge_unlock', '{"badge": "Legend"}'),
  (30, 'theme_unlock', '{"theme": "cosmic"}'),
  (40, 'pp_bonus', '{"amount": 1500}'),
  (50, 'pp_bonus', '{"amount": 2500}'),
  (50, 'badge_unlock', '{"badge": "Visionary"}'),
  (50, 'theme_unlock', '{"theme": "diamond"}')
ON CONFLICT (level_required) DO NOTHING;

-- =============================================================================
-- 8. FUNCTIONS — Auto-update triggers and helpers
-- =============================================================================

-- Function: Update user level based on total_xp
CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
DECLARE
  new_level INT;
BEGIN
  -- Level formula: level = floor(total_xp / 1000) + 1
  new_level := FLOOR(NEW.total_xp / 1000) + 1;
  
  -- Cap at level 100
  IF new_level > 100 THEN
    new_level := 100;
  END IF;
  
  -- Only update if level changed
  IF NEW.level IS DISTINCT FROM new_level THEN
    NEW.level := new_level;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update level when XP changes
DROP TRIGGER IF EXISTS trg_update_user_level ON public.profiles;
CREATE TRIGGER trg_update_user_level
  BEFORE UPDATE OF total_xp ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_level();

-- Function: Add XP to user (with optional PP)
CREATE OR REPLACE FUNCTION add_xp_to_user(
  p_user_id UUID,
  p_xp_amount INT,
  p_pp_amount INT DEFAULT 0,
  p_source TEXT DEFAULT 'unknown'
)
RETURNS TABLE(new_xp BIGINT, new_level INT, new_pp INT, leveled_up BOOLEAN) AS $$
DECLARE
  old_level INT;
  new_level INT;
  current_pp INT;
BEGIN
  -- Get current level
  SELECT level, praxis_points INTO old_level, current_pp
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Update XP and PP
  UPDATE public.profiles
  SET 
    total_xp = total_xp + p_xp_amount,
    praxis_points = praxis_points + p_pp_amount
  WHERE id = p_user_id
  RETURNING level, praxis_points INTO new_level, current_pp;
  
  -- Calculate if leveled up
  leveled_up := new_level > old_level;
  
  RETURN QUERY SELECT 
    (SELECT total_xp FROM public.profiles WHERE id = p_user_id) AS new_xp,
    new_level,
    current_pp AS new_pp,
    leveled_up;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get daily quests for user
CREATE OR REPLACE FUNCTION get_daily_quests_for_user(p_user_id UUID)
RETURNS TABLE (
  quest_id UUID,
  quest_type TEXT,
  title TEXT,
  description TEXT,
  xp_reward INT,
  pp_reward INT,
  difficulty TEXT,
  progress INT,
  target INT,
  completed BOOLEAN,
  claimed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dq.id AS quest_id,
    dq.quest_type,
    dq.title,
    dq.description,
    dq.xp_reward,
    dq.pp_reward,
    dq.difficulty,
    COALESCE(udq.progress, 0) AS progress,
    COALESCE(udq.target, 1) AS target,
    COALESCE(udq.completed, false) AS completed,
    COALESCE(udq.claimed, false) AS claimed
  FROM public.daily_quests dq
  LEFT JOIN public.user_daily_quests udq 
    ON dq.id = udq.quest_id 
    AND udq.user_id = p_user_id 
    AND udq.date = CURRENT_DATE
  WHERE dq.is_active = true
  ORDER BY dq.difficulty, dq.quest_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Progress user quest
CREATE OR REPLACE FUNCTION progress_user_quest(
  p_user_id UUID,
  p_quest_type TEXT,
  p_amount INT DEFAULT 1
)
RETURNS TABLE(success BOOLEAN, completed BOOLEAN, xp_earned INT, pp_earned INT) AS $$
DECLARE
  v_quest_record RECORD;
  v_new_progress INT;
  v_completed BOOLEAN := false;
  v_xp_earned INT := 0;
  v_pp_earned INT := 0;
BEGIN
  -- Get quest for today
  SELECT dq.id, dq.xp_reward, dq.pp_reward, udq.progress, udq.completed, udq.target
  INTO v_quest_record
  FROM public.daily_quests dq
  LEFT JOIN public.user_daily_quests udq 
    ON dq.id = udq.quest_id 
    AND udq.user_id = p_user_id 
    AND udq.date = CURRENT_DATE
  WHERE dq.quest_type = p_quest_type
  AND dq.is_active = true
  LIMIT 1;
  
  -- No quest found or already completed
  IF v_quest_record.id IS NULL OR v_quest_record.completed THEN
    RETURN QUERY SELECT false, false, 0, 0;
    RETURN;
  END IF;
  
  -- Update progress
  v_new_progress := COALESCE(v_quest_record.progress, 0) + p_amount;
  
  -- Check if completed
  IF v_new_progress >= COALESCE(v_quest_record.target, 1) THEN
    v_completed := true;
    v_xp_earned := v_quest_record.xp_reward;
    v_pp_earned := v_quest_record.pp_reward;
    
    -- Award XP and PP
    PERFORM add_xp_to_user(p_user_id, v_xp_earned, v_pp_earned, 'quest_completion');
  END IF;
  
  -- Upsert quest progress
  INSERT INTO public.user_daily_quests (user_id, quest_id, progress, completed, completed_at)
  VALUES (p_user_id, v_quest_record.id, v_new_progress, v_completed, 
          CASE WHEN v_completed THEN now() ELSE NULL END)
  ON CONFLICT (user_id, quest_id, date) DO UPDATE SET
    progress = v_new_progress,
    completed = v_completed,
    completed_at = CASE WHEN v_completed THEN now() ELSE user_daily_quests.completed_at END;
  
  RETURN QUERY SELECT true, v_completed, v_xp_earned, v_pp_earned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check and award achievements
CREATE OR REPLACE FUNCTION check_user_achievements(p_user_id UUID)
RETURNS TABLE(achievement_key TEXT, title TEXT, xp_earned INT, pp_earned INT) AS $$
DECLARE
  v_achievement RECORD;
  v_current_value INT;
  v_user_achievement RECORD;
BEGIN
  -- Loop through all active achievements
  FOR v_achievement IN 
    SELECT * FROM public.achievements_master WHERE is_active = true
  LOOP
    -- Check if already completed
    SELECT * INTO v_user_achievement
    FROM public.user_achievements
    WHERE user_id = p_user_id AND achievement_id = v_achievement.id;
    
    IF v_user_achievement.id IS NOT NULL AND v_user_achievement.completed THEN
      CONTINUE;
    END IF;
    
    -- Get current value for requirement
    CASE v_achievement.requirement_type
      WHEN 'goal_completions' THEN
        SELECT COUNT(*) INTO v_current_value 
        FROM public.achievements 
        WHERE user_id = p_user_id;
      WHEN 'streak_days' THEN
        SELECT current_streak INTO v_current_value 
        FROM public.profiles WHERE id = p_user_id;
      WHEN 'friends_count' THEN
        SELECT COUNT(*) INTO v_current_value 
        FROM public.friends 
        WHERE (user_id = p_user_id OR friend_id = p_user_id) 
        AND status = 'accepted';
      WHEN 'honors_given' THEN
        SELECT COUNT(*) INTO v_current_value 
        FROM public.honor_votes 
        WHERE voter_id = p_user_id;
      WHEN 'bets_won' THEN
        SELECT COUNT(*) INTO v_current_value 
        FROM public.bets 
        WHERE better_id = p_user_id AND status = 'won';
      WHEN 'bets_lost' THEN
        SELECT COUNT(*) INTO v_current_value 
        FROM public.bets 
        WHERE better_id = p_user_id AND status = 'lost';
      WHEN 'posts_created' THEN
        SELECT COUNT(*) INTO v_current_value 
        FROM public.posts 
        WHERE user_id = p_user_id;
      WHEN 'verifications_count' THEN
        SELECT COUNT(*) INTO v_current_value 
        FROM public.completion_requests 
        WHERE verifier_id = p_user_id AND status = 'approved';
      ELSE
        v_current_value := 0;
    END CASE;
    
    -- Check if requirement met
    IF v_current_value >= v_achievement.requirement_target THEN
      -- Award achievement
      INSERT INTO public.user_achievements (user_id, achievement_id, progress, completed, completed_at)
      VALUES (p_user_id, v_achievement.id, v_current_value, true, now())
      ON CONFLICT (user_id, achievement_id) DO UPDATE SET
        progress = v_current_value,
        completed = true,
        completed_at = now();
      
      -- Award XP and PP
      PERFORM add_xp_to_user(p_user_id, v_achievement.xp_reward, v_achievement.pp_reward, 'achievement');
      
      -- Return achievement info
      achievement_key := v_achievement.achievement_key;
      title := v_achievement.title;
      xp_earned := v_achievement.xp_reward;
      pp_earned := v_achievement.pp_reward;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9. LEAGUE SYSTEM — Monthly league calculation function
-- =============================================================================

-- Function: Calculate and update user leagues (run monthly via cron)
CREATE OR REPLACE FUNCTION update_user_leagues()
RETURNS TEXT AS $$
DECLARE
  v_count INT;
BEGIN
  -- Update leagues based on current PP
  UPDATE public.profiles
  SET league = CASE
    WHEN praxis_points >= 15000 THEN 'diamond'
    WHEN praxis_points >= 5000 THEN 'platinum'
    WHEN praxis_points >= 1500 THEN 'gold'
    WHEN praxis_points >= 500 THEN 'silver'
    ELSE 'bronze'
  END;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN 'Updated ' || v_count || ' user leagues';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 10. DAILY RESET FUNCTION — Reset daily quests and tracking
-- =============================================================================

CREATE OR REPLACE FUNCTION reset_daily_quests()
RETURNS TEXT AS $$
DECLARE
  v_users RECORD;
  v_quest_count INT := 3; -- 3 quests per day
BEGIN
  -- Get all active users (active in last 30 days)
  FOR v_users IN 
    SELECT id FROM public.profiles 
    WHERE last_activity_date >= CURRENT_DATE - INTERVAL '30 days'
  LOOP
    -- Insert 3 random quests for each user
    INSERT INTO public.user_daily_quests (user_id, quest_id, progress, target, completed, claimed)
    SELECT 
      v_users.id,
      dq.id,
      0,
      1,
      false,
      false
    FROM public.daily_quests dq
    WHERE dq.is_active = true
    AND dq.difficulty IN ('easy', 'medium') -- Only easy/medium for daily
    ORDER BY RANDOM()
    LIMIT v_quest_count
    ON CONFLICT (user_id, quest_id, date) DO NOTHING;
  END LOOP;
  
  -- Clean up old tracking data (older than 90 days)
  DELETE FROM public.social_rewards_tracking WHERE action_date < CURRENT_DATE - INTERVAL '90 days';
  
  RETURN 'Daily quests reset completed';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- End of Migration
-- =============================================================================
