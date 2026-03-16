-- ============================================================================
-- FIX: Messages RLS Policy for Chat - COMPLETE RESET
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Drop ALL policies on messages table first
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
    END LOOP;
END $$;

-- Verify all policies are dropped
SELECT COUNT(*) as remaining_policies 
FROM pg_policies 
WHERE tablename = 'messages';
-- Should return 0

-- 2. Ensure RLS is enabled
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. Create clean policies

-- SELECT: Users can view messages where they are sender OR receiver
CREATE POLICY "users_view_own_conversations" ON public.messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- INSERT: Users can send messages (must be sender)
CREATE POLICY "users_send_messages" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- UPDATE: Users can update their own messages
CREATE POLICY "users_update_own_messages" ON public.messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- DELETE: Users can delete their own messages
CREATE POLICY "users_delete_own_messages" ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- 4. Grant permissions
GRANT ALL ON public.messages TO authenticated;
GRANT SELECT ON public.messages TO anon;

-- 5. Verify (should show 4 policies)
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY cmd;

-- Expected:
-- policyname                        | cmd
-- ----------------------------------|--------
-- users_delete_own_messages         | DELETE
-- users_send_messages               | INSERT
-- users_update_own_messages         | UPDATE
-- users_view_own_conversations      | SELECT

-- 6. Test (should work now)
-- SELECT COUNT(*) FROM public.messages WHERE sender_id = auth.uid() OR receiver_id = auth.uid();
