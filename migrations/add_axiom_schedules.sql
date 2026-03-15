-- Migration: Add Axiom daily schedules with hourly time slots
-- Run this on your Supabase SQL Editor

-- ============================================================================
-- AXIOM SCHEDULES TABLE
-- Stores AI-generated daily schedules with hour-by-hour breakdown
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.axiom_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  focus_theme TEXT,
  energy_curve TEXT CHECK (energy_curve IN ('morning_peak', 'evening_peak', 'balanced')),
  wake_time TIME,
  sleep_time TIME,
  total_work_hours INTEGER DEFAULT 6,
  total_rest_hours INTEGER DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Index for fast date-based queries
CREATE INDEX IF NOT EXISTS idx_axiom_schedules_user_date
  ON public.axiom_schedules(user_id, date DESC);

-- ============================================================================
-- SCHEDULE TIME SLOTS TABLE
-- Individual hourly blocks within a daily schedule (6am-10pm = 16 slots)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.schedule_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.axiom_schedules(id) ON DELETE CASCADE,
  hour INTEGER NOT NULL CHECK (hour >= 6 AND hour <= 22),
  time_label TEXT NOT NULL,
  task TEXT NOT NULL,
  alignment TEXT,
  duration TEXT DEFAULT '45 min',
  preparation TEXT,
  is_flexible BOOLEAN DEFAULT true,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  category TEXT CHECK (category IN ('deep_work', 'admin', 'rest', 'exercise', 'social', 'learning', 'planning', 'reflection')),
  suggested_match_id UUID REFERENCES auth.users(id),
  suggested_place_id UUID,
  suggested_event_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedule_id, hour)
);

-- Index for fast slot queries
CREATE INDEX IF NOT EXISTS idx_schedule_time_slots_schedule
  ON public.schedule_time_slots(schedule_id, hour);

-- Index for suggested match queries
CREATE INDEX IF NOT EXISTS idx_schedule_time_slots_match
  ON public.schedule_time_slots(suggested_match_id) WHERE suggested_match_id IS NOT NULL;

-- ============================================================================
-- SCHEDULE COMPLETIONS TABLE
-- Tracks which time slots the user completed
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.schedule_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.axiom_schedules(id) ON DELETE CASCADE,
  hour INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  note TEXT,
  mood TEXT,
  UNIQUE(user_id, schedule_id, hour)
);

-- Index for completion tracking
CREATE INDEX IF NOT EXISTS idx_schedule_completions_user_schedule
  ON public.schedule_completions(user_id, schedule_id);

-- Index for daily completion stats
CREATE INDEX IF NOT EXISTS idx_schedule_completions_date
  ON public.schedule_completions(user_id, completed_at DESC);

-- ============================================================================
-- DIARY ENTRIES EXTENSION
-- Add source_table linkage to axiom_schedules
-- (Already has source_table and source_id columns)
-- ============================================================================

-- Ensure diary_entries can reference axiom_schedules
-- (No schema change needed - source_table/source_id already exist)

-- ============================================================================
-- RLS POLICIES - AXIOM SCHEDULES
-- ============================================================================

ALTER TABLE public.axiom_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own schedules"
  ON public.axiom_schedules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own schedules"
  ON public.axiom_schedules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules"
  ON public.axiom_schedules
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules"
  ON public.axiom_schedules
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - SCHEDULE TIME SLOTS
-- ============================================================================

ALTER TABLE public.schedule_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own time slots (via schedule)"
  ON public.schedule_time_slots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.axiom_schedules s
      WHERE s.id = schedule_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own time slots (via schedule)"
  ON public.schedule_time_slots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.axiom_schedules s
      WHERE s.id = schedule_id AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES - SCHEDULE COMPLETIONS
-- ============================================================================

ALTER TABLE public.schedule_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own completions"
  ON public.schedule_completions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own completions"
  ON public.schedule_completions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own completions"
  ON public.schedule_completions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own completions"
  ON public.schedule_completions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Get schedule with completion status for a specific date
 */
