-- ============================================
-- FINAL FIX: Notebook Entries Not Showing
-- Issue: Function filters out NULL domains incorrectly
-- Solution: Use IS NOT DISTINCT FROM for NULL-safe comparison
-- 
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

-- STEP 1: Drop ALL existing versions
-- ============================================
DROP FUNCTION IF EXISTS public.get_notebook_entries(UUID, TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_notebook_entries(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_notebook_entries(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);

-- STEP 2: Create fixed function with NULL-safe comparisons
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
    -- Use IS NOT DISTINCT FROM for NULL-safe comparison
    AND (p_entry_type IS NULL OR ne.entry_type IS NOT DISTINCT FROM p_entry_type)
    AND (p_goal_id IS NULL OR ne.goal_id IS NOT DISTINCT FROM p_goal_id)
    AND (p_domain IS NULL OR ne.domain IS NOT DISTINCT FROM p_domain)
    AND (p_tag IS NULL OR ne.tags IS NULL OR p_tag = ANY(ne.tags))
    AND (p_search IS NULL OR ne.content ILIKE '%' || p_search || '%')
  ORDER BY ne.is_pinned DESC, ne.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Fix RLS policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can view own notebook entries" ON public.notebook_entries
  FOR SELECT USING (auth.uid() = user_id);

-- STEP 4: Ensure grants
-- ============================================
GRANT ALL ON public.notebook_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notebook_entries TO authenticated;

-- STEP 5: Test - should now show ALL entries including those with NULL domain
-- ============================================
SELECT 
  id,
  entry_type,
  title,
  domain,
  goal_id,
  occurred_at
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1' 
ORDER BY occurred_at DESC
LIMIT 10;

-- Test the function
SELECT * FROM public.get_notebook_entries(
  'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1',
  NULL, NULL, NULL, NULL, NULL, 100, 0
);

-- ============================================
-- EXPECTED: All entries now appear, including
-- those with domain = NULL
-- ============================================
