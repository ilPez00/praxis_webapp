-- ============================================================================
-- FIX: Messages RLS Policy for Chat
-- This fixes the 500 error when loading chat messages
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Check current policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'messages';

-- 2. Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;

-- 3. Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Create clean, permissive policies for chat

-- SELECT: Users can view messages where they are sender OR receiver
CREATE POLICY "Users can view own conversations" ON public.messages
  FOR SELECT
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id
  );

-- INSERT: Users can send messages (must be sender)
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- UPDATE: Users can update their own messages (for edits)
CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- DELETE: Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- 5. Grant permissions
GRANT ALL ON public.messages TO authenticated;
GRANT SELECT ON public.messages TO anon;

-- 6. Verify policies (should show 4)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY cmd;

-- Expected:
-- policyname                          | cmd
-- ------------------------------------|--------
-- Users can delete own messages       | DELETE
-- Users can send messages             | INSERT
-- Users can update own messages       | UPDATE
-- Users can view own conversations    | SELECT

-- 7. Test query (should work now)
-- SELECT COUNT(*) FROM public.messages WHERE sender_id = auth.uid() OR receiver_id = auth.uid();
