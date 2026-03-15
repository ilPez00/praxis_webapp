-- ============================================================================
-- POSTS TABLE - COMPLETE FIX
-- Run this in Supabase SQL Editor to fix all potential issues
-- ============================================================================

-- 1. Ensure reference column exists
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reference JSONB;
CREATE INDEX IF NOT EXISTS idx_posts_reference ON public.posts USING GIN (reference);

-- 2. Drop and recreate RLS policies (more permissive for debugging)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Own posts insert" ON public.posts;
DROP POLICY IF EXISTS "Own posts delete" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;

-- Allow anyone to read (public feed)
CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT USING (true);

-- Allow authenticated users to insert their own posts
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own posts
CREATE POLICY "Own posts delete" ON public.posts FOR DELETE 
  USING (auth.uid() = user_id);

-- 3. Ensure chat-media bucket exists for uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Grant permissions to authenticated users
GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.post_likes TO authenticated;
GRANT ALL ON public.post_comments TO authenticated;
GRANT ALL ON public.post_votes TO authenticated;

-- 5. Verify setup
SELECT 
  'posts table columns' as check_type,
  COUNT(*) as result
FROM information_schema.columns
WHERE table_name = 'posts'
UNION ALL
SELECT 
  'RLS policies count',
  COUNT(*)
FROM pg_policies
WHERE tablename = 'posts'
UNION ALL
SELECT 
  'Bucket exists',
  COUNT(*)
FROM storage.buckets
WHERE name = 'chat-media';

-- Expected results:
-- posts table columns: 11 (or more)
-- RLS policies count: 3
-- Bucket exists: 1
