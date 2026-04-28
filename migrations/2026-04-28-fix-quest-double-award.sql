-- =============================================================================
-- 2026-04-28 — Fix daily-quest reward path
-- =============================================================================
-- Two bugs caused "Track Your Progress" (and every other daily quest) to award
-- no PP from the user's perspective:
--   1. progress_user_quest auto-awarded XP/PP via add_xp_to_user on completion
--      AND the claim_quest_reward controller awarded again on claim → either
--      double award or, if the auto-call silently failed, zero.
--   2. The claim controller looked up user_daily_quests by id but the
--      :questId in the URL is the daily_quests template id (returned by
--      get_daily_quests_for_user as quest_id) → "not found" forever.
--
-- Fix #2 lives in src/controllers/gamificationController.ts.
-- Fix #1 is here: redefine progress_user_quest to only track progress and
-- completion. PP/XP are awarded exclusively via the claim flow.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.progress_user_quest(
  p_user_id UUID,
  p_quest_type TEXT,
  p_amount INT DEFAULT 1
)
RETURNS TABLE(success BOOLEAN, completed BOOLEAN, xp_earned INT, pp_earned INT) AS $$
DECLARE
  v_quest_record RECORD;
  v_new_progress INT;
  v_completed BOOLEAN := false;
BEGIN
  SELECT dq.id, dq.xp_reward, dq.pp_reward, udq.progress, udq.completed, udq.target
  INTO v_quest_record
  FROM public.daily_quests dq
  LEFT JOIN public.user_daily_quests udq
    ON dq.id = udq.quest_id
    AND udq.user_id = p_user_id
    AND udq.date = CURRENT_DATE
  WHERE dq.quest_type = p_quest_type
    AND dq.is_active = true
  LIMIT 1;

  IF v_quest_record.id IS NULL OR v_quest_record.completed THEN
    RETURN QUERY SELECT false, false, 0, 0;
    RETURN;
  END IF;

  v_new_progress := COALESCE(v_quest_record.progress, 0) + p_amount;

  IF v_new_progress >= COALESCE(v_quest_record.target, 1) THEN
    v_completed := true;
  END IF;

  INSERT INTO public.user_daily_quests (user_id, quest_id, progress, completed, completed_at)
  VALUES (p_user_id, v_quest_record.id, v_new_progress, v_completed,
          CASE WHEN v_completed THEN now() ELSE NULL END)
  ON CONFLICT (user_id, quest_id, date) DO UPDATE SET
    progress = v_new_progress,
    completed = v_completed,
    completed_at = CASE WHEN v_completed THEN now() ELSE user_daily_quests.completed_at END;

  -- Reward awarded ONLY via claim_quest_reward controller (POST /gamification/quests/:questId/claim)
  RETURN QUERY SELECT
    true,
    v_completed,
    CASE WHEN v_completed THEN v_quest_record.xp_reward ELSE 0 END,
    CASE WHEN v_completed THEN v_quest_record.pp_reward ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.progress_user_quest SET search_path = public, pg_temp;
