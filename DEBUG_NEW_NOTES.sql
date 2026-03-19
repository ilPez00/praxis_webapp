-- ============================================
-- DEBUG: Why aren't new free notes showing?
-- Check if notes are being saved correctly
-- ============================================

-- Test 1: Check the MOST RECENT entries
SELECT 
  id,
  entry_type,
  title,
  domain,
  goal_id,
  source_table,
  occurred_at AT TIME ZONE 'UTC' as occurred_at,
  created_at AT TIME ZONE 'UTC' as created_at
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1'
ORDER BY occurred_at DESC
LIMIT 20;

-- Test 2: Check specifically for 'Personal' domain entries
SELECT 
  id,
  entry_type,
  title,
  domain,
  occurred_at AT TIME ZONE 'UTC' as occurred_at
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1'
  AND domain = 'Personal'
ORDER BY occurred_at DESC
LIMIT 10;

-- Test 3: Check if there are entries AFTER the Axiom message
SELECT 
  id,
  entry_type,
  title,
  domain,
  occurred_at AT TIME ZONE 'UTC' as occurred_at
FROM notebook_entries 
WHERE user_id = 'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1'
  AND occurred_at > '2026-03-18 00:01:55.989+00'  -- After the Axiom brief
ORDER BY occurred_at DESC;

-- Test 4: Check what domain filter the frontend might be using
-- (This simulates what the API receives)
SELECT * FROM public.get_notebook_entries(
  'af2138c5-d0db-4de4-8e2d-3fd3dbed67b1',
  NULL,  -- all types
  NULL,  -- all goals
  NULL,  -- all domains (including Personal)
  NULL,  -- all tags
  NULL,  -- no search
  20,
  0
);

-- ============================================
-- Share results of Test 1 and Test 3
-- This will show if new notes exist and their timestamps
-- ============================================
