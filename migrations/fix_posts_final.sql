-- ============================================================================
-- COMPLETE POSTS TABLE FIX (INCLUDING RLS CLEANUP)
-- Run this ENTIRE script in Supabase SQL Editor
-- This will fix everything at once
-- ============================================================================

-- PART 1: Add missing columns
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reference JSONB;
CREATE INDEX IF NOT EXISTS idx_posts_reference ON public.posts USING GIN (reference);
COMMENT ON COLUMN public.posts.reference IS 'Linked reference data (goal, service, post, etc.) in JSONB format';

-- PART 2: Clean up ALL duplicate RLS policies
DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Own posts insert" ON public.posts;
DROP POLICY IF EXISTS "Own posts delete" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.posts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.posts;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.posts;
DROP POLICY IF EXISTS "Users can read all posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can read post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "Own post_likes insert" ON public.post_likes;
DROP POLICY IF EXISTS "Own post_likes delete" ON public.post_likes;
DROP POLICY IF EXISTS "Anyone can read post_comments" ON public.post_comments;
DROP POLICY IF EXISTS "Own post_comments insert" ON public.post_comments;
DROP POLICY IF EXISTS "Own post_comments delete" ON public.post_comments;

-- PART 3: Ensure tables have RLS enabled
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

-- PART 4: Recreate clean policies (exactly 3 per table)

-- Posts policies
CREATE POLICY "Anyone can read posts" ON public.posts 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own posts" ON public.posts 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own posts delete" ON public.posts 
  FOR DELETE USING (auth.uid() = user_id);

-- Post likes policies
CREATE POLICY "Anyone can read post_likes" ON public.post_likes 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own likes" ON public.post_likes 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.post_likes 
  FOR DELETE USING (auth.uid() = user_id);

-- Post comments policies
CREATE POLICY "Anyone can read post_comments" ON public.post_comments 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own comments" ON public.post_comments 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.post_comments 
  FOR DELETE USING (auth.uid() = user_id);

-- PART 5: Grant permissions to authenticated users
GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.post_likes TO authenticated;
GRANT ALL ON public.post_comments TO authenticated;
GRANT ALL ON public.post_votes TO authenticated;

-- PART 6: Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- PART 7: Verify everything

-- Check columns (should show 11)
SELECT 'posts columns' as check_type, COUNT(*) as count
FROM information_schema.columns WHERE table_name = 'posts'
UNION ALL
-- Check policies (should show 3)
SELECT 'posts policies', COUNT(*) 
FROM pg_policies WHERE tablename = 'posts'
UNION ALL
-- Check likes policies (should show 3)
SELECT 'post_likes policies', COUNT(*) 
FROM pg_policies WHERE tablename = 'post_likes'
UNION ALL
-- Check comments policies (should show 3)
SELECT 'post_comments policies', COUNT(*) 
FROM pg_policies WHERE tablename = 'post_comments'
UNION ALL
-- Check bucket exists (should show 1)
SELECT 'storage bucket', COUNT(*) 
FROM storage.buckets WHERE name = 'chat-media';

-- Expected results:
-- posts columns: 11
-- posts policies: 3
-- post_likes policies: 3
-- post_comments policies: 3
-- storage bucket: 1

-- PART 8: Show final policies
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('posts', 'post_likes', 'post_comments')
ORDER BY tablename, cmd;
