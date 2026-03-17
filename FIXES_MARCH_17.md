# Fixes for March 17, 2026

## Issues Reported

1. **🌐 Messages not showing in private chat or groups** - 500 error when fetching messages
2. **🔗 Share button broken** - Share to Diary functionality not working

---

## Issue 1: Messages 500 Error

### Root Cause
The backend API (`https://web-production-646a4.up.railway.app/api`) is returning HTTP 500 when trying to fetch messages from the Supabase `messages` table. This is happening because:

1. The Railway production environment is missing the `SUPABASE_SERVICE_ROLE_KEY` environment variable
2. OR the key is set incorrectly (e.g., using the anon key instead of service role key)

### Evidence from Logs
```
Fetch messages error: AxiosError: Request failed with status code 500
GET https://web-production-646a4.up.railway.app/api/messages/af2138c5-d0db-4de4-8e2d-3fd3dbed67b1/95c94f77-a364-422a-a4ac-2770bbb76a90
[HTTP/1.1 500]
```

### Solution

**You need to add/update environment variables in Railway:**

1. Go to your Railway project dashboard
2. Navigate to the **Environment** tab
3. Add/verify these variables:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Must be the LONG service_role key, NOT the short anon key
```

**How to find the correct key:**
- Go to Supabase Dashboard → Your Project → Settings (⚙️) → API
- Copy the **service_role** key (NOT the anon/public key)
- The service_role key is much longer and starts with `eyJhbGci`
- The anon key is shorter and also starts with `eyJhbGci` but has a different structure

**How to verify in Railway logs:**
After deploying, open a chat and check Railway logs. You should see:
```
[getMessages] Supabase URL set: true, Key set: true, Key starts with: eyJhbGciOiJ...
```

If you see:
- `Key set: false` → Environment variable is missing
- `Key starts with: sb_` → You're using the wrong key (anon key)

**Verify the fix:**
After updating Railway env vars, the server will restart automatically. Then:
1. Open a private chat
2. Messages should load without the 500 error
3. Check Railway logs to confirm no more Supabase authentication errors

---

## Issue 2: Share Button Broken

### Root Cause
The ShareButton component (`client/src/components/common/ShareButton.tsx`) is failing when trying to insert into the `notebook_entries` table. The error is caught but the specific error message isn't always clear.

### Possible Causes
1. The `notebook_entries` table doesn't exist in your Supabase database (missing migrations)
2. The table exists but is missing required columns (`metadata`, `source_table`, `source_id`)
3. RLS (Row Level Security) policies are blocking inserts

### Solution

#### Step 1: Run the notebook migrations

Execute this SQL in your Supabase SQL Editor to ensure the table exists with all required columns:

```sql
-- Ensure notebook_entries table exists
CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  metadata JSONB,
  source_table TEXT,
  source_id TEXT,
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns if they're missing
ALTER TABLE public.notebook_entries ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.notebook_entries ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE public.notebook_entries ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE public.notebook_entries ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can insert own entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can read own entries" ON public.notebook_entries;

-- Create new policies
CREATE POLICY "Users can insert own entries" ON public.notebook_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own entries" ON public.notebook_entries
  FOR SELECT
  USING (auth.uid() = user_id);
```

#### Step 2: Verify the fix

1. Go to any post in the feed
2. Click the **Share** button (share icon)
3. Click "Share to Diary"
4. Fill in optional reply/comment
5. Click "Share"
6. You should see "Shared to diary!" toast notification

---

## Quick Fix Script

Run this in your Supabase SQL Editor to fix both issues at once:

```sql
-- ============================================
-- FIX 1: Ensure messages table is properly set up
-- ============================================

CREATE TABLE IF NOT EXISTS public.messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL,
  goal_node_id TEXT,
  message_type TEXT        DEFAULT 'text',
  media_url    TEXT,
  room_id      UUID,
  metadata     JSONB,
  timestamp    TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS goal_node_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url    TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS room_id      UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata     JSONB;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages"     ON public.messages;

CREATE POLICY "Users can read own messages" ON public.messages
  FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR room_id IS NOT NULL
  );

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);


-- ============================================
-- FIX 2: Ensure notebook_entries table exists
-- ============================================

CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  metadata JSONB,
  source_table TEXT,
  source_id TEXT,
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notebook_entries ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.notebook_entries ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE public.notebook_entries ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE public.notebook_entries ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT true;

ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own entries" ON public.notebook_entries;
DROP POLICY IF EXISTS "Users can read own entries" ON public.notebook_entries;

CREATE POLICY "Users can insert own entries" ON public.notebook_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own entries" ON public.notebook_entries
  FOR SELECT
  USING (auth.uid() = user_id);
```

---

## Testing Checklist

After applying fixes:

- [ ] **Messages**: Open a chat with another user → Messages should load
- [ ] **Messages**: Send a new message → Should appear immediately
- [ ] **Share**: Click share button on a post → Menu should open
- [ ] **Share**: Click "Share to Diary" → Dialog should open
- [ ] **Share**: Fill in reply and click "Share" → Success toast appears
- [ ] **Share**: Check your diary/notebook → Shared entry should appear

---

## Additional Notes

### Railway Environment Variables

Required environment variables in Railway:

```bash
# Supabase (REQUIRED for messages, user data, etc.)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional but recommended
NODE_ENV=production
PORT=3001
```

### Client Environment Variables

Required in `client/.env` or Vercel environment:

```bash
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # This is the SHORT anon key
VITE_API_URL=https://web-production-646a4.up.railway.app/api
```

---

**Need help?** Check Railway logs after deploying env vars:
```bash
# In Railway dashboard → Logs
# Look for: "[supabase] URL set: true | key type: service_role_jwt"
```

If you see "key type: WRONG_anon_key" or "key type: missing", the env var is not set correctly.
