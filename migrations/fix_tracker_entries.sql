-- ============================================================================
-- FIX: tracker_entries missing user_id column
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Check if user_id column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tracker_entries' 
  AND column_name = 'user_id';

-- 2. Add user_id if missing
ALTER TABLE public.tracker_entries 
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 3. Add foreign key constraint
ALTER TABLE public.tracker_entries 
  DROP CONSTRAINT IF EXISTS tracker_entries_user_id_fkey;

ALTER TABLE public.tracker_entries 
  ADD CONSTRAINT tracker_entries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Add index for performance
CREATE INDEX IF NOT EXISTS idx_tracker_entries_user_id 
  ON public.tracker_entries(user_id);

-- 5. Enable RLS
ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

-- 6. Drop old policies if exist
DROP POLICY IF EXISTS "Users can view own tracker entries" ON public.tracker_entries;
DROP POLICY IF EXISTS "Users can insert own tracker entries" ON public.tracker_entries;
DROP POLICY IF EXISTS "Users can delete own tracker entries" ON public.tracker_entries;

-- 7. Create new policies
CREATE POLICY "Users can view own tracker entries" ON public.tracker_entries 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracker entries" ON public.tracker_entries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracker entries" ON public.tracker_entries 
  FOR DELETE USING (auth.uid() = user_id);

-- 8. Grant permissions
GRANT ALL ON public.tracker_entries TO authenticated;

-- 9. Verify
SELECT 'tracker_entries columns' as check_type, COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'tracker_entries'
UNION ALL
SELECT 'tracker_entries policies', COUNT(*) 
FROM pg_policies 
WHERE tablename = 'tracker_entries';

-- Expected: columns ~5+, policies: 3
