-- ============================================
-- DEBUG: Check what's in your notebook_entries
-- Run this FIRST to see what's actually stored
-- ============================================

-- 1. Check if entries exist for your user
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN entry_type = 'note' THEN 1 END) as notes,
  COUNT(CASE WHEN goal_id IS NULL THEN 1 END) as without_goal,
  COUNT(CASE WHEN goal_id IS NOT NULL THEN 1 END) as with_goal,
  COUNT(CASE WHEN domain IS NULL THEN 1 END) as without_domain,
  COUNT(CASE WHEN domain IS NOT NULL THEN 1 END) as with_domain
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1';

-- 2. Show ALL entries with their domain and goal_id values
SELECT 
  id,
  entry_type,
  title,
  content,
  domain,
  goal_id,
  source_table,
  source_id,
  is_private,
  occurred_at
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1' 
ORDER BY occurred_at DESC
LIMIT 20;

-- 3. Test the function with NULL domain filter
SELECT * FROM public.get_notebook_entries(
  'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1',
  NULL,  -- entry_type (all)
  NULL,  -- goal_id (all including NULL)
  NULL,  -- domain (all including NULL)
  NULL,  -- tag
  NULL,  -- search
  100,
  0
);

-- 4. Check what domain values exist
SELECT DISTINCT domain FROM notebook_entries WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1';

-- 5. Check specifically for 'note' entry_type
SELECT 
  id,
  title,
  domain,
  goal_id,
  occurred_at
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1' 
  AND entry_type = 'note'
ORDER BY occurred_at DESC
LIMIT 10;

-- ============================================
-- Share the results of queries 1, 2, and 5
-- This will help identify the exact issue
-- ============================================
