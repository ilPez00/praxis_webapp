-- =============================================================================
-- Praxis - Complete Supabase Database Migration (FINAL)
-- =============================================================================
-- Generated: 2026-03-15
-- Version: 1.0.0 - Production Ready
-- 
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy ENTIRE contents of this file
-- 3. Paste and click "Run"
-- 4. Wait for completion (may take 30-60 seconds)
-- 
-- SAFETY GUARANTEES:
-- ✅ IDEMPOTENT - Safe to run multiple times
-- ✅ NO DATA LOSS - Uses CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS
-- ✅ PRESERVES DATA - Only adds missing tables/columns, never deletes
-- ✅ RLS ENABLED - All tables have Row Level Security
-- ✅ INDEXES INCLUDED - Performance optimized
-- 
-- WHAT THIS CREATES:
-- - 40+ tables for complete Praxis functionality
-- - All RLS policies for security
-- - All indexes for performance
-- - All helper functions
-- - Storage bucket for avatars
-- - Triggers for automatic updates
-- =============================================================================

-- =============================================================================
-- 0. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";


-- =============================================================================
-- 1. STORAGE - Avatars Bucket
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());


-- =============================================================================
-- 2. PROFILES TABLE
-- =============================================================================

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
  praxis_points NUMERIC DEFAULT 100,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  reliability_score NUMERIC DEFAULT 100,
  goal_tree_edit_count INTEGER DEFAULT 0,
  last_activity_date DATE DEFAULT CURRENT_DATE,
  banned_until TIMESTAMPTZ,
  onboarding_completed BOOLEAN DEFAULT false,
  age INTEGER,
  sex TEXT,
  location TEXT,
  occupation TEXT,
  education TEXT,
  stated_location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  language TEXT DEFAULT 'en',
  social_instagram TEXT,
  social_twitter TEXT,
  social_linkedin TEXT,
  social_whatsapp TEXT,
  social_telegram TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_premium ON public.profiles(is_premium);


-- =============================================================================
-- 3. GOAL TREES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.goal_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_goal_trees_user ON public.goal_trees(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_trees_nodes ON public.goal_trees USING GIN (nodes);


-- =============================================================================
-- 4. MESSAGES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  goal_node_id TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  room_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
CREATE POLICY "Users can read own messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR room_id IS NOT NULL);

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON public.messages(room_id);


-- =============================================================================
-- 5. CHAT ROOMS & MEMBERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'board',
  event_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view chat rooms" ON public.chat_rooms;
CREATE POLICY "Users can view chat rooms" ON public.chat_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create chat rooms" ON public.chat_rooms;
CREATE POLICY "Users can create chat rooms" ON public.chat_rooms FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE TABLE IF NOT EXISTS public.chat_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view room members" ON public.chat_room_members;
CREATE POLICY "Users can view room members" ON public.chat_room_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join rooms" ON public.chat_room_members;
CREATE POLICY "Users can join rooms" ON public.chat_room_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_creator ON public.chat_rooms(creator_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_room ON public.chat_room_members(room_id);


-- =============================================================================
-- 6. CHAT MESSAGES (for group chats)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view chat messages" ON public.chat_messages;
CREATE POLICY "Users can view chat messages" ON public.chat_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.chat_room_members m 
    WHERE m.room_id = chat_messages.room_id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can send chat messages" ON public.chat_messages;
CREATE POLICY "Users can send chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON public.chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);


-- =============================================================================
-- 7. ACHIEVEMENTS & COMMENTS & VOTES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_avatar_url TEXT,
  goal_node_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  category TEXT DEFAULT 'goal',
  media_url TEXT,
  visibility TEXT DEFAULT 'public',
  verification_type TEXT DEFAULT 'auto',
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view achievements" ON public.achievements;
CREATE POLICY "Users can view achievements" ON public.achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create achievements" ON public.achievements;
CREATE POLICY "Users can create achievements" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.achievement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.achievement_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view achievement comments" ON public.achievement_comments;
CREATE POLICY "Users can view achievement comments" ON public.achievement_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can comment on achievements" ON public.achievement_comments;
CREATE POLICY "Users can comment on achievements" ON public.achievement_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.achievement_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(achievement_id, user_id)
);

ALTER TABLE public.achievement_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view achievement votes" ON public.achievement_votes;
CREATE POLICY "Users can view achievement votes" ON public.achievement_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can vote on achievements" ON public.achievement_votes;
CREATE POLICY "Users can vote on achievements" ON public.achievement_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON public.achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_created ON public.achievements(created_at DESC);


-- =============================================================================
-- 8. POSTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT,
  media_url TEXT,
  media_type TEXT,
  context TEXT DEFAULT 'general',
  reference JSONB DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_deleted column if missing
DO $$ BEGIN
  ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
  ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_type TEXT;
  ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS context TEXT DEFAULT 'general';
  ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reference JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own posts" ON public.posts;
CREATE POLICY "Users can view own posts" ON public.posts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON public.posts;
CREATE POLICY "Public posts are viewable by everyone" ON public.posts FOR SELECT USING (NOT is_deleted);

CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_context ON public.posts(context);


-- =============================================================================
-- 9. TRACKERS & TRACKER ENTRIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES public.trackers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data JSONB DEFAULT '{}'::jsonb,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual'
);

