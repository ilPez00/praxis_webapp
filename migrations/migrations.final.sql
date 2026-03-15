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

-- Add win_of_the_day column if it doesn't exist (for existing tables)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checkins') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checkins' AND column_name = 'win_of_the_day') THEN
      ALTER TABLE public.checkins ADD COLUMN win_of_the_day TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checkins' AND column_name = 'mood') THEN
      ALTER TABLE public.checkins ADD COLUMN mood TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checkins' AND column_name = 'streak_day') THEN
      ALTER TABLE public.checkins ADD COLUMN streak_day INTEGER;
    END IF;
  END IF;
END $$;

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
-- Smart Notebook System Migrations
-- Run this AFTER migrations.final.sql
-- All statements are IDEMPOTENT (safe to run multiple times)

-- ============================================================================
-- 1. NOTEBOOK ENTRIES (Unified feed for all content)
-- ============================================================================

-- Main notebook entries table (polymorphic - references all content types)
CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Content type (what kind of entry is this?)
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'note',           -- Manual journal note
    'tracker',        -- Tracker log
    'goal_progress',  -- Goal progress update
    'post',           -- Public post
    'event',          -- Event attended/created
    'message',        -- Important message/conversation
    'checkin',        -- Daily check-in
    'achievement',    -- Achievement unlocked
    'bet',            -- Bet/challenge placed or completed
    'match',          -- New match/connection
    'verification',   -- Goal verification
    'comment'         -- Comment on something
  )),
  
  -- Polymorphic reference to source content
  source_table TEXT,  -- e.g., 'posts', 'tracker_entries', 'events'
  source_id UUID,     -- ID of the source record
  
  -- Content
  title TEXT,         -- Optional title
  content TEXT NOT NULL,  -- Main content (UTF-8 with emoji support)
  
  -- Context
  goal_id UUID,       -- Associated goal (if any)
  domain TEXT,        -- Goal domain (if applicable)
  
  -- Metadata
  mood TEXT,          -- Mood/emotion
  tags TEXT[],        -- Array of tags for categorization
  attachments JSONB DEFAULT '[]'::jsonb,  -- Images, links, etc.
  
  -- Privacy
  is_private BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),  -- When the event occurred
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to existing notebook_entries if table exists but columns missing
DO $$ 
BEGIN 
  -- Add tags column if missing
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notebook_entries') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'tags') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN tags TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'attachments') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'goal_id') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN goal_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'domain') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN domain TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'source_table') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN source_table TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'source_id') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN source_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'entry_type') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN entry_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'is_pinned') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'occurred_at') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN occurred_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  ELSE
    -- Table doesn't exist, create it
    CREATE TABLE public.notebook_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL,
      source_table TEXT,
      source_id UUID,
      title TEXT,
      content TEXT NOT NULL,
      goal_id UUID,
      domain TEXT,
      mood TEXT,
      tags TEXT[],
      attachments JSONB DEFAULT '[]'::jsonb,
      is_private BOOLEAN DEFAULT false,
      is_pinned BOOLEAN DEFAULT false,
      occurred_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can view own notebook entries" ON public.notebook_entries 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can insert own notebook entries" ON public.notebook_entries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can update own notebook entries" ON public.notebook_entries 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can delete own notebook entries" ON public.notebook_entries 
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notebook_user ON public.notebook_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_type ON public.notebook_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_notebook_occurred ON public.notebook_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_notebook_goal ON public.notebook_entries(goal_id);
CREATE INDEX IF NOT EXISTS idx_notebook_domain ON public.notebook_entries(domain);
CREATE INDEX IF NOT EXISTS idx_notebook_tags ON public.notebook_entries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_notebook_source ON public.notebook_entries(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_notebook_content ON public.notebook_entries USING GIN (to_tsvector('english', content));

-- ============================================================================
-- 2. TAGS SYSTEM (for cross-referencing)
-- ============================================================================

-- Tags table (for organized tagging)
CREATE TABLE IF NOT EXISTS public.notebook_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B5CF6',  -- Default purple
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.notebook_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tags" ON public.notebook_tags;
CREATE POLICY "Users can view own tags" ON public.notebook_tags 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tags" ON public.notebook_tags;
CREATE POLICY "Users can insert own tags" ON public.notebook_tags 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tags" ON public.notebook_tags;
CREATE POLICY "Users can update own tags" ON public.notebook_tags 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tags" ON public.notebook_tags;
CREATE POLICY "Users can delete own tags" ON public.notebook_tags 
  FOR DELETE USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_notebook_tags_user ON public.notebook_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_tags_name ON public.notebook_tags(name);

-- ============================================================================
-- 3. AUTOMATIC ENTRY CREATION FUNCTIONS
-- ============================================================================

-- Function to create notebook entry from trigger
CREATE OR REPLACE FUNCTION public.create_notebook_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_content TEXT;
  v_title TEXT;
  v_goal_id UUID;
  v_domain TEXT;
  v_mood TEXT;
  v_win_of_the_day TEXT;
BEGIN
  -- Get win_of_the_day if column exists
  BEGIN
    SELECT NEW.win_of_the_day INTO v_win_of_the_day;
  EXCEPTION WHEN undefined_column THEN
    v_win_of_the_day := NULL;
  END;
  
  -- Determine entry type and content based on source table
  CASE TG_TABLE_NAME
    WHEN 'posts' THEN
      v_entry_type := 'post';
      v_content := NEW.content;
      v_title := 'Posted to feed';
    WHEN 'tracker_entries' THEN
      v_entry_type := 'tracker';
      v_content := COALESCE(NEW.data::text, 'Tracker entry logged');
      v_title := 'Tracker activity';
    WHEN 'checkins' THEN
      v_entry_type := 'checkin';
      v_content := COALESCE(v_win_of_the_day, 'Daily check-in completed');
      v_title := 'Daily Check-in';
      v_mood := NEW.mood;
    WHEN 'journal_entries' THEN
      v_entry_type := 'note';
      v_content := NEW.note;
      v_title := 'Journal entry';
      v_mood := NEW.mood;
      v_goal_id := NEW.node_id;
    WHEN 'node_journal_entries' THEN
      v_entry_type := 'note';
      v_content := NEW.note;
      v_title := 'Goal note';
      v_mood := NEW.mood;
      v_goal_id := NEW.node_id;
    ELSE
      v_entry_type := 'note';
      v_content := 'Entry created';
      v_title := 'Note';
  END CASE;
  
  -- Insert into notebook
  INSERT INTO public.notebook_entries (
    user_id, entry_type, source_table, source_id,
    title, content, goal_id, domain, mood, occurred_at
  ) VALUES (
    NEW.user_id, v_entry_type, TG_TABLE_NAME, NEW.id,
    v_title, v_content, v_goal_id, v_domain, v_mood, 
    COALESCE(NEW.created_at, NEW.logged_at, NEW.checked_in_at, NOW())
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic notebook entry creation
DROP TRIGGER IF EXISTS trg_posts_notebook ON public.posts;
CREATE TRIGGER trg_posts_notebook
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_tracker_entries_notebook ON public.tracker_entries;
CREATE TRIGGER trg_tracker_entries_notebook
  AFTER INSERT ON public.tracker_entries
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_checkins_notebook ON public.checkins;
CREATE TRIGGER trg_checkins_notebook
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_journal_entries_notebook ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_notebook
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_node_journal_entries_notebook ON public.node_journal_entries;
CREATE TRIGGER trg_node_journal_entries_notebook
  AFTER INSERT ON public.node_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to get notebook entries with filters
CREATE OR REPLACE FUNCTION public.get_notebook_entries(
  p_user_id UUID,
  p_entry_type TEXT DEFAULT NULL,
  p_goal_id UUID DEFAULT NULL,
  p_domain TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  entry_type TEXT,
  title TEXT,
  content TEXT,
  mood TEXT,
  tags TEXT[],
  goal_id UUID,
  domain TEXT,
  source_table TEXT,
  source_id UUID,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  is_pinned BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ne.id,
    ne.entry_type,
    ne.title,
    ne.content,
    ne.mood,
    ne.tags,
    ne.goal_id,
    ne.domain,
    ne.source_table,
    ne.source_id,
    ne.occurred_at,
    ne.created_at,
    ne.is_pinned
  FROM public.notebook_entries ne
  WHERE ne.user_id = p_user_id
    AND (p_entry_type IS NULL OR ne.entry_type = p_entry_type)
    AND (p_goal_id IS NULL OR ne.goal_id = p_goal_id)
    AND (p_domain IS NULL OR ne.domain = p_domain)
    AND (p_tag IS NULL OR p_tag = ANY(ne.tags))
    AND (p_search IS NULL OR ne.content ILIKE '%' || p_search || '%')
  ORDER BY ne.is_pinned DESC, ne.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notebook stats for user
CREATE OR REPLACE FUNCTION public.get_notebook_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_entries', COUNT(*),
    'by_type', jsonb_object_agg(entry_type, count),
    'by_domain', jsonb_object_agg(domain, domain_count),
    'recent_tags', (
      SELECT jsonb_agg(tag) FROM (
        SELECT unnest(tags) as tag, COUNT(*) as cnt
        FROM notebook_entries
        WHERE user_id = p_user_id
        GROUP BY tag
        ORDER BY cnt DESC
        LIMIT 10
      ) tags
    ),
    'streak_days', (
      SELECT COUNT(DISTINCT DATE(occurred_at))
      FROM notebook_entries
      WHERE user_id = p_user_id
      AND occurred_at >= NOW() - INTERVAL '30 days'
    )
  )
  INTO v_stats
  FROM (
    SELECT entry_type, COUNT(*) as count
    FROM notebook_entries
    WHERE user_id = p_user_id
    GROUP BY entry_type
  ) type_counts
  CROSS JOIN (
    SELECT domain, COUNT(*) as domain_count
    FROM notebook_entries
    WHERE user_id = p_user_id AND domain IS NOT NULL
    GROUP BY domain
  ) domain_counts;
  
  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.notebook_entries TO authenticated;
GRANT ALL ON public.notebook_tags TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notebook_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notebook_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notebook_entry TO authenticated;

-- ============================================================================
-- 5. MIGRATE EXISTING DATA
-- ============================================================================

-- Migrate existing journal entries to notebook
INSERT INTO public.notebook_entries (user_id, entry_type, source_table, source_id, title, content, mood, occurred_at)
SELECT user_id, 'note', 'journal_entries', id, 'Journal entry', note, mood, created_at
FROM public.journal_entries
ON CONFLICT DO NOTHING;

-- Migrate existing tracker entries to notebook
INSERT INTO public.notebook_entries (user_id, entry_type, source_table, source_id, title, content, occurred_at)
SELECT te.user_id, 'tracker', 'tracker_entries', te.id, 'Tracker activity', te.data::text, te.logged_at
FROM public.tracker_entries te
ON CONFLICT DO NOTHING;

-- Migrate existing check-ins to notebook
INSERT INTO public.notebook_entries (user_id, entry_type, source_table, source_id, title, content, mood, occurred_at)
SELECT user_id, 'checkin', 'checkins', id, 'Daily Check-in', COALESCE(win_of_the_day, 'Checked in'), mood, checked_in_at
FROM public.checkins
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.notebook_entries IS 'Unified notebook feed aggregating all user activity';
COMMENT ON TABLE public.notebook_tags IS 'User-defined tags for organizing notebook entries';
COMMENT ON FUNCTION public.create_notebook_entry IS 'Trigger function to auto-create notebook entries';
COMMENT ON FUNCTION public.get_notebook_entries IS 'Query notebook entries with filters';
COMMENT ON FUNCTION public.get_notebook_stats IS 'Get notebook usage statistics';

SELECT 'Smart Notebook migrations completed successfully!' AS status;
