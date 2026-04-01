-- =============================================================================
-- Gamification Events & Notifications
-- Migration Date: 2026-03-28
-- =============================================================================

-- =============================================================================
-- 1. GAMIFICATION_EVENTS — Store events for real-time notifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gamification_events (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,
  event_data      JSONB       NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gamification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own events" ON public.gamification_events;
CREATE POLICY "Users can read own events"
  ON public.gamification_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert events" ON public.gamification_events;
CREATE POLICY "System can insert events"
  ON public.gamification_events FOR INSERT
  WITH CHECK (true);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_gamification_events_user_created 
  ON public.gamification_events(user_id, created_at DESC);

-- =============================================================================
-- 2. TRIGGER FUNCTION — Emit level up event
-- =============================================================================

CREATE OR REPLACE FUNCTION emit_level_up_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.level > COALESCE(OLD.level, 1) THEN
    INSERT INTO public.gamification_events (user_id, event_type, event_data)
    VALUES (
      NEW.id,
      'level_up',
      jsonb_build_object(
        'level', NEW.level,
        'oldLevel', OLD.level,
        'xp_earned', NEW.total_xp - COALESCE(OLD.total_xp, 0)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emit_level_up ON public.profiles;
CREATE TRIGGER trg_emit_level_up
  AFTER UPDATE OF level ON public.profiles
  FOR EACH ROW
  WHEN (NEW.level > COALESCE(OLD.level, 1))
  EXECUTE FUNCTION emit_level_up_event();

-- =============================================================================
-- 3. HELPER FUNCTION — Emit achievement event
-- =============================================================================

CREATE OR REPLACE FUNCTION emit_achievement_event(
  p_user_id UUID,
  p_achievement_key TEXT,
  p_achievement_title TEXT,
  p_xp_earned INT,
  p_pp_earned INT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.gamification_events (user_id, event_type, event_data)
  VALUES (
    p_user_id,
    'achievement_unlocked',
    jsonb_build_object(
      'achievement_key', p_achievement_key,
      'achievement_title', p_achievement_title,
      'xp_earned', p_xp_earned,
      'pp_earned', p_pp_earned
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. HELPER FUNCTION — Emit quest completion event
-- =============================================================================

CREATE OR REPLACE FUNCTION emit_quest_complete_event(
  p_user_id UUID,
  p_quest_title TEXT,
  p_xp_earned INT,
  p_pp_earned INT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.gamification_events (user_id, event_type, event_data)
  VALUES (
    p_user_id,
    'quest_completed',
    jsonb_build_object(
      'quest_title', p_quest_title,
      'xp_earned', p_xp_earned,
      'pp_earned', p_pp_earned
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. CLEANUP FUNCTION — Remove old events (90 days)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_gamification_events()
RETURNS TEXT AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.gamification_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN 'Deleted ' || v_deleted || ' old gamification events';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- End of Migration
-- =============================================================================
