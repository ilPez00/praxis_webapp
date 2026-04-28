-- =============================================================================
-- 2026-04-28 — Fix duels schema drift
-- =============================================================================
-- The duels table in production was created by an older CREATE TABLE IF NOT
-- EXISTS that ran before goal_node_id was added to setup.sql. Because the
-- table already existed, the new column never landed. As a result every
-- POST /duels insert errors with PostgREST PGRST204 ("Could not find the
-- 'goal_node_id' column of 'duels' in the schema cache") which the
-- duelController catches as SCHEMA_MISSING and surfaces as a 503
-- "Duels not yet enabled. Run DB migrations." — confusing because the
-- table itself is fine, only one column is missing.
--
-- Add the column. TEXT to match setup.sql / 2026-03-16-create-duels-table.sql.
-- =============================================================================

ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS goal_node_id TEXT;

-- Force PostgREST to refresh its schema cache so the column is visible
-- without waiting for the periodic auto-refresh.
NOTIFY pgrst, 'reload schema';
