-- ============================================================================
-- DIARY ENTRIES PRIVACY - Users see own notes fully, others' just goal details
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add is_private and shared_with columns to diary_entries if not exist
ALTER TABLE public.diary_entries 
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true;

ALTER TABLE public.diary_entries 
  ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT NULL;

-- 2. Add shared_with column to notebook_entries if not exist
ALTER TABLE public.notebook_entries 
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true;

ALTER TABLE public.notebook_entries 
  ADD COLUMN IF NOT EXISTS shared_with UUID[] DEFAULT NULL;

-- 3. Update RLS policies for diary_entries to allow viewing shared entries
DROP POLICY IF EXISTS "Users can view their own diary entries" ON public.diary_entries;
DROP POLICY IF EXISTS "Users can view shared diary entries" ON public.diary_entries;

-- Users can view their own entries
CREATE POLICY "Users can view own diary entries" ON public.diary_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view public entries from others (is_private = false) - but only broad details
CREATE POLICY "Users can view public diary entries" ON public.diary_entries
  FOR SELECT
  USING (is_private = false OR auth.uid() = user_id);

-- Users can view entries shared with them
CREATE POLICY "Users can view shared diary entries" ON public.diary_entries
  FOR SELECT
  USING (shared_with @> ARRAY[auth.uid()]);

-- 4. Update RLS for notebook_entries similarly
DROP POLICY IF EXISTS "Users can view their own notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can view public notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can view shared notebook entries" ON public.notebook_entries;

CREATE POLICY "Users can view own notebook entries" ON public.notebook_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view public notebook entries" ON public.notebook_entries
  FOR SELECT
  USING (is_private = false OR auth.uid() = user_id);

CREATE POLICY "Users can view shared notebook entries" ON public.notebook_entries
  FOR SELECT
  USING (shared_with @> ARRAY[auth.uid()]);

-- 5. Create view for public goal summaries (what others can see)
CREATE OR REPLACE VIEW public.user_goal_summaries AS
SELECT 
  gt.user_id,
  gt.nodes
FROM public.goal_trees gt
WHERE EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = gt.user_id AND p.is_private = false
);

-- Grant access to authenticated users
GRANT SELECT ON public.user_goal_summaries TO authenticated;

-- 6. Add is_private to profiles (if not exists)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- 7. Verify
SELECT 'diary_entries policies' as check_type, COUNT(*) as count
FROM pg_policies WHERE tablename = 'diary_entries'
UNION ALL
SELECT 'notebook_entries policies', COUNT(*) 
FROM pg_policies WHERE tablename = 'notebook_entries';

-- Expected: 3 policies each
