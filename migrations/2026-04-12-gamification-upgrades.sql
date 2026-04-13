-- ============================================================================
-- Gamification Upgrades: Weekly Challenge Track + Combo Claims + Achievement Master Enhancements
-- Run in Supabase SQL Editor
-- ============================================================================

-- 1. Weekly Challenge Progress table
CREATE TABLE IF NOT EXISTS public.weekly_challenge_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_key     VARCHAR(10) NOT NULL,  -- e.g. "2026-W15"
  weekly_xp    INTEGER NOT NULL DEFAULT 0,
  claimed_tiers INTEGER[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_key)
);

ALTER TABLE public.weekly_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_challenge_own"
  ON public.weekly_challenge_progress FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS weekly_challenge_user_week_idx
  ON public.weekly_challenge_progress (user_id, week_key);

-- 2. User Badges table (for weekly and other special badges)
CREATE TABLE IF NOT EXISTS public.user_badges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key  VARCHAR(50) NOT NULL,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_badges_own"
  ON public.user_badges FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS user_badges_user_idx ON public.user_badges (user_id);

-- 3. Combo Claims table (tracks which combos a user claimed each day)
CREATE TABLE IF NOT EXISTS public.combo_claims (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  combo_id   VARCHAR(50) NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, combo_id, claim_date)
);

ALTER TABLE public.combo_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "combo_claims_own"
  ON public.combo_claims FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS combo_claims_user_date_idx
  ON public.combo_claims (user_id, claim_date);

-- 4. Add category, hint, is_secret columns to achievements_master (if not exists)
ALTER TABLE public.achievements_master
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS hint TEXT,
  ADD COLUMN IF NOT EXISTS is_secret BOOLEAN DEFAULT false;

-- 5. Seed some secret achievements
INSERT INTO public.achievements_master (achievement_key, title, description, icon, tier, category, hint, is_secret, xp_reward, pp_reward, requirement_target)
VALUES
  ('night_owl',       'Night Owl',       'Check in after 11 PM',              '🦉', 'bronze', 'Secret',  'Some goals don''t sleep...', true,  50,  10, 1),
  ('early_bird',      'Early Bird',      'Check in before 6 AM',              '🌅', 'bronze', 'Secret',  'The early bird catches the worm.', true, 50, 10, 1),
  ('combo_master',    'Combo Master',    'Complete all 3 daily combos in one day', '⚡', 'gold', 'Mastery', 'Chain every action in a single day.', true, 200, 50, 1),
  ('weekly_legend_5', 'Five-Time Legend', 'Reach tier 7 in 5 different weeks', '👑', 'platinum', 'Mastery', 'Consistency is the ultimate flex.', false, 500, 150, 5),
  ('streak_30',       'Monthly Machine',  'Reach a 30-day streak',            '🔥', 'gold',   'Streaks', NULL, false, 200, 50, 30),
  ('streak_100',      'Centurion',       'Reach a 100-day streak',            '💯', 'diamond', 'Streaks', NULL, false, 500, 150, 100),
  ('social_10_posts', 'Town Crier',      'Create 10 posts',                   '📢', 'silver', 'Social',  NULL, false, 100, 25, 10),
  ('social_50_comments','Conversationalist','Leave 50 comments',              '💬', 'gold',   'Social',  NULL, false, 200, 50, 50),
  ('goals_5_completed','Goal Getter',     'Complete 5 goals',                 '🎯', 'silver', 'Goals',   NULL, false, 150, 40, 5),
  ('goals_20_completed','Goal Machine',   'Complete 20 goals',                '🏆', 'platinum','Goals',   NULL, false, 400, 100, 20)
ON CONFLICT (achievement_key) DO NOTHING;

-- Done!
