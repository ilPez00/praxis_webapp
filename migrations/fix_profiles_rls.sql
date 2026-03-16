-- ============================================================================
-- FIX: Profiles RLS Policy for Onboarding
-- This fixes the "new row violates policy" error during onboarding
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Check current policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 2. Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create clean, permissive policies

-- SELECT: Users can view ALL profiles (for matching, feed, etc.)
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT
  USING (true);

-- INSERT: Users can create their own profile (auth.uid() matches user_id)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: Users can delete their own profile (rare but needed)
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- 5. Grant permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- 6. Verify policies (should show 4)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd;

-- Expected:
-- policyname                          | cmd
-- ------------------------------------|--------
-- Users can delete own profile        | DELETE
-- Users can insert own profile        | INSERT
-- Users can update own profile        | UPDATE
-- Users can view all profiles         | SELECT

-- 7. Test update (should work now)
-- UPDATE public.profiles SET onboarding_completed = true WHERE id = auth.uid();
