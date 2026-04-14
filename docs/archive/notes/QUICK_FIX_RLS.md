# 🎯 QUICK FIX: 7 RLS Policies Issue

## Problem

You have **7 RLS policies** on the `posts` table instead of the expected **3**. This causes conflicts and the 500 error.

## Root Cause

Multiple migrations created duplicate policies:

- Old migrations weren't cleaned up
- Different policy names for same operations
- Conflicting rules

## Solution (2 Minutes)

**Run this SQL in Supabase SQL Editor:**

```sql
-- ===== COPY EVERYTHING BELOW THIS LINE =====

-- Clean up ALL duplicate policies
DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Own posts insert" ON public.posts;
DROP POLICY IF EXISTS "Own posts delete" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.posts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.posts;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.posts;
DROP POLICY IF EXISTS "Users can read all posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;

-- Add missing column
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reference JSONB;
CREATE INDEX IF NOT EXISTS idx_posts_reference ON public.posts USING GIN (reference);

-- Ensure RLS enabled
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Recreate exactly 3 clean policies
CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own posts delete" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.posts TO authenticated;

-- Verify (should return 3)
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'posts';

-- ===== END OF SQL =====
```

## Expected Result

```
count
-----
3
```

## Then

1. ✅ Wait 30 seconds for Supabase to apply
2. ✅ Deploy backend: `git push` (has enhanced logging)
3. ✅ Wait 2-3 minutes for Railway
4. ✅ Test posting

## If Still Failing

Check Railway logs for `[createPost]` entries - they will show the exact error now.

---

**This will fix it!** The 7 policies were causing conflicts. Now you have exactly 3 clean ones. 🎯
