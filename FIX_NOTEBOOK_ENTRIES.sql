-- ============================================
-- FIX: Notebook Entries Not Showing
-- Issue: Notes without goal_id don't appear
-- Solution: Fix function to handle NULL goal_id
-- 
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

-- STEP 1: Drop ALL existing versions of the function
-- ============================================
DROP FUNCTION IF EXISTS public.get_notebook_entries(UUID, TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_notebook_entries(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_notebook_entries(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);

-- STEP 2: Create the fixed function (source_id is TEXT, not UUID)
-- ============================================
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
  source_id TEXT,
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
    ne.source_id::TEXT,
    ne.occurred_at,
    ne.created_at,
    COALESCE(ne.is_pinned, false) as is_pinned
  FROM public.notebook_entries ne
  WHERE ne.user_id = p_user_id
    -- Fixed: properly handles NULL goal_id and domain
    AND (p_entry_type IS NULL OR ne.entry_type = p_entry_type)
    AND (p_goal_id IS NULL OR ne.goal_id = p_goal_id OR (p_goal_id IS NULL AND ne.goal_id IS NULL))
    AND (p_domain IS NULL OR ne.domain = p_domain OR (p_domain IS NULL AND ne.domain IS NULL))
    AND (p_tag IS NULL OR ne.tags IS NULL OR p_tag = ANY(ne.tags))
    AND (p_search IS NULL OR ne.content ILIKE '%' || p_search || '%')
  ORDER BY ne.is_pinned DESC, ne.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Fix RLS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can insert own notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can update own notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can delete own notebook entries" ON public.notebook_entries;

CREATE POLICY "Users can view own notebook entries" ON public.notebook_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notebook entries" ON public.notebook_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notebook entries" ON public.notebook_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notebook entries" ON public.notebook_entries
  FOR DELETE USING (auth.uid() = user_id);

-- STEP 4: Ensure grants are correct
-- ============================================
GRANT ALL ON public.notebook_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notebook_entries TO authenticated;

-- STEP 5: Create indexes for efficient filtering
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notebook_user_entry_type ON public.notebook_entries(user_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_notebook_user_occurred ON public.notebook_entries(user_id, occurred_at DESC);

-- STEP 6: Test queries
-- ============================================

-- Test 1: Count all entries for your user
SELECT 
  COUNT(*) as total_entries,
  entry_type,
  COUNT(CASE WHEN goal_id IS NULL THEN 1 END) as without_goal,
  COUNT(CASE WHEN goal_id IS NOT NULL THEN 1 END) as with_goal
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1' 
GROUP BY entry_type
ORDER BY total_entries DESC;

-- Test 2: Show recent entries (should include standalone notes)
SELECT 
  id,
  entry_type,
  title,
  goal_id,
  domain,
  occurred_at
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1' 
ORDER BY occurred_at DESC
LIMIT 10;

-- Test 3: Test the function directly
SELECT * FROM public.get_notebook_entries(
  'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1',  -- your user ID
  NULL,  -- entry_type (all)
  NULL,  -- goal_id (all, including NULL)
  NULL,  -- domain (all, including NULL)
  NULL,  -- tag
  NULL,  -- search
  100,   -- limit
  0      -- offset
);

-- ============================================
-- EXPECTED RESULT:
-- - All entries should appear, including those
--   with goal_id = NULL (standalone notes)
-- - Entries with goal_id should also appear
-- - No entries should be filtered out
-- ============================================
