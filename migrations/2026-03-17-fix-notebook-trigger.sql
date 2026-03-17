-- 1. Ensure trackers table has the unique constraint for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'trackers_user_id_type_key' 
        OR (conrelid = 'public.trackers'::regclass AND contype = 'u')
    ) THEN
        ALTER TABLE public.trackers ADD CONSTRAINT trackers_user_id_type_key UNIQUE (user_id, type);
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add unique constraint';
END $$;

-- 2. Bulletproof fix for the create_notebook_entry trigger function
-- Uses JSONB conversion to avoid "record NEW has no field" runtime errors 
-- when columns differ between tables sharing this trigger.

CREATE OR REPLACE FUNCTION public.create_notebook_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_content TEXT;
  v_title TEXT;
  v_goal_id UUID;
  v_mood TEXT;
  v_occurred_at TIMESTAMPTZ;
  v_new JSONB;
BEGIN
  -- Convert NEW record to JSONB for safe field access
  v_new := to_jsonb(NEW);

  -- Determine entry type and content based on source table
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
      v_goal_id := (v_new->>'node_id')::UUID;
    WHEN 'node_journal_entries' THEN
      v_entry_type := 'note';
      v_content := v_new->>'note';
      v_title := 'Goal note';
      v_mood := v_new->>'mood';
      v_goal_id := (v_new->>'node_id')::UUID;
    ELSE
      v_entry_type := 'note';
      v_content := 'Entry created';
      v_title := 'Note';
  END CASE;

  -- Safely extract available timestamp
  v_occurred_at := COALESCE(
    (v_new->>'logged_at')::TIMESTAMPTZ,
    (v_new->>'created_at')::TIMESTAMPTZ,
    (v_new->>'checked_in_at')::TIMESTAMPTZ,
    NOW()
  );

  -- Insert into notebook
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
