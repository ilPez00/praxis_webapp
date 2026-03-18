-- Migration: Comprehensive Notebook Fix
-- Fixes: 
-- 1. get_notebook_entries RPC (type mismatch for source_id/goal_id)
-- 2. get_notebook_stats (broken stats when domains/types are empty)
-- 3. create_notebook_entry trigger (added 'bets' table support)

-- 1. Fix get_notebook_entries RPC
CREATE OR REPLACE FUNCTION public.get_notebook_entries(
  p_user_id UUID,
  p_entry_type TEXT DEFAULT NULL,
  p_goal_id TEXT DEFAULT NULL, 
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
  goal_id TEXT, 
  domain TEXT,
  source_table TEXT,
  source_id TEXT, 
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
    ne.goal_id::TEXT, 
    ne.domain,
    ne.source_table,
    ne.source_id,
    ne.occurred_at,
    ne.created_at,
    ne.is_pinned
  FROM public.notebook_entries ne
  WHERE ne.user_id = p_user_id
    AND (p_entry_type IS NULL OR ne.entry_type = p_entry_type)
    AND (p_goal_id IS NULL OR ne.goal_id::TEXT = p_goal_id)
    AND (p_domain IS NULL OR ne.domain = p_domain)
    AND (p_tag IS NULL OR p_tag = ANY(ne.tags))
    AND (p_search IS NULL OR ne.content ILIKE '%' || p_search || '%')
  ORDER BY ne.is_pinned DESC, ne.occurred_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix get_notebook_stats (avoid CROSS JOIN issues)
CREATE OR REPLACE FUNCTION public.get_notebook_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_entries BIGINT;
  v_type_counts JSONB;
  v_domain_counts JSONB;
  v_recent_tags JSONB;
  v_streak_days BIGINT;
BEGIN
  -- Total
  SELECT COUNT(*) INTO v_total_entries FROM notebook_entries WHERE user_id = p_user_id;
  
  -- By Type
  SELECT jsonb_object_agg(entry_type, count) INTO v_type_counts
  FROM (SELECT entry_type, COUNT(*) as count FROM notebook_entries WHERE user_id = p_user_id GROUP BY entry_type) t;
  
  -- By Domain
  SELECT jsonb_object_agg(domain, domain_count) INTO v_domain_counts
  FROM (SELECT domain, COUNT(*) as domain_count FROM notebook_entries WHERE user_id = p_user_id AND domain IS NOT NULL GROUP BY domain) d;
  
  -- Tags
  SELECT jsonb_agg(tag) INTO v_recent_tags 
  FROM (
    SELECT unnest(tags) as tag, COUNT(*) as cnt
    FROM notebook_entries
    WHERE user_id = p_user_id
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 10
  ) tags;
  
  -- Streak
  SELECT COUNT(DISTINCT DATE(occurred_at)) INTO v_streak_days
  FROM notebook_entries
  WHERE user_id = p_user_id
  AND occurred_at >= NOW() - INTERVAL '30 days';

  RETURN jsonb_build_object(
    'total_entries', COALESCE(v_total_entries, 0),
    'by_type', COALESCE(v_type_counts, '{}'::jsonb),
    'by_domain', COALESCE(v_domain_counts, '{}'::jsonb),
    'recent_tags', COALESCE(v_recent_tags, '[]'::jsonb),
    'streak_days', COALESCE(v_streak_days, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update create_notebook_entry trigger to include bets
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
      v_goal_id := v_new->>'node_id';
    WHEN 'node_journal_entries' THEN
      v_entry_type := 'note';
      v_content := v_new->>'note';
      v_title := 'Goal note';
      v_mood := v_new->>'mood';
      v_goal_id := v_new->>'node_id';
    WHEN 'bets' THEN
      v_entry_type := 'bet';
      v_content := 'Committed ' || (v_new->>'stake_points') || ' PP to goal: ' || (v_new->>'goal_name');
      v_title := 'New Accountability Bet';
      v_goal_id := v_new->>'goal_node_id';
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
    (v_new->>'deadline')::TIMESTAMPTZ,
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

-- 4. Ensure bets table has the trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_notebook_bet') THEN
    CREATE TRIGGER trig_notebook_bet
    AFTER INSERT ON public.bets
    FOR EACH ROW EXECUTE FUNCTION public.create_notebook_entry();
  END IF;
END $$;
