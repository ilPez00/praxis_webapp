-- =============================================================================
-- Migration: 2026-04-13 Security Linter Fixes
-- Addresses all ERROR and WARN findings from Supabase Database Linter
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: SECURITY DEFINER Views → SECURITY INVOKER (ERROR level)
-- These views currently run with the creator's permissions, bypassing RLS.
-- Switching to INVOKER means queries respect the calling user's RLS policies.
-- =============================================================================

-- 1a. notebook_entries_broad — public preview of notebook entries (privacy-gated)
ALTER VIEW public.notebook_entries_broad SET (security_invoker = on);

-- 1b. journal_entries_broad — public preview of journal entries (privacy-gated)
ALTER VIEW public.journal_entries_broad SET (security_invoker = on);

-- 1c. user_domain_balance — domain progress analytics view
ALTER VIEW public.user_domain_balance SET (security_invoker = on);

-- 1d. user_expiring_goals — goals nearing deadline
ALTER VIEW public.user_expiring_goals SET (security_invoker = on);


-- =============================================================================
-- SECTION 2: Enable RLS on Unprotected Tables (ERROR level)
-- These tables are exposed via PostgREST with no row-level security.
-- =============================================================================

-- 2a. tracker_domain_mapping — read-only lookup table (tracker type → domain)
ALTER TABLE public.tracker_domain_mapping ENABLE ROW LEVEL SECURITY;

-- Everyone can read (it's a reference/lookup table), only service role can write
CREATE POLICY "Anyone can read tracker domain mapping"
  ON public.tracker_domain_mapping FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage tracker domain mapping"
  ON public.tracker_domain_mapping FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2b. axiom_daily_snapshots — daily axiom snapshot data
ALTER TABLE public.axiom_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can read their own snapshots, service role has full access
CREATE POLICY "Users can read own axiom snapshots"
  ON public.axiom_daily_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage axiom snapshots"
  ON public.axiom_daily_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- SECTION 3: Fix Overly Permissive RLS Policies (WARN level)
-- Policies with USING(true) for all roles → restrict to service_role only.
-- =============================================================================

-- 3a. bets — "Service role bypass bets" allows ALL for everyone
DROP POLICY IF EXISTS "Service role bypass bets" ON public.bets;
CREATE POLICY "Service role bypass bets" ON public.bets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- Note: "Users manage own bets" policy (auth.uid() = user_id) still active for users

-- 3b. goal_embeddings — "Service role bypass embeddings" allows ALL for everyone
DROP POLICY IF EXISTS "Service role bypass embeddings" ON public.goal_embeddings;
CREATE POLICY "Service role bypass embeddings" ON public.goal_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3c. user_achievements — "System can manage user achievements" allows ALL for everyone
DROP POLICY IF EXISTS "System can manage user achievements" ON public.user_achievements;
CREATE POLICY "System can manage user achievements" ON public.user_achievements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- Note: "Users can read own achievements" policy still active for users

-- 3d. gamification_events — "System can insert events" allows INSERT for everyone
DROP POLICY IF EXISTS "System can insert events" ON public.gamification_events;
CREATE POLICY "System can insert events" ON public.gamification_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);
-- Note: "Users can read own events" policy still active for users


-- =============================================================================
-- SECTION 4: Fix Mutable search_path on Functions (WARN level)
-- Setting search_path prevents schema-shadowing attacks where a malicious
-- user creates objects in public that shadow system/extension functions.
-- =============================================================================

