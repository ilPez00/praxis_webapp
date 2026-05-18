-- Migration: Agent PAT — add actor context to checkins + agent_keys
-- Run: psql "$SUPABASE_DB_URL" -f src/migrations/2026-05-18-agent-pat-checkin-actor.sql
--
-- Note: goal nodes are stored as JSONB inside goal_trees.nodes — no separate table.
-- Agent assignment per node is handled at application level inside the nodes array.

-- 1. checkins: record who (human vs agent) made the action
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS actor_type  TEXT NOT NULL DEFAULT 'human'
    CHECK (actor_type IN ('human', 'agent')),
  ADD COLUMN IF NOT EXISTS agent_name  TEXT;

-- 2. agent_keys: store a human-readable label (not just agent_id foreign key)
ALTER TABLE public.agent_keys
  ADD COLUMN IF NOT EXISTS agent_label TEXT;     -- e.g. "Aura", "research-bot", "my-script"

-- Index for fast agent activity queries
CREATE INDEX IF NOT EXISTS idx_checkins_actor_type
  ON public.checkins(user_id, actor_type, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_agent_name
  ON public.checkins(user_id, agent_name, checked_in_at DESC)
  WHERE agent_name IS NOT NULL;
