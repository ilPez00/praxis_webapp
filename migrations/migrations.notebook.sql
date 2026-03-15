-- Smart Notebook System Migrations
-- Run this AFTER migrations.final.sql
-- All statements are IDEMPOTENT (safe to run multiple times)

-- ============================================================================
-- 1. NOTEBOOK ENTRIES (Unified feed for all content)
-- ============================================================================

-- Main notebook entries table (polymorphic - references all content types)
CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Content type (what kind of entry is this?)
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'note',           -- Manual journal note
    'tracker',        -- Tracker log
    'goal_progress',  -- Goal progress update
    'post',           -- Public post
    'event',          -- Event attended/created
    'message',        -- Important message/conversation
    'checkin',        -- Daily check-in
    'achievement',    -- Achievement unlocked
    'bet',            -- Bet/challenge placed or completed
    'match',          -- New match/connection
    'verification',   -- Goal verification
    'comment'         -- Comment on something
  )),
  
  -- Polymorphic reference to source content
  source_table TEXT,  -- e.g., 'posts', 'tracker_entries', 'events'
  source_id UUID,     -- ID of the source record
  
  -- Content
  title TEXT,         -- Optional title
  content TEXT NOT NULL,  -- Main content (UTF-8 with emoji support)
  
  -- Context
  goal_id UUID,       -- Associated goal (if any)
  domain TEXT,        -- Goal domain (if applicable)
  
  -- Metadata
  mood TEXT,          -- Mood/emotion
  tags TEXT[],        -- Array of tags for categorization
  attachments JSONB DEFAULT '[]'::jsonb,  -- Images, links, etc.
  
  -- Privacy
  is_private BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),  -- When the event occurred
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to existing notebook_entries if table exists but columns missing
DO $$ 
BEGIN 
  -- Add tags column if missing
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notebook_entries') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'tags') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN tags TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'attachments') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'goal_id') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN goal_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'domain') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN domain TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'source_table') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN source_table TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'source_id') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN source_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'entry_type') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN entry_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'is_pinned') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'occurred_at') THEN
      ALTER TABLE public.notebook_entries ADD COLUMN occurred_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  ELSE
    -- Table doesn't exist, create it
    CREATE TABLE public.notebook_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL,
      source_table TEXT,
      source_id UUID,
      title TEXT,
      content TEXT NOT NULL,
      goal_id UUID,
      domain TEXT,
      mood TEXT,
      tags TEXT[],
      attachments JSONB DEFAULT '[]'::jsonb,
      is_private BOOLEAN DEFAULT false,
      is_pinned BOOLEAN DEFAULT false,
      occurred_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can view own notebook entries" ON public.notebook_entries 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can insert own notebook entries" ON public.notebook_entries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can update own notebook entries" ON public.notebook_entries 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notebook entries" ON public.notebook_entries;
