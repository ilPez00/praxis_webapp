-- Migration: Agent PAT — add actor context to checkins + goal nodes + agent_keys
-- Run: psql "$SUPABASE_DB_URL" -f migrations/2026-05-18-agent-pat-checkin-actor.sql

-- 1. checkins: record who (human vs agent) made the action
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS actor_type  TEXT NOT NULL DEFAULT 'human'
    CHECK (actor_type IN ('human', 'agent')),
  ADD COLUMN IF NOT EXISTS agent_name  TEXT;

-- 2. goal_nodes: optional agent assignment
ALTER TABLE public.goal_nodes
  ADD COLUMN IF NOT EXISTS assigned_agent TEXT;  -- agent_name or null

-- 3. agent_keys: store a human-readable name (not just agent_id foreign key)
ALTER TABLE public.agent_keys
  ADD COLUMN IF NOT EXISTS agent_label TEXT;     -- e.g. "Aura", "research-bot", "my-script"

-- Index for fast agent activity queries
CREATE INDEX IF NOT EXISTS idx_checkins_actor_type
  ON public.checkins(user_id, actor_type, checked_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_agent_name
  ON public.checkins(user_id, agent_name, checked_in_at DESC)
  WHERE agent_name IS NOT NULL;