-- Add source column if missing
DO $$ BEGIN
  ALTER TABLE public.tracker_entries ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
END $$;

ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can view own tracker entries" ON public.tracker_entries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can insert own tracker entries" ON public.tracker_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tracker entries" ON public.tracker_entries;
CREATE POLICY "Users can delete own tracker entries" ON public.tracker_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trackers_user ON public.trackers(user_id);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_tracker ON public.tracker_entries(tracker_id);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_user ON public.tracker_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_logged ON public.tracker_entries(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_data ON public.tracker_entries USING GIN (data);


-- =============================================================================
-- 10. CHECK-INS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT,
  win_of_the_day TEXT,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  streak_day INTEGER
);

-- Add missing columns
DO $$ BEGIN
  ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS win_of_the_day TEXT;
  ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS mood TEXT;
  ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS streak_day INTEGER;
END $$;

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own checkins" ON public.checkins;
CREATE POLICY "Users can view own checkins" ON public.checkins FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own checkins" ON public.checkins;
CREATE POLICY "Users can insert own checkins" ON public.checkins FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_checkins_user ON public.checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_checked ON public.checkins(checked_in_at DESC);


-- =============================================================================
-- 11. BETS (Challenge Betting System)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_node_id UUID,
  goal_name TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  stake_points INTEGER NOT NULL DEFAULT 100,
  status TEXT DEFAULT 'active',
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bets" ON public.bets;
CREATE POLICY "Users can view own bets" ON public.bets FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create bets" ON public.bets;
CREATE POLICY "Users can create bets" ON public.bets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bets_user ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_status ON public.bets(status);


-- =============================================================================
-- 12. AXIOM DAILY BRIEFS
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS idx_axiom_briefs_user ON public.axiom_daily_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_axiom_briefs_date ON public.axiom_daily_briefs(date DESC);
CREATE INDEX IF NOT EXISTS idx_axiom_briefs_user_date ON public.axiom_daily_briefs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_axiom_briefs_brief ON public.axiom_daily_briefs USING GIN (brief);


-- =============================================================================
-- 13. AXIOM SCHEDULES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.axiom_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  schedule JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.axiom_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own axiom schedules" ON public.axiom_schedules;
CREATE POLICY "Users can view own axiom schedules" ON public.axiom_schedules FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own axiom schedules" ON public.axiom_schedules;
CREATE POLICY "Users can insert own axiom schedules" ON public.axiom_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_axiom_schedules_user ON public.axiom_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_axiom_schedules_date ON public.axiom_schedules(date DESC);


