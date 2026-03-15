-- Diary Entries System Migrations
-- Run this AFTER migrations.final.sql
-- All statements are IDEMPOTENT (safe to run multiple times)

-- ============================================================================
-- 1. DIARY ENTRIES TABLE (Unified saved moments)
-- ============================================================================

-- Main diary entries table (polymorphic - references all content types)
CREATE TABLE IF NOT EXISTS public.diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Content type (what kind of entry is this?)
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'note',           -- Manual note/thought
    'user',           -- Saved user/person
    'message',        -- Saved message/conversation
    'post',           -- Saved post
    'place',          -- Saved place/location
    'event',          -- Saved event
    'goal',           -- Saved goal reference
    'achievement',    -- Saved achievement
    'link',           -- Saved link/URL
    'photo',          -- Saved photo
    'voice_note',     -- Voice memo
    'quote'           -- Saved quote
  )),
  
  -- Polymorphic reference to source content
  source_table TEXT,  -- e.g., 'posts', 'profiles', 'places', 'events', 'messages'
  source_id UUID,     -- ID of the source record
  
  -- Content
  title TEXT,         -- Optional title
  content TEXT,       -- Main content/note
  metadata JSONB DEFAULT '{}'::jsonb,  -- Additional data (url, image, etc.)
  
  -- Geolocation
  latitude DECIMAL(10, 8),   -- -90 to 90
  longitude DECIMAL(11, 8),  -- -180 to 180
  location_name TEXT,        -- Human-readable location name
  location_accuracy INTEGER, -- Accuracy in meters
  
  -- Organization
  tags TEXT[],        -- Array of tags
  mood TEXT,          -- Mood/emotion at time of saving
  is_private BOOLEAN DEFAULT true,  -- Private by default
  is_pinned BOOLEAN DEFAULT false,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),  -- When the moment occurred
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table exists but columns missing
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'diary_entries') THEN
    -- Add missing columns one by one
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'diary_entries' AND column_name = 'latitude') THEN
      ALTER TABLE public.diary_entries ADD COLUMN latitude DECIMAL(10, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'diary_entries' AND column_name = 'longitude') THEN
      ALTER TABLE public.diary_entries ADD COLUMN longitude DECIMAL(11, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'diary_entries' AND column_name = 'location_name') THEN
      ALTER TABLE public.diary_entries ADD COLUMN location_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'diary_entries' AND column_name = 'location_accuracy') THEN
      ALTER TABLE public.diary_entries ADD COLUMN location_accuracy INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'diary_entries' AND column_name = 'metadata') THEN
      ALTER TABLE public.diary_entries ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'diary_entries' AND column_name = 'tags') THEN
      ALTER TABLE public.diary_entries ADD COLUMN tags TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'diary_entries' AND column_name = 'is_pinned') THEN
      ALTER TABLE public.diary_entries ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;
  ELSE
    -- Table doesn't exist, create it fresh
    CREATE TABLE public.diary_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL,
      source_table TEXT,
      source_id UUID,
      title TEXT,
      content TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      location_name TEXT,
      location_accuracy INTEGER,
      tags TEXT[],
      mood TEXT,
      is_private BOOLEAN DEFAULT true,
      is_pinned BOOLEAN DEFAULT false,
      occurred_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own diary entries" ON public.diary_entries;
