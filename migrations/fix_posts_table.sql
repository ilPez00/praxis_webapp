-- ============================================================================
-- POSTS TABLE FIXES
-- Run this on Supabase SQL Editor to fix missing columns
-- ============================================================================

-- 1. Add missing 'reference' column to posts table
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS reference JSONB;

-- 2. Add index for reference column
CREATE INDEX IF NOT EXISTS idx_posts_reference 
  ON public.posts USING GIN (reference);

-- 3. Add comment
COMMENT ON COLUMN public.posts.reference IS 'Linked reference data (goal, service, post, etc.) in JSONB format';

-- 4. Verify the column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posts' 
  AND column_name = 'reference';

--5. Test insert (should work now)
 DO $$
 BEGIN
   INSERT INTO public.posts (user_id, user_name, content, reference)
   VALUES ('00000000-0000-0000-0000-000000000001', 'Test', 'Test content', '{"type": "goal"}'::jsonb);
 EXCEPTION
   WHEN OTHERS THEN
     RAISE NOTICE 'Test insert failed (expected if test user doesn''t exist): %', SQLERRM;
 END $$;
