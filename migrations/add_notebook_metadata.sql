-- Add metadata JSONB column to notebook_entries for replies, sharing context, etc.
-- Also relax the entry_type CHECK to allow axiom_brief and other new types

-- Add metadata column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'notebook_entries'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.notebook_entries ADD COLUMN metadata JSONB DEFAULT NULL;
  END IF;
END $$;

-- Drop old restrictive CHECK constraint on entry_type (if it exists)
DO $$
BEGIN
  ALTER TABLE public.notebook_entries DROP CONSTRAINT IF EXISTS notebook_entries_entry_type_check;
EXCEPTION WHEN undefined_object THEN
  NULL; -- constraint doesn't exist, that's fine
END $$;

-- Add a more permissive CHECK that includes axiom_brief and future types
ALTER TABLE public.notebook_entries
  ADD CONSTRAINT notebook_entries_entry_type_check
  CHECK (entry_type IN (
    'note', 'tracker', 'goal_progress', 'post', 'event',
    'message', 'checkin', 'achievement', 'bet', 'match',
    'verification', 'comment', 'axiom_brief', 'reply',
    'place', 'user'
  ));

-- Index for fast reply lookups
CREATE INDEX IF NOT EXISTS idx_notebook_metadata_reply
  ON public.notebook_entries USING GIN (metadata)
  WHERE metadata IS NOT NULL;

SELECT 'Notebook metadata migration completed!' AS status;
