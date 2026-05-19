-- =============================================================================
-- 2026-05-19 — System Config + Rachmaninov Overrides
-- Generic key-value store for server-side config.
-- First use: rachmaninov_overrides (dynamic ontology editing without redeploy).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.system_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the overrides key so PATCH endpoint never hits "row not found"
INSERT INTO public.system_config (key, value)
VALUES ('rachmaninov_overrides', '{}')
ON CONFLICT (key) DO NOTHING;

COMMIT;
