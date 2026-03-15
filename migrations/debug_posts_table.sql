-- ============================================================================
-- POSTS TABLE DEBUGGING SCRIPT
-- Run this in Supabase SQL Editor to diagnose the 500 error
-- ============================================================================

-- 1. Check if posts table exists and has all columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'posts'
ORDER BY ordinal_position;

-- 2. Check RLS policies on posts table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'posts';

-- 3. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'posts';

-- 4. Test INSERT as anonymous (will fail if RLS blocking)
-- Uncomment to test:
-- INSERT INTO public.posts (user_id, user_name, content)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'Test', 'Test content');

-- 5. Check chat-media bucket exists (for media uploads)
SELECT name, public 
FROM storage.buckets 
WHERE name = 'chat-media';

-- 6. Check if there are any recent errors in logs
-- (This requires privileged access)
-- SELECT * FROM audit_logs WHERE table_name = 'posts' ORDER BY created_at DESC LIMIT 10;

-- 7. Verify reference column specifically
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns
WHERE table_name = 'posts' 
  AND column_name = 'reference';

-- Expected output:
-- column_name | data_type | udt_name
-- reference   | jsonb     | jsonb

-- 8. Check table grants
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'posts';

-- 9. Count posts by context (verify data exists)
SELECT context, COUNT(*) as post_count
FROM public.posts
GROUP BY context;

-- 10. Check for any triggers on posts table
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'posts';
