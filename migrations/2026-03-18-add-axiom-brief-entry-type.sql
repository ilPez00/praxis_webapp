-- Migration: Add axiom_brief to notebook_entries entry_type
-- Date: 2026-03-18
-- Description: Add 'axiom_brief' as a valid entry type to support automatic storage of Axiom daily briefs in the notebook

-- =============================================================================
-- 1. Update notebook_entries check constraint to include axiom_brief
-- =============================================================================

-- First, drop the old constraint
ALTER TABLE public.notebook_entries DROP CONSTRAINT IF EXISTS notebook_entries_entry_type_check;

-- Update any existing 'axiom_brief' entries that might have been set to 'note' as default
-- (This is a safety measure in case the constraint was already applied and blocked inserts)
UPDATE public.notebook_entries
SET entry_type = 'axiom_brief'
WHERE entry_type = 'note'
  AND metadata->>'source' = 'axiom_auto_brief'
  AND title LIKE '%Axiom Daily Brief%';

-- Now add the new constraint with axiom_brief included
ALTER TABLE public.notebook_entries ADD CONSTRAINT notebook_entries_entry_type_check
  CHECK (entry_type IN (
    'note', 'tracker', 'goal_progress', 'post', 'event', 'message',
    'checkin', 'achievement', 'bet', 'match', 'verification', 'comment',
    'place', 'friendship', 'group', 'honor', 'axiom_brief'
  ));

-- =============================================================================
-- 2. Ensure proper indexing for axiom_brief queries
-- =============================================================================

-- Create index for efficient filtering by entry_type (if not exists)
CREATE INDEX IF NOT EXISTS idx_notebook_entries_entry_type 
  ON public.notebook_entries(entry_type);

-- Create composite index for user-specific axiom_brief queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_notebook_entries_user_axiom 
  ON public.notebook_entries(user_id, entry_type, occurred_at DESC)
  WHERE entry_type = 'axiom_brief';

-- =============================================================================
-- 3. Update RLS policies if needed (should already be covered by existing policies)
-- =============================================================================

-- Verify that users can read and insert their own axiom_brief entries
-- These should already exist from the base notebook_entries policies
DROP POLICY IF EXISTS "Users can read own entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can insert own entries" ON public.notebook_entries;

CREATE POLICY "Users can read own entries" ON public.notebook_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" ON public.notebook_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- End of Migration
-- =============================================================================
