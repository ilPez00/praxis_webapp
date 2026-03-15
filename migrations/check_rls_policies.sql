-- ============================================================================
-- CLEANUP RLS POLICIES ON POSTS TABLE
-- Run this FIRST to see what policies exist
-- ============================================================================

-- 1. List ALL policies on posts table
SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'posts'
ORDER BY cmd, policyname;

-- 2. Count policies by command type
SELECT 
  cmd,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'posts'
GROUP BY cmd;

-- Expected clean state:
-- SELECT: 1 policy
-- INSERT: 1 policy  
-- DELETE: 1 policy
-- Total: 3 policies
