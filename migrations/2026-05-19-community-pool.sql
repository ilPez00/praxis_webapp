-- =============================================================================
-- 2026-05-19 — Community Pool: goal-level sharing opt-in + sterile flow store
-- Rachmaninov community vector pool — anonymized, never reversible.
-- Idempotent: safe to run multiple times.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- goal_sharing: per-goal sharing preferences
-- goal_id references a node id inside goal_trees.nodes JSON
-- (same pattern as goal_maturity)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goal_sharing (
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id             TEXT        NOT NULL,
  sharing             TEXT        NOT NULL DEFAULT 'private'
                                  CHECK (sharing IN ('private', 'opted_in')),
  sharing_enabled_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_sharing_user  ON public.goal_sharing(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_sharing_opted ON public.goal_sharing(sharing) WHERE sharing = 'opted_in';

ALTER TABLE public.goal_sharing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own sharing" ON public.goal_sharing;
CREATE POLICY "Users manage own sharing"
  ON public.goal_sharing FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.goal_sharing TO authenticated;

-- ---------------------------------------------------------------------------
-- community_flows: anonymized sterile flows for community pool
-- No user_id column — permanently detached from identity at insert time.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_flows (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  will       TEXT        NOT NULL,
  action     TEXT        NOT NULL,
  effect     TEXT        NOT NULL,
  grade      TEXT        NOT NULL,
  outcome    TEXT        NOT NULL,
  domain     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_flows_domain  ON public.community_flows(domain);
CREATE INDEX IF NOT EXISTS idx_community_flows_created ON public.community_flows(created_at DESC);

ALTER TABLE public.community_flows ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (rows are already anonymous).
DROP POLICY IF EXISTS "Authenticated read community flows" ON public.community_flows;
CREATE POLICY "Authenticated read community flows"
  ON public.community_flows FOR SELECT
  USING (auth.role() = 'authenticated');

-- Server-side inserts only — client never pushes directly.
GRANT SELECT ON public.community_flows TO authenticated;
GRANT ALL    ON public.community_flows TO service_role;

COMMIT;
