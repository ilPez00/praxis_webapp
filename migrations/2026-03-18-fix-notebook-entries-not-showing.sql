-- ============================================
-- FIX: Notebook Entries Not Showing
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Update the get_notebook_entries function to ensure it returns ALL entry types
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
  source_id UUID,
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
    ne.source_id,
    ne.occurred_at,
    ne.created_at,
    COALESCE(ne.is_pinned, false) as is_pinned
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

-- 2. Fix RLS policies to ensure users can see their own entries
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

-- 3. Ensure grants are correct
GRANT ALL ON public.notebook_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notebook_entries TO authenticated;

-- 4. Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_notebook_user_entry_type ON public.notebook_entries(user_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_notebook_user_occurred ON public.notebook_entries(user_id, occurred_at DESC);

-- ============================================
-- Test: Verify entries exist
-- Run this after the fix to check:
-- SELECT COUNT(*) FROM notebook_entries WHERE user_id = 'YOUR-USER-ID';
-- ============================================
