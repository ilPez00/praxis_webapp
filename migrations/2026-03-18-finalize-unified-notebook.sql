-- Migration: Finalize Unified Notebook
-- Reason: We are now writing directly to notebook_entries from the UI to avoid UUID constraints on "Free Notes".
-- This migration disables the triggers that previously mirrored entries from other tables to notebook_entries,
-- as mirroring is no longer the primary way to create notebook notes.

-- 1. Disable triggers for tables where we now write directly to notebook_entries
-- Note: We KEEP the triggers for 'posts', 'checkins', 'trackers', 'bets' as those are still mirrored.
-- We only disable mirroring for manual journal entries to avoid duplicates.

DROP TRIGGER IF EXISTS trig_notebook_journal ON public.journal_entries;
DROP TRIGGER IF EXISTS trig_notebook_node_journal ON public.node_journal_entries;

-- 2. Ensure notebook_entries has proper default for source_table if manual
ALTER TABLE public.notebook_entries ALTER COLUMN source_table SET DEFAULT 'manual_entry';
ALTER TABLE public.notebook_entries ALTER COLUMN source_id SET DEFAULT 'manual';

-- 3. Cleanup existing duplicates (optional but recommended)
-- Only if they have the exact same content and user_id and were created via trigger
DELETE FROM public.notebook_entries
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, content, occurred_at ORDER BY created_at) as row_num
        FROM public.notebook_entries
        WHERE source_table IN ('journal_entries', 'node_journal_entries')
    ) t
    WHERE row_num > 1
);
