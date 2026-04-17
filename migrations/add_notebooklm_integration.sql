-- ============================================================================
-- NOTEBOOKLM INTEGRATION — user tokens storage
-- Users connect their NotebookLM account by storing Google auth cookies
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add notebooklm_tokens column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notebooklm_tokens JSONB;

COMMENT ON COLUMN public.profiles.notebooklm_tokens IS 'NotebookLM auth cookies: {cookies: {"SNlM0e": "...", "FdrFJe": "..."}, stored: timestamp}';

-- Add notebook_ids column to track which notebooks to query
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notebooklm_notebook_ids TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.notebooklm_notebook_ids IS 'Array of NotebookLM notebook IDs to query during midnight scan';

-- Add notebooklm_enabled toggle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notebooklm_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.notebooklm_enabled IS 'Whether to query NotebookLM during midnight scan';

-- Verify
SELECT
  'columns added' as check_type,
  COUNT(*) as result
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('notebooklm_tokens', 'notebooklm_notebook_ids', 'notebooklm_enabled');
