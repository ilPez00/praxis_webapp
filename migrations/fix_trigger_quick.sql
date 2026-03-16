-- ============================================================================
-- QUICK FIX: Drop problematic notebook trigger
-- This is causing 500 errors on journal_entries inserts
-- Run this in Supabase SQL Editor NOW
-- ============================================================================

-- Drop the trigger that's causing the error
DROP TRIGGER IF EXISTS tr_notebook_entry_on_journal ON public.journal_entries;
DROP TRIGGER IF EXISTS tr_notebook_entry_on_tracker ON public.tracker_entries;

-- Also drop the function if it exists
DROP FUNCTION IF EXISTS create_notebook_entry() CASCADE;

-- Verify triggers are gone
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%notebook%';

-- Should return 0 rows or only valid triggers

-- Test insert now
INSERT INTO public.journal_entries (user_id, note)
VALUES ('af2138c5-d0db-4de4-8e2d-3fd3dbed67b1', 'Test after trigger fix');

-- Should work now!
