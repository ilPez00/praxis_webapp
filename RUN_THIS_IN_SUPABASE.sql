-- ================================================================
-- PRAXIS DATABASE SETUP
-- Run this ENTIRE script in your NEW Supabase project's SQL Editor
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Create profiles table with all columns
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  age INT,
  bio TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  goal_tree_edit_count INT DEFAULT 0,
  sex TEXT,
  location TEXT,
  current_streak INT DEFAULT 0,
  last_activity_date DATE,
  praxis_points INT DEFAULT 100,
  is_verified BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  social_instagram TEXT,
  social_twitter TEXT,
  social_linkedin TEXT,
  social_whatsapp TEXT,
  social_telegram TEXT,
  minimal_ai_mode BOOLEAN DEFAULT TRUE,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable by authenticated users" 
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  goal_node_id TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  room_id UUID,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Users can read own messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR room_id IS NOT NULL);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 3. Goal trees table - use snake_case to match backend
-- Drop existing table if it has wrong schema
DROP TABLE IF EXISTS public.goal_trees CASCADE;

CREATE TABLE public.goal_trees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nodes JSONB NOT NULL DEFAULT '[]',
  root_nodes JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.goal_trees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own goal tree" ON public.goal_trees;

CREATE POLICY "Users can manage own goal tree" ON public.goal_trees
  FOR ALL USING (auth.uid() = user_id);

-- 4. Check-ins table
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT,
  win_of_the_day TEXT,
  challenge_of_the_day TEXT,
  gratitude TEXT,
  streak_day INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Users can create own check-ins" ON public.check_ins;

CREATE POLICY "Users can view own check-ins" ON public.check_ins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own check-ins" ON public.check_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Trackers table
CREATE TABLE IF NOT EXISTS public.trackers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  node_id TEXT,
  name TEXT NOT NULL,
  unit TEXT,
  goal_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own trackers" ON public.trackers;

CREATE POLICY "Users can manage own trackers" ON public.trackers
  FOR ALL USING (auth.uid() = user_id);

-- 6. Tracker entries table
CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracker_id UUID REFERENCES public.trackers(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tracker entries" ON public.tracker_entries;

CREATE POLICY "Users can manage own tracker entries" ON public.tracker_entries
  FOR ALL USING (tracker_id IN (SELECT id FROM public.trackers WHERE user_id = auth.uid()));

-- 7. Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title TEXT,
  media_url TEXT,
  media_type TEXT,
  context TEXT,
  reference JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posts are viewable by authenticated users" ON public.posts;
DROP POLICY IF EXISTS "Users can create own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;

CREATE POLICY "Posts are viewable by authenticated users" ON public.posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create own posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON public.posts
  FOR DELETE USING (auth.uid() = user_id);

-- 8. Post comments table
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are viewable by authenticated users" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create own comments" ON public.post_comments;

CREATE POLICY "Comments are viewable by authenticated users" ON public.post_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create own comments" ON public.post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 9. Notebook entries table (for diary/share functionality)
CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  metadata JSONB,
  source_table TEXT,
  source_id TEXT,
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can insert own entries" ON public.notebook_entries;

CREATE POLICY "Users can read own entries" ON public.notebook_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" ON public.notebook_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 10. Bets table (for challenge betting)
CREATE TABLE IF NOT EXISTS public.bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_name TEXT NOT NULL,
  goal_node_id TEXT,
  stake_points INT NOT NULL DEFAULT 50,
  deadline TIMESTAMPTZ NOT NULL,
  terms TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bets" ON public.bets;
DROP POLICY IF EXISTS "Users can create own bets" ON public.bets;

CREATE POLICY "Users can view own bets" ON public.bets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bets" ON public.bets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 11. Axiom daily briefs table
CREATE TABLE IF NOT EXISTS public.axiom_daily_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  brief JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.axiom_daily_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own axiom briefs" ON public.axiom_daily_briefs;
DROP POLICY IF EXISTS "Users can insert own axiom briefs" ON public.axiom_daily_briefs;

CREATE POLICY "Users can view own axiom briefs" ON public.axiom_daily_briefs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own axiom briefs" ON public.axiom_daily_briefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_goal_trees_user ON public.goal_trees(user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_user ON public.check_ins(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trackers_user ON public.trackers(user_id);
CREATE INDEX IF NOT EXISTS idx_tracker_entries_tracker ON public.tracker_entries(tracker_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_notebook_entries_user ON public.notebook_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_user ON public.bets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_axiom_briefs_user_date ON public.axiom_daily_briefs(user_id, date DESC);

-- Insert storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());

-- ================================================================
-- SETUP COMPLETE! ✅
-- ================================================================
