-- ============================================================================
-- Praxis RLS Audit — Production Diagnostic
-- ============================================================================
-- Run this in Supabase SQL Editor to get a complete picture of:
--   1. All tables with RLS enabled/disabled
--   2. Tables missing RLS entirely
--   3. Tables with no policies (RLS on but no rules = blocks ALL access)
--   4. Tables with overly permissive policies (using true)
-- ============================================================================

-- 1. Tables with RLS enabled vs disabled
SELECT
  schemaname,
  relname AS table_name,
  CASE
    WHEN relrowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END AS rls_status,
  CASE
    WHEN relforcerowsecurity THEN '✅ FORCED'
    ELSE '⚠️ Not forced (owner bypass)'
  END AS force_status
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE schemaname = 'public'
  AND relkind = 'r'
ORDER BY
  CASE WHEN relrowsecurity THEN 0 ELSE 1 END,
  relname;

-- 2. Tables with RLS ON but ZERO policies (blocks ALL access, including owner)
SELECT
  schemaname,
  relname AS table_name,
  polname AS policy_name,
  cmd AS command,
  qual AS using_clause,
  with_check AS with_check_clause
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
LEFT JOIN pg_policies ON pg_policies.tablename = pg_class.relname
  AND pg_policies.schemaname = pg_namespace.nspname
WHERE schemaname = 'public'
  AND relkind = 'r'
  AND relrowsecurity = true
ORDER BY
  CASE WHEN polname IS NULL THEN 0 ELSE 1 END,
  relname;

-- 3. Tables with dangerously permissive policies (USING true)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual = 'true'
    OR qual IS NULL
  )
  AND policyname NOT LIKE '%public%'
  AND policyname NOT LIKE '%read%all%'
ORDER BY tablename, policyname;

-- 4. Check if service_role bypasses RLS (it should by default)
-- This is informational — Supabase service_role key ALWAYS bypasses RLS
SELECT
  'Service role key bypasses RLS by design' AS note,
  'Verify: backend uses SERVICE_ROLE key, not anon key' AS action_required;

-- 5. Tables that should have RLS but might be missing it
-- Common tables that often get forgotten:
SELECT
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN '✅' ELSE '❌ MISSING' END AS rls,
  COUNT(p.policyname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = n.nspname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'profiles',
    'goal_trees',
    'goal_embeddings',
    'checkins',
    'matches',
    'messages',
    'honor',
    'bets',
    'duels',
    'challenges',
    'groups',
    'group_members',
    'posts',
    'post_likes',
    'post_comments',
    'post_references',
    'user_subscriptions',
    'user_payments',
    'marketplace_transactions',
    'trackers',
    'tracker_entries',
    'notebook_entries',
    'notebook_tags',
    'notebook_activity_log',
    'journal_entries',
    'node_journal_entries',
    'axiom_daily_briefs',
    'axiom_schedules',
    'schedule_time_slots',
    'schedule_completions',
    'axiom_narratives',
    'axiom_private_summaries',
    'diary_entries',
    'notifications',
    'referrals',
    'achievements',
    'engagement_metrics',
    'events',
    'event_types',
    'event_checkins',
    'places',
    'services',
    'words',
    'feedback',
    'reports',
    'seasonal_events',
    'accountability_buddies'
  )
GROUP BY c.relname, c.relrowsecurity
ORDER BY
  CASE WHEN c.relrowsecurity THEN 0 ELSE 1 END,
  c.relname;

-- ============================================================================
-- FIX: Enable RLS on tables that are missing it
-- ============================================================================
-- UNCOMMENT the tables that show as "❌ MISSING" above:
-- ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX: Add default RLS policy pattern for user-owned tables
-- ============================================================================
-- Template for tables with user_id column:
--
-- CREATE POLICY "Users can view own <table>" ON public.<table>
--   FOR SELECT USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can insert own <table>" ON public.<table>
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "Users can update own <table>" ON public.<table>
--   FOR UPDATE USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can delete own <table>" ON public.<table>
--   FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Notes
-- ============================================================================
-- - Service role key (used by backend) bypasses RLS by design
-- - Anon key (used by frontend) is restricted by RLS
-- - Backend should ALWAYS use SERVICE_ROLE key
-- - Frontend should NEVER use SERVICE_ROLE key
