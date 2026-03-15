-- Praxis - Final Comprehensive Migrations
-- Run this ONCE on your Supabase SQL Editor
-- All statements are IDEMPOTENT (safe to run multiple times)
-- Generated: March 15, 2026

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  is_demo BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  minimal_ai_mode BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'user',
  honor_score NUMERIC DEFAULT 1000,
  praxis_points NUMERIC DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  reliability_score NUMERIC DEFAULT 100,
  goal_tree_edit_count INTEGER DEFAULT 0,
  last_activity_date DATE DEFAULT CURRENT_DATE,
  banned_until TIMESTAMPTZ,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- ============================================================================
-- 2. GOAL TREES
-- ============================================================================

-- Goal trees table
CREATE TABLE IF NOT EXISTS public.goal_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nodes JSONB DEFAULT '[]'::jsonb,
  root_nodes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goal_trees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goal trees" ON public.goal_trees;
CREATE POLICY "Users can view own goal trees" ON public.goal_trees FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goal trees" ON public.goal_trees;
CREATE POLICY "Users can update own goal trees" ON public.goal_trees FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goal trees" ON public.goal_trees;
CREATE POLICY "Users can insert own goal trees" ON public.goal_trees FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for goal trees
CREATE INDEX IF NOT EXISTS idx_goal_trees_user ON public.goal_trees(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_trees_nodes ON public.goal_trees USING GIN (nodes);

-- ============================================================================
-- 3. JOURNAL & NOTES (with emoji support)
-- ============================================================================

-- Node journal entries (goal-specific notes)
CREATE TABLE IF NOT EXISTS public.node_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_id UUID NOT NULL,
  note TEXT,  -- UTF-8 supports emojis natively
  mood TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'node_journal_entries' AND column_name = 'mood') THEN
    ALTER TABLE public.node_journal_entries ADD COLUMN mood TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'node_journal_entries' AND column_name = 'created_at') THEN
    ALTER TABLE public.node_journal_entries ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

ALTER TABLE public.node_journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own journal entries" ON public.node_journal_entries;
CREATE POLICY "Users can view own journal entries" ON public.node_journal_entries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own journal entries" ON public.node_journal_entries;
CREATE POLICY "Users can insert own journal entries" ON public.node_journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own journal entries" ON public.node_journal_entries;
CREATE POLICY "Users can update own journal entries" ON public.node_journal_entries FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own journal entries" ON public.node_journal_entries;
CREATE POLICY "Users can delete own journal entries" ON public.node_journal_entries FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_node_journal_user ON public.node_journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_node_journal_node ON public.node_journal_entries(node_id);
CREATE INDEX IF NOT EXISTS idx_node_journal_logged ON public.node_journal_entries(logged_at DESC);

-- Legacy journal_entries table (for backwards compatibility)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_id UUID,
  note TEXT,  -- UTF-8 supports emojis natively
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own journal entries" ON public.journal_entries;
CREATE POLICY "Users can view own journal entries" ON public.journal_entries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own journal entries" ON public.journal_entries;
CREATE POLICY "Users can insert own journal entries" ON public.journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own journal entries" ON public.journal_entries;
CREATE POLICY "Users can update own journal entries" ON public.journal_entries FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own journal entries" ON public.journal_entries;
CREATE POLICY "Users can delete own journal entries" ON public.journal_entries FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_user ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_created ON public.journal_entries(created_at DESC);

-- ============================================================================
-- 4. TRACKERS
-- ============================================================================

-- Trackers table
CREATE TABLE IF NOT EXISTS public.trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  goal JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own trackers" ON public.trackers;
CREATE POLICY "Users can view own trackers" ON public.trackers FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trackers" ON public.trackers;
CREATE POLICY "Users can insert own trackers" ON public.trackers FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trackers" ON public.trackers;
CREATE POLICY "Users can update own trackers" ON public.trackers FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trackers" ON public.trackers;
CREATE POLICY "Users can delete own trackers" ON public.trackers FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trackers_user ON public.trackers(user_id);
CREATE INDEX IF NOT EXISTS idx_trackers_type ON public.trackers(type);

-- Tracker entries table
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}'::jsonb,  -- UTF-8 supports emojis
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual'
);

-- Add source column if it doesn't exist (for existing tables)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tracker_entries' AND column_name = 'source') THEN
    ALTER TABLE public.tracker_entries ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
END $$;

ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can view own tracker entries" ON public.tracker_entries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can insert own tracker entries" ON public.tracker_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can delete own tracker entries" ON public.tracker_entries FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tracker_entries_tracker ON public.tracker_entries(tracker_id);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_user ON public.tracker_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_logged ON public.tracker_entries(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_data ON public.tracker_entries USING GIN (data);

-- ============================================================================
-- 5. AXIOM DAILY BRIEFS
-- ============================================================================

