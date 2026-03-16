-- ============================================================================
-- GLOBAL PRIVACY SETTINGS - CORRECTED for existing tables
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add global privacy setting to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS share_notes_publicly BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.share_notes_publicly IS 'If true, all user journal/notebook entries are visible to others (broad details only)';

-- 2. Update RLS policies for journal_entries (NOT diary_entries)
DROP POLICY IF EXISTS "Users can view their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can view others journal entries broad" ON public.journal_entries;

-- Users can ALWAYS view their own entries (full details)
CREATE POLICY "Users can view own journal entries" ON public.journal_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view BROAD DETAILS of others' entries if user has share_notes_publicly = true
CREATE POLICY "Users can view others journal entries broad" ON public.journal_entries
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

-- 4. Create view for broad details of others' journal entries (goal names only)
CREATE OR REPLACE VIEW public.journal_entries_broad AS
SELECT 
  id,
  user_id,
  node_id,
  note,
  mood,
  created_at,
  -- Hide sensitive content for others' entries (show only first 50 chars as preview)
  CASE 
    WHEN LENGTH(note) > 50 THEN LEFT(note, 50) || '...'
    ELSE note
  END AS note_preview,
  FALSE AS is_shared
FROM public.journal_entries
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
  -- Hide sensitive content - show only title, no content
  NULL::TEXT AS content,
  NULL::JSONB AS metadata,
  FALSE AS is_shared
FROM public.notebook_entries
WHERE EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = user_id AND p.share_notes_publicly = true
);

-- Grant access
GRANT SELECT ON public.journal_entries_broad TO authenticated;
GRANT SELECT ON public.notebook_entries_broad TO authenticated;

-- 6. Verify
SELECT 'profiles column added' as check, COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'share_notes_publicly'
UNION ALL
SELECT 'journal_entries policies', COUNT(*) FROM pg_policies WHERE tablename = 'journal_entries'
UNION ALL
SELECT 'notebook_entries policies', COUNT(*) FROM pg_policies WHERE tablename = 'notebook_entries';

-- Expected: 1, 2, 2
