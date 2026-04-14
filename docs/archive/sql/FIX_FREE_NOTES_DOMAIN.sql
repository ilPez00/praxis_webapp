-- ============================================
-- FIX: Free Notes Should Show in Notebook
-- Solution: Add default domain 'Personal' to 
-- journal_entries sync trigger
-- 
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

-- Update the create_notebook_entry trigger function
-- to add default domain for journal entries
CREATE OR REPLACE FUNCTION public.create_notebook_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_content TEXT;
  v_title TEXT;
  v_mood TEXT;
  v_goal_id UUID;
  v_domain TEXT;
BEGIN
  -- Determine entry type and content based on source table
  CASE TG_TABLE_NAME
    WHEN 'posts' THEN
      v_entry_type := 'post';
      v_content := NEW.content;
      v_title := 'Posted to feed';
      v_goal_id := NULL;
      v_domain := NULL;
    WHEN 'tracker_entries' THEN
      v_entry_type := 'tracker';
      v_content := COALESCE(NEW.data::text, 'Tracker entry logged');
      v_title := 'Tracker activity';
      v_goal_id := NULL;
      v_domain := NULL;
    WHEN 'checkins' THEN
      v_entry_type := 'checkin';
      v_content := COALESCE(NEW.win_of_the_day, 'Daily check-in completed');
      v_title := 'Daily Check-in';
      v_mood := NEW.mood;
      v_goal_id := NULL;
      v_domain := NULL;
    WHEN 'journal_entries' THEN
      v_entry_type := 'note';
      v_content := NEW.note;
      v_title := 'Journal entry';
      v_mood := NEW.mood;
      v_goal_id := NEW.node_id;
      v_domain := 'Personal';  -- DEFAULT DOMAIN FOR FREE NOTES
    WHEN 'node_journal_entries' THEN
      v_entry_type := 'note';
      v_content := NEW.note;
      v_title := 'Goal note';
      v_mood := NEW.mood;
      v_goal_id := NEW.node_id;
      v_domain := NULL;  -- Has goal_id, domain not needed
    WHEN 'bets' THEN
      v_entry_type := 'bet';
      v_content := 'Bet placed: ' || NEW.goal_name;
      v_title := 'Bet: ' || NEW.goal_name;
      v_goal_id := NEW.goal_node_id;
      v_domain := NULL;
    ELSE
      v_entry_type := 'note';
      v_content := 'Entry created';
      v_title := 'Note';
      v_goal_id := NULL;
      v_domain := 'Personal';
  END CASE;

  -- Insert into notebook
  INSERT INTO public.notebook_entries (
    user_id, entry_type, source_table, source_id,
    title, content, goal_id, domain, mood, occurred_at
  ) VALUES (
    NEW.user_id, v_entry_type, TG_TABLE_NAME, NEW.id,
    v_title, v_content, v_goal_id, v_domain, v_mood,
    COALESCE(NEW.created_at, NEW.logged_at, NEW.checked_in_at, NOW())
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create triggers to use updated function
DROP TRIGGER IF EXISTS trg_journal_entries_notebook ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_notebook
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_node_journal_entries_notebook ON public.node_journal_entries;
CREATE TRIGGER trg_node_journal_entries_notebook
  AFTER INSERT ON public.node_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

-- Test: Create a test journal entry and verify it has domain='Personal'
-- INSERT INTO journal_entries (user_id, note) VALUES ('af2138c5-d0db-4de4-8e2d-3fd3dbed67b1', 'Test note with domain');
-- SELECT title, domain, entry_type FROM notebook_entries WHERE source_table = 'journal_entries' ORDER BY created_at DESC LIMIT 1;

-- ============================================
-- AFTER RUNNING:
-- 1. New journal entries will have domain='Personal'
-- 2. They will show in notebook alongside other notes
-- 3. Existing entries still need the function fix
-- ============================================
