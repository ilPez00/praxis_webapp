-- ============================================================================
-- AXIOM ACTIONS AUDIT TABLE
-- Tracks all autonomous actions Axiom takes on behalf of users
-- Run this in Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.axiom_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,  -- 'create_bet', 'create_duel', 'create_goal', etc.
  params JSONB NOT NULL,      -- What Axiom decided to do
  result JSONB,               -- { success: bool, result?: any, error?: string }
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  scan_type TEXT DEFAULT 'midnight_scan',  -- 'midnight_scan' | 'on_demand' | 'axiom_agent'
  notes TEXT,
  created_by TEXT DEFAULT 'axiom'  -- 'axiom' | 'user' | 'admin'
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_axiom_actions_user ON public.axiom_actions(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_axiom_actions_type ON public.axiom_actions(action_type, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_axiom_actions_scan ON public.axiom_actions(scan_type, executed_at DESC);

-- RLS: Users can read their own axiom actions
ALTER TABLE public.axiom_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own axiom actions" ON public.axiom_actions;
CREATE POLICY "Users can read own axiom actions" ON public.axiom_actions
  FOR SELECT USING (auth.uid() = user_id);

-- Axiom (service role) can insert
DROP POLICY IF EXISTS "Service role can insert axiom actions" ON public.axiom_actions;
CREATE POLICY "Service role can insert axiom actions" ON public.axiom_actions
  FOR INSERT TO service_role WITH CHECK (true);

-- Verify
SELECT
  'columns' as check_type,
  COUNT(*) as result
FROM information_schema.columns
WHERE table_name = 'axiom_actions'
UNION ALL
SELECT
  'indexes' as check_type,
  COUNT(*) as result
FROM pg_indexes
WHERE tablename = 'axiom_actions'
UNION ALL
SELECT
  'policies' as check_type,
  COUNT(*) as result
FROM pg_policies
WHERE tablename = 'axiom_actions';

-- Expected:
-- columns: 9
-- indexes: 3
-- policies: 2
