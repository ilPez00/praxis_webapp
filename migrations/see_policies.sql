-- ============================================================================
-- SEE EXACT POLICY NAMES - Run this first!
-- ============================================================================

SELECT 
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'posts'
ORDER BY cmd, policyname;

-- Copy the output and share the 5 policy names