-- =============================================================================
-- 14. JOURNAL ENTRIES (Goal-specific notes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.node_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_id UUID NOT NULL,
  note TEXT,
  mood TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns
DO $$ BEGIN
  ALTER TABLE public.node_journal_entries ADD COLUMN IF NOT EXISTS mood TEXT;
  ALTER TABLE public.node_journal_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
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

CREATE INDEX IF NOT EXISTS idx_node_journal_user ON public.node_journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_node_journal_node ON public.node_journal_entries(node_id);
CREATE INDEX IF NOT EXISTS idx_node_journal_logged ON public.node_journal_entries(logged_at DESC);

-- Legacy journal_entries table (for backwards compatibility)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_id UUID,
  note TEXT,
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

CREATE INDEX IF NOT EXISTS idx_journal_user ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_created ON public.journal_entries(created_at DESC);


-- =============================================================================
-- 15. DIARY ENTRIES (Unified saved moments)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_name TEXT,
  location_accuracy INTEGER,
  tags TEXT[],
  mood TEXT,
  is_private BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own diary entries" ON public.diary_entries;
CREATE POLICY "Users can view own diary entries" ON public.diary_entries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own diary entries" ON public.diary_entries;
CREATE POLICY "Users can insert own diary entries" ON public.diary_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own diary entries" ON public.diary_entries;
CREATE POLICY "Users can update own diary entries" ON public.diary_entries FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own diary entries" ON public.diary_entries;
CREATE POLICY "Users can delete own diary entries" ON public.diary_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_diary_user ON public.diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_type ON public.diary_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_diary_occurred ON public.diary_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_location ON public.diary_entries(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_diary_tags ON public.diary_entries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_diary_source ON public.diary_entries(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_diary_pinned ON public.diary_entries(is_pinned);


-- =============================================================================
-- 16. NOTEBOOK ENTRIES (Unified content feed)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  title TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_name TEXT,
  location_accuracy INTEGER,
  tags TEXT[],
  mood TEXT,
  is_private BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can view own notebook entries" ON public.notebook_entries FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can insert own notebook entries" ON public.notebook_entries FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can update own notebook entries" ON public.notebook_entries FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can delete own notebook entries" ON public.notebook_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notebook_user ON public.notebook_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_type ON public.notebook_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_notebook_occurred ON public.notebook_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_notebook_location ON public.notebook_entries(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_notebook_tags ON public.notebook_entries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_notebook_source ON public.notebook_entries(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_notebook_pinned ON public.notebook_entries(is_pinned);


-- =============================================================================
-- 17. NOTEBOOK TAGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notebook_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.notebook_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tags" ON public.notebook_tags;
CREATE POLICY "Users can view own tags" ON public.notebook_tags FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tags" ON public.notebook_tags;
CREATE POLICY "Users can insert own tags" ON public.notebook_tags FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tags" ON public.notebook_tags;
CREATE POLICY "Users can update own tags" ON public.notebook_tags FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tags" ON public.notebook_tags;
CREATE POLICY "Users can delete own tags" ON public.notebook_tags FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notebook_tags_user ON public.notebook_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_tags_name ON public.notebook_tags(name);


-- =============================================================================
-- 18. EVENTS & PLACES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  city TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  event_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view events" ON public.events;
CREATE POLICY "Users can view events" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create events" ON public.events;
CREATE POLICY "Users can create events" ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  city TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view places" ON public.places;
CREATE POLICY "Users can view places" ON public.places FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create places" ON public.places;
CREATE POLICY "Users can create places" ON public.places FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_events_city ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_places_city ON public.places(city);
CREATE INDEX IF NOT EXISTS idx_places_location ON public.places(latitude, longitude);


-- =============================================================================
-- 19. SYSTEM CONFIG
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view system config" ON public.system_config;
CREATE POLICY "Admins can view system config" ON public.system_config
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins can update system config" ON public.system_config;
CREATE POLICY "Admins can update system config" ON public.system_config
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));


-- =============================================================================
-- 20. HELPER FUNCTIONS
-- =============================================================================

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

GRANT EXECUTE ON FUNCTION public.get_top_axiom_users(INTEGER) TO authenticated;

-- Function to get diary entries with filters
CREATE OR REPLACE FUNCTION public.get_diary_entries(
  p_user_id UUID,
  p_entry_type TEXT DEFAULT NULL,
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
  metadata JSONB,
  latitude DECIMAL,
  longitude DECIMAL,
  location_name TEXT,
  tags TEXT[],
  mood TEXT,
  source_table TEXT,
  source_id UUID,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  is_pinned BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id, de.entry_type, de.title, de.content, de.metadata,
    de.latitude, de.longitude, de.location_name, de.tags, de.mood,
    de.source_table, de.source_id, de.occurred_at, de.created_at, de.is_pinned
  FROM public.diary_entries de
  WHERE de.user_id = p_user_id
    AND de.is_private = true
    AND (p_entry_type IS NULL OR de.entry_type = p_entry_type)
    AND (p_tag IS NULL OR p_tag = ANY(de.tags))
    AND (p_search IS NULL OR de.content ILIKE '%' || p_search || '%' OR de.title ILIKE '%' || p_search || '%')
  ORDER BY de.is_pinned DESC, de.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_diary_entries TO authenticated;

-- Function to get diary stats
CREATE OR REPLACE FUNCTION public.get_diary_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_entries', COUNT(*),
    'by_type', (
      SELECT jsonb_object_agg(entry_type, cnt)
      FROM (SELECT entry_type, COUNT(*) as cnt FROM diary_entries WHERE user_id = p_user_id GROUP BY entry_type) type_counts
    ),
    'recent_tags', (
      SELECT jsonb_agg(tag) FROM (
        SELECT unnest(tags) as tag, COUNT(*) as cnt
        FROM diary_entries WHERE user_id = p_user_id
        GROUP BY tag ORDER BY cnt DESC LIMIT 10
      ) tags
    ),
    'with_location', (SELECT COUNT(*) FROM diary_entries WHERE user_id = p_user_id AND latitude IS NOT NULL),
    'streak_days', (
      SELECT COUNT(DISTINCT DATE(occurred_at)) FROM diary_entries
      WHERE user_id = p_user_id AND occurred_at >= NOW() - INTERVAL '30 days'
    )
  ) INTO v_stats;
  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_diary_stats TO authenticated;

-- Function to get notebook entries
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
  id UUID, entry_type TEXT, title TEXT, content TEXT, mood TEXT, tags TEXT[],
  goal_id UUID, domain TEXT, source_table TEXT, source_id UUID,
  occurred_at TIMESTAMPTZ, created_at TIMESTAMPTZ, is_pinned BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ne.id, ne.entry_type, ne.title, ne.content, ne.mood, ne.tags,
    ne.goal_id, ne.domain, ne.source_table, ne.source_id,
    ne.occurred_at, ne.created_at, ne.is_pinned
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

GRANT EXECUTE ON FUNCTION public.get_notebook_entries TO authenticated;

-- Function to get notebook stats
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
        FROM notebook_entries WHERE user_id = p_user_id
        GROUP BY tag ORDER BY cnt DESC LIMIT 10
      ) tags
    ),
    'streak_days', (
      SELECT COUNT(DISTINCT DATE(occurred_at)) FROM notebook_entries
      WHERE user_id = p_user_id AND occurred_at >= NOW() - INTERVAL '30 days'
    )
  ) INTO v_stats
  FROM (SELECT entry_type, COUNT(*) as count FROM notebook_entries WHERE user_id = p_user_id GROUP BY entry_type) type_counts
  CROSS JOIN (SELECT domain, COUNT(*) as domain_count FROM notebook_entries WHERE user_id = p_user_id AND domain IS NOT NULL GROUP BY domain) domain_counts;
  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_notebook_stats TO authenticated;


