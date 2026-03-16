-- ============================================================================
-- FIX: Trigger function referencing non-existent logged_at column
-- This is causing 500 errors on inserts
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Find the problematic trigger
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_statement
FROM information_schema.triggers
WHERE action_statement LIKE '%logged_at%';

-- 2. Find the create_notebook_entry function
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'create_notebook_entry';

-- 3. Drop the problematic trigger (temporary fix)
DROP TRIGGER IF EXISTS tr_notebook_entry_on_journal ON journal_entries;
DROP TRIGGER IF EXISTS tr_notebook_entry_on_tracker ON tracker_entries;
DROP TRIGGER IF EXISTS tr_notebook_entry_on_checkin ON checkins;

-- 4. Drop and recreate the function with proper column handling
DROP FUNCTION IF EXISTS create_notebook_entry() CASCADE;

CREATE OR REPLACE FUNCTION create_notebook_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_title TEXT;
  v_content TEXT;
  v_goal_id UUID;
  v_domain TEXT;
  v_mood TEXT;
  v_occurred_at TIMESTAMPTZ;
BEGIN
  -- Determine entry type and content based on source table
  IF TG_TABLE_NAME = 'journal_entries' THEN
    v_entry_type := 'journal';
    v_title := 'Journal Entry';
    v_content := NEW.note;
    v_goal_id := NEW.node_id;
    v_mood := NEW.mood;
    v_occurred_at := COALESCE(NEW.created_at, NOW());
    
  ELSIF TG_TABLE_NAME = 'node_journal_entries' THEN
    v_entry_type := 'goal_journal';
    v_title := 'Goal Journal';
    v_content := NEW.note;
    v_goal_id := NEW.node_id;
    v_mood := NEW.mood;
    v_occurred_at := COALESCE(NEW.logged_at, NEW.created_at, NOW());
    
  ELSIF TG_TABLE_NAME = 'tracker_entries' THEN
    v_entry_type := 'tracker';
    v_title := 'Tracker Log';
    v_content := NEW.data::TEXT;
    v_goal_id := NULL;
    v_mood := NULL;
    v_occurred_at := COALESCE(NEW.logged_at, NOW());
    
  ELSIF TG_TABLE_NAME = 'checkins' THEN
    v_entry_type := 'checkin';
    v_title := 'Daily Check-in';
    v_content := COALESCE(NEW.win_of_the_day, NEW.note, 'Checked in');
    v_goal_id := NEW.goal_id;
    v_mood := NEW.mood;
    v_occurred_at := COALESCE(NEW.checked_in_at, NOW());
    
  ELSE
    RETURN NULL;
  END IF;

  -- Get domain from goal if goal_id exists
  IF v_goal_id IS NOT NULL THEN
    SELECT domain INTO v_domain FROM goal_trees.nodes WHERE id = v_goal_id;
  END IF;

  -- Insert into notebook_entries
  INSERT INTO public.notebook_entries (
    user_id,
    entry_type,
    source_table,
    source_id,
    title,
    content,
    goal_id,
    domain,
    mood,
    occurred_at
  ) VALUES (
    COALESCE(NEW.user_id, auth.uid()),
    v_entry_type,
    TG_TABLE_NAME,
    NEW.id,
    v_title,
    v_content,
    v_goal_id,
    v_domain,
    v_mood,
    v_occurred_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate triggers on correct tables only
CREATE TRIGGER tr_notebook_entry_on_node_journal
  AFTER INSERT ON public.node_journal_entries
  FOR EACH ROW EXECUTE FUNCTION create_notebook_entry();

CREATE TRIGGER tr_notebook_entry_on_checkin
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION create_notebook_entry();

-- Don't create triggers on journal_entries or tracker_entries if they don't have logged_at

-- 6. Verify triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'tr_notebook%';
