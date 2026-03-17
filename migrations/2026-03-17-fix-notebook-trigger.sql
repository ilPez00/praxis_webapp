-- 1. Ensure trackers table has the unique constraint for upsert
-- Without this, the upsert in logTracker controller will fail or create duplicates
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
        RAISE NOTICE 'Could not add unique constraint, it might already exist or table is missing';
END $$;

-- 2. Fix for the create_notebook_entry trigger function
-- This handles missing columns (like created_at vs logged_at) safely to prevent 500 errors on inserts

CREATE OR REPLACE FUNCTION public.create_notebook_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_content TEXT;
  v_title TEXT;
  v_goal_id UUID;
  v_domain TEXT;
  v_mood TEXT;
  v_win_of_the_day TEXT;
  v_occurred_at TIMESTAMPTZ;
BEGIN
  -- 1. Safely extract win_of_the_day if it exists (for checkins)
  BEGIN
    v_win_of_the_day := NEW.win_of_the_day;
  EXCEPTION WHEN undefined_column THEN
    v_win_of_the_day := NULL;
  END;

  -- 2. Determine entry type and metadata based on source table
  CASE TG_TABLE_NAME
    WHEN 'posts' THEN
      v_entry_type := 'post';
      v_content := NEW.content;
      v_title := 'Posted to feed';
      v_occurred_at := NEW.created_at;
      
    WHEN 'tracker_entries' THEN
      v_entry_type := 'tracker';
      v_content := COALESCE(NEW.data::text, 'Tracker entry logged');
      v_title := 'Tracker activity';
      -- tracker_entries uses logged_at
      BEGIN v_occurred_at := NEW.logged_at; EXCEPTION WHEN undefined_column THEN v_occurred_at := NOW(); END;
      
    WHEN 'checkins' THEN
      v_entry_type := 'checkin';
      v_content := COALESCE(v_win_of_the_day, 'Daily check-in completed');
      v_title := 'Daily Check-in';
      v_mood := NEW.mood;
      -- checkins uses checked_in_at
      BEGIN v_occurred_at := NEW.checked_in_at; EXCEPTION WHEN undefined_column THEN v_occurred_at := NOW(); END;
      
    WHEN 'journal_entries' THEN
      v_entry_type := 'note';
      v_content := NEW.note;
      v_title := 'Journal entry';
      v_mood := NEW.mood;
      v_goal_id := NEW.node_id;
      v_occurred_at := NEW.created_at;
      
    WHEN 'node_journal_entries' THEN
      v_entry_type := 'note';
      v_content := NEW.note;
      v_title := 'Goal note';
      v_mood := NEW.mood;
      v_goal_id := NEW.node_id;
      -- node_journal_entries uses logged_at
      BEGIN v_occurred_at := NEW.logged_at; EXCEPTION WHEN undefined_column THEN v_occurred_at := NOW(); END;
      
    ELSE
      v_entry_type := 'note';
      v_content := 'Entry created';
      v_title := 'Note';
      -- Final fallback for timestamp
      BEGIN v_occurred_at := NEW.created_at; EXCEPTION WHEN OTHERS THEN 
        BEGIN v_occurred_at := NEW.logged_at; EXCEPTION WHEN OTHERS THEN 
          v_occurred_at := NOW(); 
        END;
      END;
  END CASE;

  -- 3. Final safety check for occurred_at
  v_occurred_at := COALESCE(v_occurred_at, NOW());

  -- 4. Insert into notebook
  INSERT INTO public.notebook_entries (
    user_id, entry_type, source_table, source_id,
    title, content, goal_id, domain, mood, occurred_at
  ) VALUES (
    NEW.user_id, v_entry_type, TG_TABLE_NAME, NEW.id,
    v_title, v_content, v_goal_id, v_domain, v_mood, 
    v_occurred_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

