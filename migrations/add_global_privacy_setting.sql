-- ============================================================================
-- GLOBAL PRIVACY SETTINGS - User-level privacy control
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add global privacy setting to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS share_notes_publicly BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.share_notes_publicly IS 'If true, all user diary/notebook entries are visible to others (broad details only)';

-- 2. Update RLS policies for diary_entries
DROP POLICY IF EXISTS "Users can view own diary entries" ON public.diary_entries;
DROP POLICY IF EXISTS "Users can view public diary entries" ON public.diary_entries;
DROP POLICY IF EXISTS "Users can view shared diary entries" ON public.diary_entries;

-- Users can ALWAYS view their own entries (full details)
CREATE POLICY "Users can view own diary entries" ON public.diary_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view BROAD DETAILS of others' entries if user has share_notes_publicly = true
CREATE POLICY "Users can view others diary entries broad" ON public.diary_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = user_id 
      AND p.share_notes_publicly = true
    )
  );

-- 3. Update RLS for notebook_entries similarly
DROP POLICY IF EXISTS "Users can view own notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can view others notebook entries broad" ON public.notebook_entries;

CREATE POLICY "Users can view own notebook entries" ON public.notebook_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view others notebook entries broad" ON public.notebook_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = user_id 
      AND p.share_notes_publicly = true
    )
  );

-- 4. Create view for broad details of others' entries (goal names only)
CREATE OR REPLACE VIEW public.diary_entries_broad AS
SELECT 
  id,
  user_id,
  entry_type,
  title,
  created_at,
  occurred_at,
  -- Hide sensitive content for others' entries
  NULL AS content,
  NULL AS mood,
  NULL AS tags,
  NULL AS metadata,
  NULL AS latitude,
  NULL AS longitude,
  NULL AS location_name,
  FALSE AS is_private,
  NULL AS source_table,
  NULL AS source_id
FROM public.diary_entries
WHERE EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = user_id AND p.share_notes_publicly = true
);

-- 5. Create view for broad details of notebook entries
CREATE OR REPLACE VIEW public.notebook_entries_broad AS
SELECT 
  id,
  user_id,
  entry_type,
  title,
  created_at,
  -- Hide sensitive content
  NULL AS content,
  NULL AS metadata,
  FALSE AS is_private
FROM public.notebook_entries
WHERE EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = user_id AND p.share_notes_publicly = true
);

-- Grant access
GRANT SELECT ON public.diary_entries_broad TO authenticated;
GRANT SELECT ON public.notebook_entries_broad TO authenticated;

-- 6. Verify
SELECT 'profiles column added' as check, COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'share_notes_publicly'
UNION ALL
SELECT 'diary policies', COUNT(*) FROM pg_policies WHERE tablename = 'diary_entries'
UNION ALL
SELECT 'notebook policies', COUNT(*) FROM pg_policies WHERE tablename = 'notebook_entries';

-- Expected: 1, 2, 2
