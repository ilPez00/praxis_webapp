-- ============================================
-- TEST: Check if API can fetch your notes
-- Run this to verify the function works
-- ============================================

-- Test 1: Direct query (should show ALL your entries)
SELECT 
  id,
  entry_type,
  title,
  domain,
  goal_id,
  source_table,
  occurred_at
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1' 
ORDER BY occurred_at DESC;

-- Test 2: Call the function (should return same results)
SELECT * FROM public.get_notebook_entries(
  'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1',
  NULL,  -- all entry types
  NULL,  -- all goals (including NULL)
  NULL,  -- all domains (including NULL) ← THIS IS THE KEY FIX
  NULL,  -- all tags
  NULL,  -- no search
  100,
  0
);

-- Test 3: Check if function handles NULL domain correctly
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN domain IS NULL THEN 1 END) as null_domain,
  COUNT(CASE WHEN domain IS NOT NULL THEN 1 END) as with_domain
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1';

-- ============================================
-- Share the results!
-- If Test 2 shows entries but notebook doesn't,
-- the issue is in the frontend/API layer
-- ============================================
