-- Migration: Fix Free Notes and Unified Feed
-- 1. Allow NULL node_id in node_journal_entries (for "Free Notes")
ALTER TABLE public.node_journal_entries ALTER COLUMN node_id DROP NOT NULL;

-- 2. Update trigger to provide better titles for free notes and support more tables
CREATE OR REPLACE FUNCTION public.create_notebook_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_content TEXT;
  v_title TEXT;
  v_goal_id TEXT;
  v_mood TEXT;
  v_occurred_at TIMESTAMPTZ;
  v_new JSONB;
BEGIN
  v_new := to_jsonb(NEW);

  CASE TG_TABLE_NAME
    WHEN 'posts' THEN
      v_entry_type := 'post';
      v_content := v_new->>'content';
      v_title := 'Posted to feed';
    WHEN 'tracker_entries' THEN
      v_entry_type := 'tracker';
      v_content := COALESCE(v_new->>'data', 'Tracker entry logged');
      v_title := 'Tracker activity';
    WHEN 'checkins' THEN
      v_entry_type := 'checkin';
      v_content := COALESCE(v_new->>'win_of_the_day', 'Daily check-in completed');
      v_title := 'Daily Check-in';
      v_mood := v_new->>'mood';
    WHEN 'journal_entries' THEN
      v_entry_type := 'note';
      v_content := v_new->>'note';
      v_title := 'Journal entry';
      v_mood := v_new->>'mood';
      v_goal_id := v_new->>'node_id';
    WHEN 'node_journal_entries' THEN
      v_entry_type := 'note';
      v_content := v_new->>'note';
      v_mood := v_new->>'mood';
      v_goal_id := v_new->>'node_id';
      -- Personalize title based on whether it's tied to a goal
      IF v_goal_id IS NULL THEN
        v_title := 'Free Note';
      ELSE
        v_title := 'Goal note';
      END IF;
    WHEN 'bets' THEN
      v_entry_type := 'bet';
      v_content := 'Committed ' || (v_new->>'stake_points') || ' PP to goal: ' || (v_new->>'goal_name');
      v_title := 'New Accountability Bet';
      v_goal_id := v_new->>'goal_node_id';
    WHEN 'goal_progress_history' THEN
      v_entry_type := 'goal';
      v_content := 'Progress updated to ' || (v_new->>'new_progress') || '%';
      v_title := 'Goal Progress: ' || (v_new->>'node_name');
      v_goal_id := v_new->>'node_id';
    ELSE
      v_entry_type := 'note';
      v_content := 'Entry created';
      v_title := 'Note';
  END CASE;

  v_occurred_at := COALESCE(
    (v_new->>'logged_at')::TIMESTAMPTZ,
    (v_new->>'timestamp')::TIMESTAMPTZ,
    (v_new->>'created_at')::TIMESTAMPTZ,
    (v_new->>'checked_in_at')::TIMESTAMPTZ,
    (v_new->>'deadline')::TIMESTAMPTZ,
    NOW()
  );

  INSERT INTO public.notebook_entries (
    user_id, entry_type, source_table, source_id,
    title, content, goal_id, mood, occurred_at
  ) VALUES (
    (v_new->>'user_id')::UUID, 
    v_entry_type, 
    TG_TABLE_NAME, 
    (v_new->>'id')::TEXT,
    v_title, 
    v_content, 
    v_goal_id, 
    v_mood, 
    v_occurred_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure tables have the trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_notebook_bet') THEN
    CREATE TRIGGER trig_notebook_bet
    AFTER INSERT ON public.bets
    FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_notebook_goal_progress') THEN
    CREATE TRIGGER trig_notebook_goal_progress
    AFTER INSERT ON public.goal_progress_history
    FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();
  END IF;
END $$;