CREATE OR REPLACE FUNCTION public.get_schedule_with_completions(
  p_user_id UUID,
  p_date DATE
)
RETURNS TABLE (
  schedule_id UUID,
  date DATE,
  focus_theme TEXT,
  energy_curve TEXT,
  wake_time TIME,
  sleep_time TIME,
  total_work_hours INTEGER,
  total_rest_hours INTEGER,
  slots JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS schedule_id,
    s.date,
    s.focus_theme,
    s.energy_curve,
    s.wake_time,
    s.sleep_time,
    s.total_work_hours,
    s.total_rest_hours,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', sts.id,
          'hour', sts.hour,
          'time_label', sts.time_label,
          'task', sts.task,
          'alignment', sts.alignment,
          'duration', sts.duration,
          'preparation', sts.preparation,
          'is_flexible', sts.is_flexible,
          'priority', sts.priority,
          'category', sts.category,
          'suggested_match_id', sts.suggested_match_id,
          'suggested_place_id', sts.suggested_place_id,
          'suggested_event_id', sts.suggested_event_id,
          'is_completed', (sc.id IS NOT NULL),
          'completion_note', sc.note,
          'completion_mood', sc.mood
        ) ORDER BY sts.hour
      ) FILTER (WHERE sts.id IS NOT NULL),
      '[]'::jsonb
    ) AS slots
  FROM public.axiom_schedules s
  LEFT JOIN public.schedule_time_slots sts ON sts.schedule_id = s.id
  LEFT JOIN public.schedule_completions sc 
    ON sc.schedule_id = s.id AND sc.hour = sts.hour AND sc.user_id = p_user_id
  WHERE s.user_id = p_user_id AND s.date = p_date
  GROUP BY s.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Get schedule completion statistics for a date range
 */
CREATE OR REPLACE FUNCTION public.get_schedule_completion_stats(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_slots INTEGER,
  completed_slots INTEGER,
  completion_rate FLOAT,
  completions_by_category JSONB,
  completions_by_hour JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT sts.id)::INTEGER AS total_slots,
    COUNT(DISTINCT sc.id)::INTEGER AS completed_slots,
    CASE 
      WHEN COUNT(DISTINCT sts.id) = 0 THEN 0.0
      ELSE ROUND(COUNT(DISTINCT sc.id)::NUMERIC / COUNT(DISTINCT sts.id)::NUMERIC * 100, 2)
    END AS completion_rate,
    COALESCE(
      jsonb_object_agg(sts.category, COALESCE(cat_counts.completed, 0)) FILTER (WHERE sts.category IS NOT NULL),
      '{}'::jsonb
    ) AS completions_by_category,
    COALESCE(
      jsonb_object_agg(sts.hour, COALESCE(hour_counts.completed, 0)) FILTER (WHERE sts.hour IS NOT NULL),
      '{}'::jsonb
    ) AS completions_by_hour
  FROM public.axiom_schedules s
  JOIN public.schedule_time_slots sts ON sts.schedule_id = s.id
  LEFT JOIN public.schedule_completions sc 
    ON sc.schedule_id = s.id AND sc.hour = sts.hour AND sc.user_id = p_user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS completed
    FROM public.schedule_completions sc2
    WHERE sc2.schedule_id IN (SELECT id FROM public.axiom_schedules WHERE user_id = p_user_id AND date BETWEEN p_start_date AND p_end_date)
    AND sc2.hour = sts.hour
  ) cat_counts ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS completed
    FROM public.schedule_completions sc3
    WHERE sc3.schedule_id IN (SELECT id FROM public.axiom_schedules WHERE user_id = p_user_id AND date BETWEEN p_start_date AND p_end_date)
    AND sc3.hour = sts.hour
  ) hour_counts ON true
  WHERE s.user_id = p_user_id AND s.date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on axiom_schedules
CREATE OR REPLACE FUNCTION public.update_axiom_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_axiom_schedules_updated_at
  BEFORE UPDATE ON public.axiom_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_axiom_schedule_updated_at();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT ALL ON public.axiom_schedules TO authenticated;
GRANT ALL ON public.schedule_time_slots TO authenticated;
GRANT ALL ON public.schedule_completions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_schedule_with_completions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_schedule_completion_stats TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.axiom_schedules IS 'AI-generated daily schedules from Axiom coach';
COMMENT ON TABLE public.schedule_time_slots IS 'Hourly time blocks within daily schedules (6am-10pm)';
COMMENT ON TABLE public.schedule_completions IS 'User completions of scheduled time slots';
COMMENT ON COLUMN public.schedule_time_slots.category IS 'Type of activity: deep_work, admin, rest, exercise, social, learning, planning, reflection';
COMMENT ON COLUMN public.schedule_time_slots.priority IS 'Priority level: high, medium, low';
COMMENT ON COLUMN public.schedule_time_slots.is_flexible IS 'Whether this time slot can be moved to another time';
COMMENT ON COLUMN public.schedule_time_slots.suggested_match_id IS 'Recommended accountability partner for this slot';
COMMENT ON COLUMN public.schedule_time_slots.suggested_place_id IS 'Recommended place for this slot (gym, cafe, etc.)';
COMMENT ON COLUMN public.schedule_time_slots.suggested_event_id IS 'Recommended event for this slot';
