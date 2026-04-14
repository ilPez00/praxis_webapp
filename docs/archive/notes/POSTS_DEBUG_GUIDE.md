# 🔧 POSTS 500 ERROR - COMPREHENSIVE DEBUGGING GUIDE

## Current Status

- ✅ Migration for `reference` column created
- ✅ Enhanced logging added to `createPost` endpoint
- ✅ Backend rebuilt and ready to deploy
- ⏳ **Waiting for Railway deployment and logs**

---

## Step 1: Deploy Updated Backend

The backend now has detailed logging that will show exactly where the error occurs.

```bash
cd /home/gio/Praxis/praxis_webapp
git add .
git commit -m "feat: add detailed logging to posts endpoint for debugging"
git push
```

Railway will auto-deploy on push.

---

## Step 2: Run Complete Fix SQL

Run this in Supabase SQL Editor:

```sql
-- File: migrations/fix_posts_complete.sql

-- 1. Ensure reference column exists
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reference JSONB;
CREATE INDEX IF NOT EXISTS idx_posts_reference ON public.posts USING GIN (reference);

-- 2. Drop and recreate RLS policies
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Own posts insert" ON public.posts;
DROP POLICY IF EXISTS "Own posts delete" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;

-- Allow anyone to read (public feed)
CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT USING (true);

-- Allow authenticated users to insert their own posts
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own posts
CREATE POLICY "Own posts delete" ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Ensure chat-media bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Grant permissions
GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.post_likes TO authenticated;
GRANT ALL ON public.post_comments TO authenticated;
GRANT ALL ON public.post_votes TO authenticated;
```

---

## Step 3: Check Railway Logs

After deploying and attempting a post:

1. Open **Railway Dashboard**
2. Select your backend project
3. Click **Deployments** → Latest deployment
4. Click **View Logs**
5. Look for `[createPost]` log entries

### Expected Log Output

**Success:**

```
[INFO] [createPost] Received request: { userId: "...", userName: "...", ... }
[INFO] [createPost] Validation passed, attempting insert...
[INFO] [createPost] Post created successfully: { postId: "..." }
```

**RLS Error:**

```
[ERROR] [createPost] Supabase insert failed: {
  "message": "new row violates row-level security policy for table \"posts\"",
  "code": "42P01"
}
```

**Missing Column:**

```
[ERROR] [createPost] Supabase insert failed: {
  "message": "column \"reference\" of relation \"posts\" does not exist",
  "code": "42703"
}
[ERROR] Posts table missing "reference" column
```

**Auth Error:**

```
[ERROR] [createPost] Supabase insert failed: {
  "message": "insert or update on table \"posts\" violates foreign key \"user_id\"",
  "code": "23503"
}
```

---

## Step 4: Debug Checklist

### A. Verify Database Schema

```sql
-- Run in Supabase SQL Editor
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'posts'
ORDER BY ordinal_position;
```

**Expected columns (11+):**

1. id (uuid)
2. user_id (uuid)
3. user_name (text)
4. user_avatar_url (text)
5. title (text)
6. content (text)
7. media_url (text)
8. media_type (text)
9. context (text)
10. reference (jsonb) ← **Must exist!**
11. created_at (timestamptz)

### B. Verify RLS Policies

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'posts';
```

**Expected policies (3):**

1. `Anyone can read posts` - SELECT - USING (true)
2. `Users can insert own posts` - INSERT - WITH CHECK (auth.uid() = user_id)
3. `Own posts delete` - DELETE - USING (auth.uid() = user_id)

### C. Verify Storage Bucket

```sql
SELECT name, public
FROM storage.buckets
WHERE name = 'chat-media';
```

**Expected:** 1 row with `public = true`

### D. Test Manual Insert

```sql
-- Test as authenticated user (replace with your user ID)
INSERT INTO public.posts (user_id, user_name, content, context)
VALUES (
  auth.uid(),  -- Uses current authenticated user
  'Test User',
  'Test post from SQL',
  'general'
);
```

If this fails, the issue is with RLS or permissions.

---

## Common Issues & Solutions

### Issue 1: RLS Policy Violation

**Error:**

```
"new row violates row-level security policy"
```

**Cause:** The `user_id` in the post doesn't match `auth.uid()`

**Solution:** Ensure frontend sends correct user ID from authenticated session

**Frontend fix (PostFeed.tsx):**

```typescript
// Make sure user is authenticated before posting
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  toast.error('Not authenticated');
  return;
}

