-- ============================================================================
-- GLOBAL PRIVACY SETTINGS - FINAL VERSION (drops all existing policies first)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add global privacy setting to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS share_notes_publicly BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.share_notes_publicly IS 'If true, all user journal/notebook entries are visible to others (broad details only)';

-- 2. Drop ALL existing policies on journal_entries first
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'journal_entries'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.journal_entries', pol.policyname);
    END LOOP;
END $$;

-- 3. Drop ALL existing policies on notebook_entries
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'notebook_entries'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notebook_entries', pol.policyname);
    END LOOP;
END $$;

-- Verify policies dropped
SELECT 'journal_entries policies dropped' as status, COUNT(*) as remaining 
FROM pg_policies WHERE tablename = 'journal_entries'
UNION ALL
SELECT 'notebook_entries policies dropped', COUNT(*) 
FROM pg_policies WHERE tablename = 'notebook_entries';
-- Should return 0, 0

-- 4. Create NEW policies for journal_entries
CREATE POLICY "users_view_own_journal" ON public.journal_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_view_others_journal_broad" ON public.journal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = user_id AND p.share_notes_publicly = true
    )
  );

-- 5. Create NEW policies for notebook_entries
CREATE POLICY "users_view_own_notebook" ON public.notebook_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_view_others_notebook_broad" ON public.notebook_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = user_id AND p.share_notes_publicly = true
    )
  );

-- 6. Create views for broad details
CREATE OR REPLACE VIEW public.journal_entries_broad AS
SELECT id, user_id, node_id, created_at,
  CASE WHEN LENGTH(note) > 50 THEN LEFT(note, 50) || '...' ELSE note END AS note_preview
FROM public.journal_entries
WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.share_notes_publicly = true);

CREATE OR REPLACE VIEW public.notebook_entries_broad AS
SELECT id, user_id, entry_type, title, created_at,
  NULL::TEXT AS content, NULL::JSONB AS metadata
FROM public.notebook_entries
WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.share_notes_publicly = true);

-- 7. Grant access
GRANT SELECT ON public.journal_entries_broad TO authenticated;
GRANT SELECT ON public.notebook_entries_broad TO authenticated;

-- 8. Final verification
SELECT 'journal_entries policies' as check_type, COUNT(*) as count 
FROM pg_policies WHERE tablename = 'journal_entries'
UNION ALL
SELECT 'notebook_entries policies', COUNT(*) 
FROM pg_policies WHERE tablename = 'notebook_entries'
UNION ALL
SELECT 'profiles column', COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'share_notes_publicly';

-- Expected: 2, 2, 1