CREATE POLICY "Users can view own diary entries" ON public.diary_entries 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own diary entries" ON public.diary_entries;
CREATE POLICY "Users can insert own diary entries" ON public.diary_entries 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own diary entries" ON public.diary_entries;
CREATE POLICY "Users can update own diary entries" ON public.diary_entries 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own diary entries" ON public.diary_entries;
CREATE POLICY "Users can delete own diary entries" ON public.diary_entries 
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_diary_user ON public.diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_type ON public.diary_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_diary_occurred ON public.diary_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_location ON public.diary_entries(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_diary_tags ON public.diary_entries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_diary_source ON public.diary_entries(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_diary_pinned ON public.diary_entries(is_pinned);

-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================

-- Function to get diary entries with filters
CREATE OR REPLACE FUNCTION public.get_diary_entries(
  p_user_id UUID,
  p_entry_type TEXT DEFAULT NULL,
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
  metadata JSONB,
  latitude DECIMAL,
  longitude DECIMAL,
  location_name TEXT,
  tags TEXT[],
  mood TEXT,
  source_table TEXT,
  source_id UUID,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  is_pinned BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.entry_type,
    de.title,
    de.content,
    de.metadata,
    de.latitude,
    de.longitude,
    de.location_name,
    de.tags,
    de.mood,
    de.source_table,
    de.source_id,
    de.occurred_at,
    de.created_at,
    de.is_pinned
  FROM public.diary_entries de
  WHERE de.user_id = p_user_id
    AND de.is_private = true  -- Only private entries for now
    AND (p_entry_type IS NULL OR de.entry_type = p_entry_type)
    AND (p_tag IS NULL OR p_tag = ANY(de.tags))
    AND (p_search IS NULL OR de.content ILIKE '%' || p_search || '%' OR de.title ILIKE '%' || p_search || '%')
  ORDER BY de.is_pinned DESC, de.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get diary stats for user
CREATE OR REPLACE FUNCTION public.get_diary_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_entries', COUNT(*),
    'by_type', (
      SELECT jsonb_object_agg(entry_type, cnt)
      FROM (
        SELECT entry_type, COUNT(*) as cnt
        FROM diary_entries
        WHERE user_id = p_user_id
        GROUP BY entry_type
      ) type_counts
    ),
    'recent_tags', (
      SELECT jsonb_agg(tag) FROM (
        SELECT unnest(tags) as tag, COUNT(*) as cnt
        FROM diary_entries
        WHERE user_id = p_user_id
        GROUP BY tag
        ORDER BY cnt DESC
        LIMIT 10
      ) tags
    ),
    'with_location', (
      SELECT COUNT(*) FROM diary_entries
      WHERE user_id = p_user_id AND latitude IS NOT NULL
    ),
    'streak_days', (
      SELECT COUNT(DISTINCT DATE(occurred_at))
      FROM diary_entries
      WHERE user_id = p_user_id
      AND occurred_at >= NOW() - INTERVAL '30 days'
    )
  )
  INTO v_stats;
  
  RETURN COALESCE(v_stats, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. AUTOMATIC DIARY ENTRY CREATION (Optional triggers)
-- ============================================================================

-- Function to create diary entry from shared content
CREATE OR REPLACE FUNCTION public.create_diary_entry_from_share()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_content TEXT;
  v_title TEXT;
  v_metadata JSONB;
BEGIN
  -- Determine entry type and content based on source table
  CASE TG_TABLE_NAME
    WHEN 'posts' THEN
      v_entry_type := 'post';
      v_content := NEW.content;
      v_title := 'Saved post';
      v_metadata := jsonb_build_object('shared_from', 'post');
    WHEN 'profiles' THEN
      v_entry_type := 'user';
      v_content := COALESCE(NEW.bio, '');
      v_title := 'Saved user: ' || COALESCE(NEW.name, 'Unknown');
      v_metadata := jsonb_build_object('shared_from', 'profile');
    WHEN 'messages' THEN
      v_entry_type := 'message';
      v_content := NEW.content;
      v_title := 'Saved message';
      v_metadata := jsonb_build_object('shared_from', 'message');
    ELSE
      v_entry_type := 'note';
      v_content := 'Entry created';
      v_title := 'Saved item';
      v_metadata := '{}'::jsonb;
  END CASE;
  
  -- Insert into diary (only if explicitly marked for diary saving)
  -- This trigger is for demonstration - actual saving should be user-initiated
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. GRANTS
-- ============================================================================

GRANT ALL ON public.diary_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_diary_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_diary_stats TO authenticated;

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.diary_entries IS 'Personal diary entries - saved moments, people, places, and thoughts';
COMMENT ON COLUMN public.diary_entries.entry_type IS 'Type of entry: note, user, message, post, place, event, goal, achievement, link, photo, voice_note, quote';
COMMENT ON COLUMN public.diary_entries.source_table IS 'Original table this was shared from (posts, profiles, etc.)';
COMMENT ON COLUMN public.diary_entries.source_id IS 'ID of the original record';
COMMENT ON COLUMN public.diary_entries.latitude IS 'Latitude coordinate (-90 to 90)';
COMMENT ON COLUMN public.diary_entries.longitude IS 'Longitude coordinate (-180 to 180)';
COMMENT ON COLUMN public.diary_entries.location_name IS 'Human-readable location name (e.g., "Home", "Office")';
COMMENT ON COLUMN public.diary_entries.metadata IS 'Additional JSONB data (URLs, images, etc.)';
COMMENT ON FUNCTION public.get_diary_entries IS 'Query diary entries with filters';
COMMENT ON FUNCTION public.get_diary_stats IS 'Get diary usage statistics';

SELECT 'Diary Entries System migrations completed successfully!' AS status;
