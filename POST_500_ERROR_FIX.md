# 🔧 Posts 500 Error - FIX DOCUMENT

## Problem

Posting to dashboard or groups/boards returns **HTTP 500 Internal Server Error**.

```
XHRPOST https://web-production-646a4.up.railway.app/api/posts
[HTTP/2 500  461ms]

Post submit error: Error: An internal server error occurred.
```

---

## Root Cause

The `posts` table is missing the `reference` column that the backend code tries to insert.

**Error location:**
- File: `src/controllers/postController.ts`
- Function: `createPost()`
- Line: Tries to insert `reference: reference ?? null`

**Database schema mismatch:**
- Code expects: `reference` column (JSONB)
- Database has: NO `reference` column

---

## Solution

### Step 1: Run Database Migration

**Option A: Quick Fix (Recommended)**
```sql
-- Copy this to Supabase SQL Editor and run
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reference JSONB;
CREATE INDEX IF NOT EXISTS idx_posts_reference ON public.posts USING GIN (reference);
COMMENT ON COLUMN public.posts.reference IS 'Linked reference data (goal, service, post, etc.) in JSONB format';
```

**Option B: Run Migration File**
```bash
# File: migrations/fix_posts_table.sql
# Copy contents and run in Supabase SQL Editor
```

### Step 2: Verify Fix

```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posts' 
  AND column_name = 'reference';

-- Should return:
-- column_name | data_type
-- reference   | jsonb
```

### Step 3: Test Posting

1. Open dashboard
2. Try creating a post
3. Should succeed with 201 Created

---

## Files Changed

### Backend (Improved Error Logging)

**src/controllers/postController.ts**
```typescript
const handleSupabaseError = (error: any) => {
  logger.error('Supabase error (posts):', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
  
  // Check for specific errors
  if (error.message?.includes('reference')) {
    logger.error('Posts table missing "reference" column - run migrations/fix_posts_table.sql');
  }
  
  throw new InternalServerError(error.message || 'Internal server error during Supabase operation.');
};
```

### Migration Files Created

1. **migrations/add_reference_to_posts.sql**
   - Adds `reference` JSONB column
   - Creates GIN index for fast queries
   - Adds column comment

2. **migrations/fix_posts_table.sql**
   - Comprehensive fix script
   - Includes verification query
   - Test insert (commented out)

---

## Why This Happened

The codebase evolved to include a `reference` field for linking posts to:
- Goals
- Services
- Other posts
- External resources

However, the database migration wasn't run in production (Railway), causing a schema mismatch.

---

## Prevention

### For Future Schema Changes

1. **Always create migration file** in `migrations/` folder
2. **Run migration immediately** in Supabase SQL Editor
3. **Verify column exists** before deploying code
4. **Update setup.sql** to include new columns for fresh installs

### Migration Checklist

- [ ] Create `migrations/descriptive_name.sql`
- [ ] Add `ADD COLUMN IF NOT EXISTS` (idempotent)
- [ ] Add indexes if needed
- [ ] Add column comments
- [ ] Run in Supabase SQL Editor
- [ ] Verify with SELECT query
- [ ] Update `setup.sql` for future fresh installs
- [ ] Deploy backend code

---

## Additional Issues to Check

### Other Missing Columns

Check if these columns exist:

```sql
-- Check for all expected posts columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'posts'
ORDER BY ordinal_position;

-- Expected columns:
-- id, user_id, user_name, user_avatar_url, title, content,
-- media_url, media_type, context, reference, created_at
```

### Related Tables

Verify these tables also exist:

```sql
-- post_likes (for likes)
-- post_comments (for comments)
-- post_votes (for upvote/downvote system)
```

If any are missing, run `migrations/setup.sql`.

---

## Deployment Steps

### 1. Apply Database Fix

```
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste migration SQL
4. Run
5. Verify success
```

### 2. Deploy Backend (Optional - for better logging)

```bash
cd /home/gio/Praxis/praxis_webapp
npm run build
# Railway auto-deploys on git push
```

### 3. Test

```
1. Open https://praxis-webapp.vercel.app
2. Navigate to Dashboard
3. Create a test post
4. Verify it appears in feed
```

---

## Error Messages Explained

### Before Fix
```
HTTP 500 Internal Server Error
"An internal server error occurred"
```

**Cause:** Supabase rejects INSERT due to unknown column `reference`

### After Fix
```
HTTP 201 Created
{ "id": "...", "content": "...", ... }
```

**Success:** Post created and returned

---

## Monitoring

### Check Railway Logs

After deploying fix:

```
1. Open Railway Dashboard
2. Select backend project
3. View Deploy logs
4. Look for "Supabase error (posts)" messages
```

### Expected Log Output

**If column still missing:**
```
[ERROR] Supabase error (posts): {
  "message": "column \"reference\" of relation \"posts\" does not exist",
  "code": "42703"
}
[ERROR] Posts table missing "reference" column - run migrations/fix_posts_table.sql
```

**If column exists (success):**
```
[INFO] POST /api/posts 201 - 45ms
```

---

## Rollback (If Needed)

If something goes wrong:

```sql
-- Remove the column
ALTER TABLE public.posts DROP COLUMN IF EXISTS reference;

-- Drop the index
DROP INDEX IF EXISTS idx_posts_reference;
```

Then restore from backup if necessary.

---

## Summary

**Problem:** Posts table missing `reference` column  
**Solution:** Run `ALTER TABLE posts ADD COLUMN reference JSONB`  
**Time to fix:** 2 minutes  
**Risk:** Low (adds column, doesn't modify existing data)

---

**Ready to deploy!** 🚀

Run the migration SQL in Supabase, then test posting. Should work immediately.
