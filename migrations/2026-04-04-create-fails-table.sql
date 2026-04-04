-- =============================================================================
-- 2026-04-04 — Create Fails Table for Anonymous Community Fails
-- =============================================================================
-- Anonymous feed of failures: missed deadlines, failed bets, missed events,
-- missed checkins. Users remain anonymous - just shows fail type and details.
-- =============================================================================

-- 1. Create the fails table
CREATE TABLE IF NOT EXISTS public.fails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fail_type       TEXT NOT NULL,          -- 'missed_deadline', 'failed_bet', 'missed_event', 'missed_checkin'
  goal_name       TEXT,                    -- What the fail was about
  details         TEXT,                    -- Additional context
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.fails ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies - anyone can read, no insert (handled by backend)
DROP POLICY IF EXISTS "Fails read all" ON public.fails;
CREATE POLICY "Fails read all" ON public.fails FOR SELECT USING (true);

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS fails_created_at_idx ON public.fails (created_at DESC);
CREATE INDEX IF NOT EXISTS fails_type_idx ON public.fails (fail_type);

-- =============================================================================
-- End of Migration
-- =============================================================================