CREATE POLICY "Users can delete own notebook entries" ON public.notebook_entries 
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notebook_user ON public.notebook_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_type ON public.notebook_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_notebook_occurred ON public.notebook_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_notebook_goal ON public.notebook_entries(goal_id);
CREATE INDEX IF NOT EXISTS idx_notebook_domain ON public.notebook_entries(domain);
CREATE INDEX IF NOT EXISTS idx_notebook_tags ON public.notebook_entries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_notebook_source ON public.notebook_entries(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_notebook_content ON public.notebook_entries USING GIN (to_tsvector('english', content));

-- ============================================================================
-- 2. TAGS SYSTEM (for cross-referencing)
-- ============================================================================

-- Tags table (for organized tagging)
CREATE TABLE IF NOT EXISTS public.notebook_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B5CF6',  -- Default purple
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.notebook_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tags" ON public.notebook_tags;
CREATE POLICY "Users can view own tags" ON public.notebook_tags 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tags" ON public.notebook_tags;
CREATE POLICY "Users can insert own tags" ON public.notebook_tags 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tags" ON public.notebook_tags;
CREATE POLICY "Users can update own tags" ON public.notebook_tags 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tags" ON public.notebook_tags;
CREATE POLICY "Users can delete own tags" ON public.notebook_tags 
  FOR DELETE USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_notebook_tags_user ON public.notebook_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_tags_name ON public.notebook_tags(name);

-- ============================================================================
-- 3. AUTOMATIC ENTRY CREATION FUNCTIONS
-- ============================================================================

-- Function to create notebook entry from trigger
CREATE OR REPLACE FUNCTION public.create_notebook_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_content TEXT;
  v_title TEXT;
  v_goal_id UUID;
  v_domain TEXT;
  v_mood TEXT;
BEGIN
  -- Determine entry type and content based on source table
  CASE TG_TABLE_NAME
    WHEN 'posts' THEN
      v_entry_type := 'post';
      v_content := NEW.content;
      v_title := 'Posted to feed';
    WHEN 'tracker_entries' THEN
      v_entry_type := 'tracker';
      v_content := COALESCE(NEW.data::text, 'Tracker entry logged');
      v_title := 'Tracker activity';
    WHEN 'checkins' THEN
      v_entry_type := 'checkin';
      v_content := COALESCE(NEW.win_of_the_day, 'Daily check-in completed');
      v_title := 'Daily Check-in';
      v_mood := NEW.mood;
    WHEN 'journal_entries' THEN
      v_entry_type := 'note';
      v_content := NEW.note;
      v_title := 'Journal entry';
      v_mood := NEW.mood;
      v_goal_id := NEW.node_id;
    WHEN 'node_journal_entries' THEN
      v_entry_type := 'note';
      v_content := NEW.note;
      v_title := 'Goal note';
      v_mood := NEW.mood;
      v_goal_id := NEW.node_id;
    ELSE
      v_entry_type := 'note';
      v_content := 'Entry created';
      v_title := 'Note';
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

-- Create triggers for automatic notebook entry creation
DROP TRIGGER IF EXISTS trg_posts_notebook ON public.posts;
CREATE TRIGGER trg_posts_notebook
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_tracker_entries_notebook ON public.tracker_entries;
CREATE TRIGGER trg_tracker_entries_notebook
  AFTER INSERT ON public.tracker_entries
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_checkins_notebook ON public.checkins;
CREATE TRIGGER trg_checkins_notebook
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_journal_entries_notebook ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_notebook
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

DROP TRIGGER IF EXISTS trg_node_journal_entries_notebook ON public.node_journal_entries;
CREATE TRIGGER trg_node_journal_entries_notebook
  AFTER INSERT ON public.node_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to get notebook entries with filters
CREATE OR REPLACE FUNCTION public.get_notebook_entries(
  p_user_id UUID,
  p_entry_type TEXT DEFAULT NULL,
  p_goal_id UUID DEFAULT NULL,
  p_domain TEXT DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  entry_type TEXT,
  title TEXT,
  content TEXT,
  mood TEXT,
  tags TEXT[],
  goal_id UUID,
  domain TEXT,
  source_table TEXT,
  source_id UUID,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  is_pinned BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ne.id,
    ne.entry_type,
    ne.title,
    ne.content,
    ne.mood,
    ne.tags,
    ne.goal_id,
    ne.domain,
    ne.source_table,
    ne.source_id,
    ne.occurred_at,
    ne.created_at,
    ne.is_pinned
  FROM public.notebook_entries ne
  WHERE ne.user_id = p_user_id
    AND (p_entry_type IS NULL OR ne.entry_type = p_entry_type)
    AND (p_goal_id IS NULL OR ne.goal_id = p_goal_id)
    AND (p_domain IS NULL OR ne.domain = p_domain)
    AND (p_tag IS NULL OR p_tag = ANY(ne.tags))
    AND (p_search IS NULL OR ne.content ILIKE '%' || p_search || '%')
  ORDER BY ne.is_pinned DESC, ne.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notebook stats for user
CREATE OR REPLACE FUNCTION public.get_notebook_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_entries', COUNT(*),
    'by_type', jsonb_object_agg(entry_type, count),
    'by_domain', jsonb_object_agg(domain, domain_count),
    'recent_tags', (
      SELECT jsonb_agg(tag) FROM (
        SELECT unnest(tags) as tag, COUNT(*) as cnt
        FROM notebook_entries
        WHERE user_id = p_user_id
        GROUP BY tag
        ORDER BY cnt DESC
        LIMIT 10
      ) tags
    ),
    'streak_days', (
      SELECT COUNT(DISTINCT DATE(occurred_at))
      FROM notebook_entries
      WHERE user_id = p_user_id
      AND occurred_at >= NOW() - INTERVAL '30 days'
    )
  )
  INTO v_stats
  FROM (
    SELECT entry_type, COUNT(*) as count
    FROM notebook_entries
    WHERE user_id = p_user_id
    GROUP BY entry_type
  ) type_counts
  CROSS JOIN (
    SELECT domain, COUNT(*) as domain_count
    FROM notebook_entries
    WHERE user_id = p_user_id AND domain IS NOT NULL
    GROUP BY domain
  ) domain_counts;
  
  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.notebook_entries TO authenticated;
GRANT ALL ON public.notebook_tags TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notebook_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notebook_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notebook_entry TO authenticated;

-- ============================================================================
-- 5. MIGRATE EXISTING DATA
-- ============================================================================

-- Migrate existing journal entries to notebook
INSERT INTO public.notebook_entries (user_id, entry_type, source_table, source_id, title, content, mood, occurred_at)
SELECT user_id, 'note', 'journal_entries', id, 'Journal entry', note, mood, created_at
FROM public.journal_entries
ON CONFLICT DO NOTHING;

-- Migrate existing tracker entries to notebook
INSERT INTO public.notebook_entries (user_id, entry_type, source_table, source_id, title, content, occurred_at)
SELECT te.user_id, 'tracker', 'tracker_entries', te.id, 'Tracker activity', te.data::text, te.logged_at
FROM public.tracker_entries te
ON CONFLICT DO NOTHING;

-- Migrate existing check-ins to notebook
INSERT INTO public.notebook_entries (user_id, entry_type, source_table, source_id, title, content, mood, occurred_at)
SELECT user_id, 'checkin', 'checkins', id, 'Daily Check-in', COALESCE(win_of_the_day, 'Checked in'), mood, checked_in_at
FROM public.checkins
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.notebook_entries IS 'Unified notebook feed aggregating all user activity';
COMMENT ON TABLE public.notebook_tags IS 'User-defined tags for organizing notebook entries';
COMMENT ON FUNCTION public.create_notebook_entry IS 'Trigger function to auto-create notebook entries';
COMMENT ON FUNCTION public.get_notebook_entries IS 'Query notebook entries with filters';
COMMENT ON FUNCTION public.get_notebook_stats IS 'Get notebook usage statistics';

SELECT 'Smart Notebook migrations completed successfully!' AS status;
