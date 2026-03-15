-- ============================================================================
-- FIX: Clean up duplicate RLS policies on posts table
-- Run this in Supabase SQL Editor to fix the 7 policies issue
-- ============================================================================

-- 1. First, see what we have
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'posts';

-- 2. Drop ALL policies on posts table (we'll recreate clean ones)
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

-- Also drop from related tables if they have duplicates
DROP POLICY IF EXISTS "Anyone can read post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "Own post_likes insert" ON public.post_likes;
DROP POLICY IF EXISTS "Own post_likes delete" ON public.post_likes;
DROP POLICY IF EXISTS "Users can read own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can create own likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.post_likes;

DROP POLICY IF EXISTS "Anyone can read post_comments" ON public.post_comments;
DROP POLICY IF EXISTS "Own post_comments insert" ON public.post_comments;
DROP POLICY IF EXISTS "Own post_comments delete" ON public.post_comments;
DROP POLICY IF EXISTS "Users can read all comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.post_comments;

-- 3. Recreate clean policies for posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- SELECT: Anyone can read (public feed)
CREATE POLICY "Anyone can read posts" ON public.posts 
  FOR SELECT 
  USING (true);

-- INSERT: Authenticated users can create their own posts
CREATE POLICY "Users can insert own posts" ON public.posts 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own posts
CREATE POLICY "Own posts delete" ON public.posts 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 4. Recreate clean policies for post_likes
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read post_likes" ON public.post_likes 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert own likes" ON public.post_likes 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.post_likes 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 5. Recreate clean policies for post_comments
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read post_comments" ON public.post_comments 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert own comments" ON public.post_comments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.post_comments 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 6. Grant permissions
GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.post_likes TO authenticated;
GRANT ALL ON public.post_comments TO authenticated;
GRANT ALL ON public.post_votes TO authenticated;

-- 7. Verify - should show exactly 3 policies for posts
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'posts'
ORDER BY cmd;

-- Expected output:
-- policyname                    | cmd    | roles
-- ------------------------------|--------|-------------
-- Anyone can read posts         | SELECT | public
-- Users can insert own posts    | INSERT | public
-- Own posts delete              | DELETE | public

-- 8. Final count
SELECT COUNT(*) as policy_count 
FROM pg_policies 
WHERE tablename = 'posts';

-- Should return: 3
