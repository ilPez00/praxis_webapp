-- Migration: Fix Notebook Entries RLS and Visibility
-- Generated: 2026-03-17
-- Issue: Shared notebook entries not appearing in timeline

-- =============================================================================
-- 1. Ensure RLS policies are correct for notebook_entries
-- =============================================================================

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view own notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can insert own notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can update own notebook entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can delete own notebook entries" ON public.notebook_entries;

-- Recreate policies with proper checks
CREATE POLICY "Users can view own notebook entries" ON public.notebook_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notebook entries" ON public.notebook_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notebook entries" ON public.notebook_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notebook entries" ON public.notebook_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. Ensure grants are correct
-- =============================================================================

GRANT ALL ON public.notebook_entries TO authenticated;

-- =============================================================================
-- 3. Verify entry_type includes 'note'
-- =============================================================================

-- Check if there's a check constraint on entry_type and update it if needed
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notebook_entries_entry_type_check'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    -- Drop and recreate with 'note' included
    ALTER TABLE public.notebook_entries DROP CONSTRAINT IF EXISTS notebook_entries_entry_type_check;
    ALTER TABLE public.notebook_entries ADD CONSTRAINT notebook_entries_entry_type_check
      CHECK (entry_type IN (
        'note', 'tracker', 'goal_progress', 'post', 'event', 'message',
        'checkin', 'achievement', 'bet', 'match', 'verification', 'comment',
        'place', 'friendship', 'group', 'honor', 'axiom_brief'
      ));
  END IF;
END $$;

-- =============================================================================
-- 4. Create index for efficient filtering by entry_type
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_notebook_user_type ON public.notebook_entries(user_id, entry_type);

-- =============================================================================
-- End of Migration
-- =============================================================================