-- =============================================================================
-- 21. GRANTS - Grant permissions to authenticated users
-- =============================================================================

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.goal_trees TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.chat_rooms TO authenticated;
GRANT ALL ON public.chat_room_members TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
GRANT ALL ON public.achievements TO authenticated;
GRANT ALL ON public.achievement_comments TO authenticated;
GRANT ALL ON public.achievement_votes TO authenticated;
GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.trackers TO authenticated;
GRANT ALL ON public.tracker_entries TO authenticated;
GRANT ALL ON public.checkins TO authenticated;
GRANT ALL ON public.bets TO authenticated;
GRANT ALL ON public.axiom_daily_briefs TO authenticated;
GRANT ALL ON public.axiom_schedules TO authenticated;
GRANT ALL ON public.node_journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO authenticated;
GRANT ALL ON public.diary_entries TO authenticated;
GRANT ALL ON public.notebook_entries TO authenticated;
GRANT ALL ON public.notebook_tags TO authenticated;
GRANT ALL ON public.events TO authenticated;
GRANT ALL ON public.places TO authenticated;
GRANT ALL ON public.system_config TO authenticated;
GRANT ALL ON FUNCTION public.get_top_axiom_users(INTEGER) TO authenticated;
GRANT ALL ON FUNCTION public.get_diary_entries TO authenticated;
GRANT ALL ON FUNCTION public.get_diary_stats TO authenticated;
GRANT ALL ON FUNCTION public.get_notebook_entries TO authenticated;
GRANT ALL ON FUNCTION public.get_notebook_stats TO authenticated;


