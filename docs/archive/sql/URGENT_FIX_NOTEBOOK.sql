-- ============================================
-- URGENT FIX: Notes Not Showing in Notebook
-- This fixes the database function to return
-- entries with NULL domain (standalone notes)
--
-- COPY THIS ENTIRE FILE and run in Supabase
-- ============================================

-- STEP 1: Drop the broken function
DROP FUNCTION IF EXISTS public.get_notebook_entries(UUID, TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER);

-- STEP 2: Create the FIXED function
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
    -- NULL-safe comparisons using IS NOT DISTINCT FROM
    AND (p_entry_type IS NULL OR ne.entry_type IS NOT DISTINCT FROM p_entry_type)
    AND (p_goal_id IS NULL OR ne.goal_id IS NOT DISTINCT FROM p_goal_id)
    AND (p_domain IS NULL OR ne.domain IS NOT DISTINCT FROM p_domain)
    AND (p_tag IS NULL OR ne.tags IS NULL OR p_tag = ANY(ne.tags))
    AND (p_search IS NULL OR ne.content ILIKE '%' || p_search || '%')
  ORDER BY ne.is_pinned DESC, ne.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Fix permissions
GRANT EXECUTE ON FUNCTION public.get_notebook_entries TO authenticated;

-- STEP 4: TEST - Run this query
-- You should see ALL your entries including "Journal entry"
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

-- STEP 5: TEST THE FUNCTION
-- This should return the same results
SELECT * FROM public.get_notebook_entries(
  'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1',
  NULL, NULL, NULL, NULL, NULL, 100, 0
);

-- ============================================
-- AFTER RUNNING:
-- 1. Refresh your notebook page
-- 2. Notes should now appear
-- 3. If not, share the results of STEP 4 & 5
-- ============================================