-- Axiom daily briefs table
CREATE TABLE IF NOT EXISTS public.axiom_daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  brief JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.axiom_daily_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own axiom briefs" ON public.axiom_daily_briefs;
CREATE POLICY "Users can view own axiom briefs" ON public.axiom_daily_briefs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own axiom briefs" ON public.axiom_daily_briefs;
CREATE POLICY "Users can insert own axiom briefs" ON public.axiom_daily_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_axiom_briefs_user ON public.axiom_daily_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_axiom_briefs_date ON public.axiom_daily_briefs(date DESC);
CREATE INDEX IF NOT EXISTS idx_axiom_briefs_user_date ON public.axiom_daily_briefs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_axiom_briefs_brief ON public.axiom_daily_briefs USING GIN (brief);

-- ============================================================================
-- 6. CHECK-INS
-- ============================================================================

-- Check-ins table
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mood TEXT,
  win_of_the_day TEXT,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  streak_day INTEGER
);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own checkins" ON public.checkins;
CREATE POLICY "Users can view own checkins" ON public.checkins FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own checkins" ON public.checkins;
CREATE POLICY "Users can insert own checkins" ON public.checkins FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkins_user ON public.checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_checked ON public.checkins(checked_in_at DESC);

-- ============================================================================
-- 7. POSTS (with emoji support)
-- ============================================================================

-- Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,  -- UTF-8 supports emojis
  image_url TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_deleted column if it doesn't exist (for existing tables)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'is_deleted') THEN
    ALTER TABLE public.posts ADD COLUMN is_deleted BOOLEAN DEFAULT false;
  END IF;
END $$;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own posts" ON public.posts;
CREATE POLICY "Users can view own posts" ON public.posts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Public posts viewable by everyone
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON public.posts;
CREATE POLICY "Public posts are viewable by everyone" ON public.posts FOR SELECT USING (NOT is_deleted);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_deleted ON public.posts(is_deleted);

-- ============================================================================
-- 8. GOAL NOTES (for retroactive goal editing)
-- ============================================================================

-- Goal notes table (for non-destructive goal edits)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'goal_notes') THEN
    CREATE TABLE public.goal_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      goal_id UUID NOT NULL,
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      note TEXT NOT NULL,  -- UTF-8 supports emojis
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE public.goal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own goal notes" ON public.goal_notes;
CREATE POLICY "Users can view own goal notes" ON public.goal_notes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goal notes" ON public.goal_notes;
CREATE POLICY "Users can insert own goal notes" ON public.goal_notes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goal_notes_goal ON public.goal_notes(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_notes_user ON public.goal_notes(user_id);

-- ============================================================================
-- 9. SYSTEM CONFIG
-- ============================================================================

-- System config table
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Admin can view all config
DROP POLICY IF EXISTS "Admins can view system config" ON public.system_config;
CREATE POLICY "Admins can view system config" ON public.system_config FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Admin can update config
DROP POLICY IF EXISTS "Admins can update system config" ON public.system_config;
CREATE POLICY "Admins can update system config" ON public.system_config FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ============================================================================
-- 10. HELPER FUNCTIONS
-- ============================================================================

-- Function to get top Axiom users
CREATE OR REPLACE FUNCTION public.get_top_axiom_users(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(user_id UUID, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    axiom_daily_briefs.user_id,
    COUNT(*)::BIGINT as count
  FROM axiom_daily_briefs
  GROUP BY axiom_daily_briefs.user_id
  ORDER BY count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_top_axiom_users(INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_top_axiom_users IS 'Returns top users by number of Axiom daily briefs generated';

-- ============================================================================
-- 11. GRANTS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.goal_trees TO authenticated;
GRANT ALL ON public.node_journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO authenticated;
GRANT ALL ON public.trackers TO authenticated;
GRANT ALL ON public.tracker_entries TO authenticated;
GRANT ALL ON public.axiom_daily_briefs TO authenticated;
GRANT ALL ON public.checkins TO authenticated;
GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.goal_notes TO authenticated;
GRANT ALL ON public.system_config TO authenticated;

-- ============================================================================
-- 12. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users';
COMMENT ON TABLE public.goal_trees IS 'User goal trees stored as JSONB';
COMMENT ON TABLE public.node_journal_entries IS 'Goal-specific journal entries with emoji support';
COMMENT ON TABLE public.journal_entries IS 'Legacy journal entries table';
COMMENT ON TABLE public.trackers IS 'User activity trackers (fitness, finance, etc.)';
COMMENT ON TABLE public.tracker_entries IS 'Individual tracker log entries';
COMMENT ON TABLE public.axiom_daily_briefs IS 'Daily AI-generated recommendations from Axiom';
COMMENT ON TABLE public.checkins IS 'Daily check-ins for streak tracking';
COMMENT ON TABLE public.posts IS 'User posts with emoji support';
COMMENT ON TABLE public.goal_notes IS 'Non-destructive notes/edits for goals';
COMMENT ON TABLE public.system_config IS 'System-wide configuration key-value store';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- This migration is IDEMPOTENT - safe to run multiple times
-- All tables use CREATE TABLE IF NOT EXISTS
-- All policies use DROP POLICY IF EXISTS before CREATE
-- All indexes use CREATE INDEX IF NOT EXISTS

SELECT 'Migrations completed successfully!' AS status;
