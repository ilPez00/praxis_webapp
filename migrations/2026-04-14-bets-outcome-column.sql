-- =============================================================================
-- Migration: 2026-04-14 Ensure bets.outcome column exists
-- Older environments bootstrapped from migrations/setup.sql never got the
-- `outcome` column (only migration_final.sql defines it). Without it,
-- GET /api/bets/:userId 500s on PostgREST "column not found".
-- The controller already soft-fails on 42703, but this migration makes
-- the feature actually work in production.
-- =============================================================================

BEGIN;

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS outcome TEXT;

-- Optional: constrain to known values. Uses DO block so it's idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bets_outcome_check'
  ) THEN
    ALTER TABLE public.bets
      ADD CONSTRAINT bets_outcome_check
      CHECK (outcome IS NULL OR outcome IN ('won', 'lost', 'cancelled', 'pending'));
  END IF;
END $$;

COMMIT;
