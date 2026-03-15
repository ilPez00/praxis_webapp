-- Migration: Add journal_entries and goal_progress_history tables
-- Run this on your Supabase SQL Editor

-- Journal entries table for notes
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id UUID,
  note TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for calendar queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date 
  ON public.journal_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_node 
  ON public.journal_entries(node_id);

-- Goal progress history table
CREATE TABLE IF NOT EXISTS public.goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  node_id UUID NOT NULL,
  node_name TEXT,
  domain TEXT,
  old_progress INTEGER,
  new_progress INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for calendar queries
CREATE INDEX IF NOT EXISTS idx_goal_progress_history_user_date 
  ON public.goal_progress_history(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_goal_progress_history_node 
  ON public.goal_progress_history(node_id);

-- Add updated_at to goal_trees nodes (if not exists)
-- Note: This requires altering the JSONB structure, so we'll track via a trigger instead

-- Trigger to auto-log goal progress changes
CREATE OR REPLACE FUNCTION public.log_goal_progress_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if progress actually changed
  IF (NEW.nodes IS DISTINCT FROM OLD.nodes) THEN
    -- Extract changed nodes and log them
    -- This is a simplified version - you may want more sophisticated diff logic
    INSERT INTO public.goal_progress_history (user_id, node_id, node_name, domain, new_progress, timestamp)
    SELECT 
      NEW.user_id,
      node->>'id' as node_id,
      node->>'name' as node_name,
      node->>'domain' as domain,
      (node->>'progress')::INTEGER as new_progress,
      NOW()
    FROM jsonb_array_elements(NEW.nodes) as node
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(OLD.nodes) as old_node 
      WHERE old_node->>'id' = node->>'id' 
      AND old_node->>'progress' = node->>'progress'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on goal_trees
DROP TRIGGER IF EXISTS on_goal_progress_change ON public.goal_trees;
CREATE TRIGGER on_goal_progress_change
  AFTER UPDATE ON public.goal_trees
  FOR EACH ROW
  EXECUTE FUNCTION public.log_goal_progress_change();

-- RLS Policies for journal_entries
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journal entries"
  ON public.journal_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own journal entries"
  ON public.journal_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journal entries"
  ON public.journal_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journal entries"
  ON public.journal_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for goal_progress_history
ALTER TABLE public.goal_progress_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal history"
  ON public.goal_progress_history
  FOR SELECT
  USING (user_id = auth.uid());

-- Grant permissions to authenticated users
GRANT ALL ON public.journal_entries TO authenticated;
GRANT ALL ON public.goal_progress_history TO authenticated;

-- Comment
COMMENT ON TABLE public.journal_entries IS 'Stores user journal/note entries for offline sync and calendar view';
COMMENT ON TABLE public.goal_progress_history IS 'Tracks goal progress changes over time for analytics and calendar';