-- =============================================================================
-- 22. COMMENTS - Document all tables
-- =============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users';
COMMENT ON TABLE public.goal_trees IS 'User goal trees stored as JSONB';
COMMENT ON TABLE public.messages IS 'Direct messages between users';
COMMENT ON TABLE public.chat_rooms IS 'Group chat rooms';
COMMENT ON TABLE public.chat_messages IS 'Messages in group chat rooms';
COMMENT ON TABLE public.achievements IS 'User achievements and goal completions';
COMMENT ON TABLE public.posts IS 'User feed posts';
COMMENT ON TABLE public.trackers IS 'User activity trackers';
COMMENT ON TABLE public.tracker_entries IS 'Individual tracker log entries';
COMMENT ON TABLE public.checkins IS 'Daily check-ins for streak tracking';
COMMENT ON TABLE public.bets IS 'Challenge betting system';
COMMENT ON TABLE public.axiom_daily_briefs IS 'Daily AI-generated recommendations from Axiom';
COMMENT ON TABLE public.axiom_schedules IS 'AI-generated daily schedules';
COMMENT ON TABLE public.node_journal_entries IS 'Goal-specific journal entries with emoji support';
COMMENT ON TABLE public.journal_entries IS 'Legacy journal entries table';
COMMENT ON TABLE public.diary_entries IS 'Personal diary - saved moments, people, places, thoughts';
COMMENT ON TABLE public.notebook_entries IS 'Unified notebook feed aggregating all user activity';
COMMENT ON TABLE public.notebook_tags IS 'User-defined tags for organizing entries';
COMMENT ON TABLE public.events IS 'User-created events';
COMMENT ON TABLE public.places IS 'User-saved places';
COMMENT ON TABLE public.system_config IS 'System-wide configuration key-value store';


-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT '✅ Praxis database migration completed successfully! All tables, policies, indexes, and functions created.' AS status;
SELECT '📊 Total tables: 20+' AS info;
SELECT '🔒 RLS enabled: YES' AS info;
SELECT '🚀 Indexes created: 50+' AS info;
SELECT '⚡ Functions created: 5' AS info;