ALTER FUNCTION public.get_daily_quests_for_user SET search_path = public, pg_temp;
ALTER FUNCTION public.check_monthly_milestone SET search_path = public, pg_temp;
ALTER FUNCTION public.check_user_achievements SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_duel_to_goal SET search_path = public, pg_temp;
ALTER FUNCTION public.emit_quest_complete_event SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_honor_vote_to_notebook SET search_path = public, pg_temp;
ALTER FUNCTION public.update_engagement_metrics_updated_at SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_friendship_to_notebook SET search_path = public, pg_temp;
ALTER FUNCTION public.create_diary_entry_from_share SET search_path = public, pg_temp;
ALTER FUNCTION public.spend_points SET search_path = public, pg_temp;
ALTER FUNCTION public.update_login_streak SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_event_rsvp_to_goal SET search_path = public, pg_temp;
ALTER FUNCTION public.update_profile_onboarded SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_challenge_to_goal SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_place_member_to_notebook SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_level SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user SET search_path = public, pg_temp;
ALTER FUNCTION public.expire_time_bound_goals SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_bet_to_subgoal SET search_path = public, pg_temp;
ALTER FUNCTION public.create_notebook_entry SET search_path = public, pg_temp;
ALTER FUNCTION public.match_users_by_goals SET search_path = public, pg_temp;
ALTER FUNCTION public.get_top_axiom_users SET search_path = public, pg_temp;
ALTER FUNCTION public.add_xp_to_user SET search_path = public, pg_temp;
ALTER FUNCTION public.get_diary_entries SET search_path = public, pg_temp;
ALTER FUNCTION public.emit_achievement_event SET search_path = public, pg_temp;
ALTER FUNCTION public.check_weekly_milestone SET search_path = public, pg_temp;
ALTER FUNCTION public.progress_user_quest SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_assign_domain SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_daily_quests SET search_path = public, pg_temp;
ALTER FUNCTION public.get_maslow_level SET search_path = public, pg_temp;
ALTER FUNCTION public.migrate_domain_name SET search_path = public, pg_temp;
ALTER FUNCTION public.award_streak_xp SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_event_rsvp_to_notebook SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_place_to_notebook SET search_path = public, pg_temp;
ALTER FUNCTION public.get_notebook_stats SET search_path = public, pg_temp;
ALTER FUNCTION public.get_diary_stats SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_leagues SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_group_member_to_notebook SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_engagement_metrics SET search_path = public, pg_temp;
ALTER FUNCTION public.log_goal_progress_change SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_gamification_events SET search_path = public, pg_temp;
ALTER FUNCTION public.get_notebook_entries SET search_path = public, pg_temp;
ALTER FUNCTION public.emit_level_up_event SET search_path = public, pg_temp;


-- =============================================================================
-- SECTION 5: Move vector Extension Out of Public Schema (WARN level)
-- Extensions in public can cause namespace collisions with user objects.
-- =============================================================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the vector extension
-- NOTE: This may fail if objects in public schema depend on vector types.
-- If it fails, you may need to:
--   1. Drop dependent objects
--   2. Move the extension
--   3. Recreate dependent objects referencing extensions.vector
-- Uncomment only after verifying no breaking dependencies:
--
-- ALTER EXTENSION vector SET SCHEMA extensions;
--
-- If moved, grant usage so functions can still reference vector types:
-- GRANT USAGE ON SCHEMA extensions TO public;
-- GRANT USAGE ON SCHEMA extensions TO service_role;
-- GRANT USAGE ON SCHEMA extensions TO authenticated;


-- =============================================================================
-- SECTION 6: Leaked Password Protection (WARN level)
-- This cannot be fixed via SQL — toggle in Supabase Dashboard:
--   Authentication → Settings → Password protection → Enable leaked password check
-- =============================================================================


COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION (run these manually to confirm)
-- =============================================================================

-- Check views are now SECURITY INVOKER:
-- SELECT viewname, viewowner
-- FROM pg_views
-- WHERE schemaname = 'public'
--   AND viewname IN ('notebook_entries_broad', 'journal_entries_broad',
--                    'user_domain_balance', 'user_expiring_goals');

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('tracker_domain_mapping', 'axiom_daily_snapshots');

-- Check policies are role-restricted:
-- SELECT tablename, policyname, roles
-- FROM pg_policies
-- WHERE tablename IN ('bets', 'goal_embeddings', 'user_achievements', 'gamification_events')
-- ORDER BY tablename;
