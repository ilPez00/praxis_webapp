-- =============================================================================
-- 2026-04-05 — Expand XP System with Streaks & Milestones
-- =============================================================================
-- Adds:
-- - Streak XP bonuses (more XP for longer streaks)
-- - Weekly milestone bonuses
-- - Monthly milestone bonuses
-- - Login streak tracking
-- =============================================================================

-- 1. Add streak tracking columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS login_streak INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_login_streak INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login_date DATE,
ADD COLUMN IF NOT EXISTS weekly_xp INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_xp_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS monthly_xp INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_xp_date DATE DEFAULT CURRENT_DATE;

-- 2. Function: Calculate and award streak XP
CREATE OR REPLACE FUNCTION award_streak_xp(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  current_streak INT;
  streak_xp INT := 0;
  v_longest_streak INT;
BEGIN
  -- Get current streak
  SELECT login_streak, longest_login_streak INTO current_streak, v_longest_streak
  FROM public.profiles WHERE id = p_user_id;
  
  -- Award XP based on streak length
  -- 1-2 days: 10 XP
  -- 3-6 days: 25 XP  
  -- 7-13 days: 50 XP
  -- 14-29 days: 100 XP
  -- 30+ days: 200 XP
  CASE
    WHEN current_streak >= 30 THEN streak_xp := 200;
    WHEN current_streak >= 14 THEN streak_xp := 100;
    WHEN current_streak >= 7 THEN streak_xp := 50;
    WHEN current_streak >= 3 THEN streak_xp := 25;
    WHEN current_streak >= 1 THEN streak_xp := 10;
    ELSE streak_xp := 0;
  END CASE;
  
  -- Update longest streak if current is higher
  IF current_streak > v_longest_streak THEN
    UPDATE public.profiles SET longest_login_streak = current_streak WHERE id = p_user_id;
  END IF;
  
  RETURN streak_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function: Update login streak
CREATE OR REPLACE FUNCTION update_login_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_last_login DATE;
  v_current_streak INT;
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
  streak_xp INT;
BEGIN
  SELECT last_login_date, login_streak INTO v_last_login, v_current_streak
  FROM public.profiles WHERE id = p_user_id;
  
  IF v_last_login IS NULL THEN
    -- First login ever
    UPDATE public.profiles 
    SET login_streak = 1, 
        longest_login_streak = 1, 
        last_login_date = v_today 
    WHERE id = p_user_id;
  ELSIF v_last_login = v_today THEN
    -- Already logged in today, do nothing
    NULL;
  ELSIF v_last_login = v_yesterday THEN
    -- Consecutive day, increment streak
    UPDATE public.profiles 
    SET login_streak = v_current_streak + 1,
        last_login_date = v_today 
    WHERE id = p_user_id;
  ELSE
    -- Streak broken, reset to 1
    UPDATE public.profiles 
    SET login_streak = 1, 
        last_login_date = v_today 
    WHERE id = p_user_id;
  END IF;
  
  -- Award streak XP
  streak_xp := award_streak_xp(p_user_id);
  IF streak_xp > 0 THEN
    PERFORM add_xp_to_user(p_user_id, streak_xp, 0, 'login_streak');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function: Check and award weekly milestone XP
CREATE OR REPLACE FUNCTION check_weekly_milestone(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_weekly_xp INT;
  v_weekly_date DATE;
  v_milestone_xp INT := 0;
BEGIN
  SELECT weekly_xp, weekly_xp_date INTO v_weekly_xp, v_weekly_date
  FROM public.profiles WHERE id = p_user_id;
  
  -- Reset weekly if new week
  IF v_weekly_date < CURRENT_DATE - INTERVAL '7 days' THEN
    -- Check milestones before resetting
    IF v_weekly_xp >= 500 THEN
      v_milestone_xp := 100; -- Bronze weekly
    ELSIF v_weekly_xp >= 1000 THEN
      v_milestone_xp := 250; -- Silver weekly
    ELSIF v_weekly_xp >= 2000 THEN
      v_milestone_xp := 500; -- Gold weekly
    END IF;
    
    UPDATE public.profiles SET weekly_xp = 0, weekly_xp_date = CURRENT_DATE WHERE id = p_user_id;
  END IF;
  
  RETURN v_milestone_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function: Check and award monthly milestone XP
CREATE OR REPLACE FUNCTION check_monthly_milestone(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_monthly_xp INT;
  v_monthly_date DATE;
  v_milestone_xp INT := 0;
BEGIN
  SELECT monthly_xp, monthly_xp_date INTO v_monthly_xp, v_monthly_date
  FROM public.profiles WHERE id = p_user_id;
  
  -- Reset monthly if new month
  IF v_monthly_date < DATE_TRUNC('month', CURRENT_DATE) THEN
    -- Check milestones before resetting
    IF v_monthly_xp >= 2000 THEN
      v_milestone_xp := 500; -- Bronze monthly
    ELSIF v_monthly_xp >= 5000 THEN
      v_milestone_xp := 1000; -- Silver monthly
    ELSIF v_monthly_xp >= 10000 THEN
      v_milestone_xp := 2500; -- Gold monthly
    END IF;
    
    UPDATE public.profiles SET monthly_xp = 0, monthly_xp_date = CURRENT_DATE WHERE id = p_user_id;
  END IF;
  
  RETURN v_milestone_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Modified add_xp_to_user to track weekly/monthly XP
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
  v_weekly_xp INT;
  v_monthly_xp INT;
  weekly_bonus INT := 0;
  monthly_bonus INT := 0;
BEGIN
  -- Get current level
  SELECT level, praxis_points, weekly_xp, monthly_xp INTO old_level, current_pp, v_weekly_xp, v_monthly_xp
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Update XP and PP
  UPDATE public.profiles
  SET 
    total_xp = total_xp + p_xp_amount,
    praxis_points = praxis_points + p_pp_amount,
    weekly_xp = weekly_xp + p_xp_amount,
    monthly_xp = monthly_xp + p_xp_amount
  WHERE id = p_user_id
  RETURNING level, praxis_points INTO new_level, current_pp;
  
  -- Calculate if leveled up
  leveled_up := new_level > old_level;
  
  -- Check for weekly milestone bonus
  weekly_bonus := check_weekly_milestone(p_user_id);
  IF weekly_bonus > 0 THEN
    UPDATE public.profiles SET total_xp = total_xp + weekly_bonus WHERE id = p_user_id;
  END IF;
  
  -- Check for monthly milestone bonus
  monthly_bonus := check_monthly_milestone(p_user_id);
  IF monthly_bonus > 0 THEN
    UPDATE public.profiles SET total_xp = total_xp + monthly_bonus WHERE id = p_user_id;
  END IF;
  
  RETURN QUERY SELECT 
    (SELECT total_xp FROM public.profiles WHERE id = p_user_id) AS new_xp,
    new_level,
    current_pp AS new_pp,
    leveled_up;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- End of Migration
-- =============================================================================
