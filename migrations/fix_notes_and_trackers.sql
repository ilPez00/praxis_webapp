-- ============================================================================
-- COMPLETE FIX: Notes, Trackers, Journal Tables
-- Run this ENTIRE script in Supabase SQL Editor
-- This fixes all issues with posting notes and logging trackers
-- ============================================================================

-- PART 1: tracker_entries - Add user_id column
ALTER TABLE public.tracker_entries 
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.tracker_entries 
  DROP CONSTRAINT IF EXISTS tracker_entries_user_id_fkey;

ALTER TABLE public.tracker_entries 
  ADD CONSTRAINT tracker_entries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tracker_entries_user_id ON public.tracker_entries(user_id);

-- PART 2: journal_entries - Ensure it exists with correct structure
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id UUID,
  note TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON public.journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_node ON public.journal_entries(node_id);

-- PART 3: node_journal_entries - Ensure it exists (for goal-specific notes)
CREATE TABLE IF NOT EXISTS public.node_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL,
  note TEXT NOT NULL,
  mood TEXT,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_journal_entries_user_node ON public.node_journal_entries(user_id, node_id);
CREATE INDEX IF NOT EXISTS idx_node_journal_entries_logged_at ON public.node_journal_entries(logged_at DESC);

-- PART 4: Enable RLS on all tables
ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_journal_entries ENABLE ROW LEVEL SECURITY;

-- PART 5: Drop ALL old policies
DROP POLICY IF EXISTS "Users can view own tracker entries" ON public.tracker_entries;
DROP POLICY IF EXISTS "Users can insert own tracker entries" ON public.tracker_entries;
DROP POLICY IF EXISTS "Users can delete own tracker entries" ON public.tracker_entries;
DROP POLICY IF EXISTS "Users can view their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete their own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can view own node journal entries" ON public.node_journal_entries;
DROP POLICY IF EXISTS "Users can insert own node journal entries" ON public.node_journal_entries;
DROP POLICY IF EXISTS "Users can delete own node journal entries" ON public.node_journal_entries;

-- PART 6: Create clean policies

-- tracker_entries policies
CREATE POLICY "Users can view own tracker entries" ON public.tracker_entries 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tracker entries" ON public.tracker_entries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracker entries" ON public.tracker_entries 
  FOR DELETE USING (auth.uid() = user_id);

-- journal_entries policies
CREATE POLICY "Users can view their own journal entries" ON public.journal_entries 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own journal entries" ON public.journal_entries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own journal entries" ON public.journal_entries 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own journal entries" ON public.journal_entries 
  FOR DELETE USING (auth.uid() = user_id);

-- node_journal_entries policies
CREATE POLICY "Users can view own node journal entries" ON public.node_journal_entries 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own node journal entries" ON public.node_journal_entries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own node journal entries" ON public.node_journal_entries 
  FOR DELETE USING (auth.uid() = user_id);

-- PART 7: Grant permissions
GRANT ALL ON public.tracker_entries TO authenticated;
GRANT ALL ON public.journal_entries TO authenticated;
GRANT ALL ON public.node_journal_entries TO authenticated;

-- PART 8: Verify everything
SELECT 'tracker_entries columns' as check_type, COUNT(*) as count
FROM information_schema.columns WHERE table_name = 'tracker_entries'
UNION ALL
SELECT 'journal_entries columns', COUNT(*) 
FROM information_schema.columns WHERE table_name = 'journal_entries'
UNION ALL
SELECT 'node_journal_entries columns', COUNT(*) 
FROM information_schema.columns WHERE table_name = 'node_journal_entries'
UNION ALL
SELECT 'tracker_entries policies', COUNT(*) FROM pg_policies WHERE tablename = 'tracker_entries'
UNION ALL
SELECT 'journal_entries policies', COUNT(*) FROM pg_policies WHERE tablename = 'journal_entries'
UNION ALL
SELECT 'node_journal_entries policies', COUNT(*) FROM pg_policies WHERE tablename = 'node_journal_entries';

-- Expected:
-- tracker_entries columns: 5+ (id, user_id, tracker_id, data, logged_at)
-- journal_entries columns: 7+ (id, user_id, node_id, note, mood, created_at, updated_at)
-- node_journal_entries columns: 6+ (id, user_id, node_id, note, mood, logged_at, created_at)
-- Each table: 3 policies