// Send user.id from session, not from user object
body: JSON.stringify({
  userId: session.user.id,  // ← Use session user ID
  ...
})
```

### Issue 2: Foreign Key Violation

**Error:**

```
"insert or update on table \"posts\" violates foreign key \"user_id\""
```

**Cause:** The `user_id` doesn't exist in `auth.users`

**Solution:** User must be signed up via Supabase Auth first

**Check:**

```sql
SELECT id, email, created_at
FROM auth.users
WHERE id = 'YOUR_USER_ID';
```

### Issue 3: Missing Reference Column

**Error:**

```
"column \"reference\" does not exist"
```

**Solution:** Run the migration SQL (Step 2 above)

### Issue 4: Storage Upload Fails

**Error:**

```
"Storage bucket not found" or "Permission denied"
```

**Solution:** Ensure `chat-media` bucket exists and is public

```sql
-- Fix storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated uploads
CREATE POLICY "Users can upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'chat-media' AND auth.uid() = owner);
```

### Issue 5: Context Mismatch

**Error:** Post creates but appears in wrong feed

**Cause:** `context` value doesn't match what frontend expects

**Solution:** Ensure context matches:

- Dashboard: `context = 'general'`
- Coaching: `context = 'coaching'`
- Marketplace: `context = 'marketplace'`
- Groups/Boards: `context = roomId (UUID)`

---

## Step 5: Test Posting Flow

### Manual API Test

```bash
# Get auth token from browser console:
# await supabase.auth.getSession().then(s => s.session?.access_token)

TOKEN="YOUR_TOKEN_HERE"
USER_ID="YOUR_USER_ID"

curl -X POST https://web-production-646a4.up.railway.app/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "'$USER_ID'",
    "userName": "Test User",
    "content": "Test post from curl",
    "context": "general"
  }'
```

**Expected:** HTTP 201 with post JSON

**If 500:** Check Railway logs for detailed error

---

## Step 6: Frontend Debugging

### Check What's Being Sent

Open browser console and add logging:

```javascript
// In PostFeed.tsx, before fetch:
console.log("Posting with data:", {
  userId: user.id,
  userName: user.name,
  content: text,
  context,
  reference: postRef,
});
```

### Check Auth State

```javascript
// In browser console:
const { data } = await supabase.auth.getSession();
console.log("Session:", data.session);
console.log("User:", data.session?.user);
```

---

## Quick Fix Commands

### Reset Everything (Nuclear Option)

```sql
-- Drop and recreate posts table (DELETES ALL POSTS!)
DROP TABLE IF EXISTS public.post_votes CASCADE;
DROP TABLE IF EXISTS public.post_comments CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;

-- Recreate from setup.sql (run migrations/setup.sql section for posts)
-- OR run migrations/fix_posts_complete.sql
```

### Refresh RLS Policies

```sql
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
DROP POLICY IF EXISTS "Own posts delete" ON public.posts;

CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can insert own posts" ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own posts delete" ON public.posts FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Next Steps

1. ✅ **Deploy backend** (git push to trigger Railway deploy)
2. ✅ **Run fix SQL** in Supabase SQL Editor
3. ✅ **Wait 2-3 minutes** for deployment
4. ✅ **Check Railway logs** for `[createPost]` entries
5. ✅ **Test posting** from dashboard
6. ✅ **Share logs** if still failing

---

## Contact Info for Debugging

If still failing after all this, provide:

1. **Railway logs** (copy/paste from deployment)
2. **Browser console errors** (screenshot)
3. **Network tab** (request/response for failed POST)
4. **SQL debug output** (from Step 4 queries)

---

**The enhanced logging will tell us EXACTLY where it's failing!** 🎯
