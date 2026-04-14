-- ================================================================
-- DIAGNOSE THE ISSUE
-- Run these queries ONE AT A TIME to find what's causing the error
-- ================================================================

-- 1. Check if goal_trees exists as a VIEW (not table)
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'goal_trees';

-- 2. Check for any functions/triggers referencing goal_trees
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_definition LIKE '%goal_trees%'
  OR routine_definition LIKE '%userId%';

-- 3. Check all columns in profiles table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Try creating a SIMPLE table (not goal_trees)
DROP TABLE IF EXISTS public.test_table;
CREATE TABLE public.test_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- If this works, the issue is specific to goal_trees
SELECT 'test_table created successfully!' as result;

-- 5. Clean up test table
DROP TABLE IF EXISTS public.test_table;

-- ================================================================
-- Report back: which step fails?
-- ================================================================
