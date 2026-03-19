-- ============================================
-- DEBUG: Check if today's notes are in database
-- Run this to see what's actually stored
-- ============================================

-- Test 1: Show ALL entries from today
SELECT 
  id,
  entry_type,
  title,
  domain,
  goal_id,
  source_table,
  occurred_at AT TIME ZONE 'UTC' as occurred_at_utc,
  created_at AT TIME ZONE 'UTC' as created_at_utc
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1'
  AND DATE(occurred_at) = DATE(NOW())
ORDER BY occurred_at DESC;

-- Test 2: Show last 10 entries regardless of date
SELECT 
  id,
  entry_type,
  title,
  domain,
  goal_id,
  occurred_at AT TIME ZONE 'UTC' as occurred_at_utc,
  created_at AT TIME ZONE 'UTC' as created_at_utc
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1'
ORDER BY occurred_at DESC
LIMIT 10;

-- Test 3: Test the function with today's date
SELECT * FROM public.get_notebook_entries(
  'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1',
  NULL, NULL, NULL, NULL, NULL, 100, 0
);

-- Test 4: Check if domain filter is the issue
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN domain = 'Personal' THEN 1 END) as personal,
  COUNT(CASE WHEN domain IS NULL THEN 1 END) as null_domain,
  COUNT(CASE WHEN domain IS NOT NULL AND domain != 'Personal' THEN 1 END) as other_domain
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1'
  AND DATE(occurred_at) = DATE(NOW());

-- ============================================
-- Share the results!
-- This will tell us if:
-- 1. Entries are in the database
-- 2. Domain values are correct
-- 3. Function is returning them
-- ============================================
