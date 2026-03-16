-- ============================================================================
-- NOTEBOOK ENHANCEMENTS: Attachments, Tags, and Forwarding
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add attachments array to notebook_entries
ALTER TABLE public.notebook_entries 
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.notebook_entries.attachments IS 'Array of {url, type, name} objects for attached files';

-- 2. Add tags array for user mentions and entity links
ALTER TABLE public.notebook_entries 
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.notebook_entries.tags IS 'Array of tagged entities: {type: "user"|"event"|"place", id, name}';

-- 3. Add source_reference for forwarded content
ALTER TABLE public.notebook_entries 
  ADD COLUMN IF NOT EXISTS source_reference JSONB DEFAULT NULL::jsonb;

COMMENT ON COLUMN public.notebook_entries.source_reference IS 'Reference to original content if forwarded: {type, id, original_user_id, forwarded_at}';

-- 4. Create index for tagged entries
CREATE INDEX IF NOT EXISTS idx_notebook_entries_tags 
  ON public.notebook_entries USING GIN (tags);

-- 5. Create index for attachments
CREATE INDEX IF NOT EXISTS idx_notebook_entries_attachments 
  ON public.notebook_entries USING GIN (attachments);

-- 6. Update RLS policies to allow updates
DROP POLICY IF EXISTS "Users can update own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can update own notebook entries" ON public.notebook_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Verify
SELECT 'notebook_entries columns' as check_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'notebook_entries' 
  AND column_name IN ('attachments', 'tags', 'source_reference');

-- Expected: 3
