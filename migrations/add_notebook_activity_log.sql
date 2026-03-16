-- Migration: Add notebook_activity_log table for tracking all goal tree edits
-- Date: 2026-03-16

-- Notebook activity log table
CREATE TABLE IF NOT EXISTS public.notebook_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'goal_created', 
    'goal_updated', 
    'goal_deleted', 
    'goal_suspended', 
    'goal_resumed',
    'goal_completed',
    'chapter_created',
    'chapter_updated',
    'chapter_deleted'
  )),
  node_id UUID,
  node_name TEXT,
  domain TEXT,
  parent_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notebook_activity_user_time 
  ON public.notebook_activity_log(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_notebook_activity_node 
  ON public.notebook_activity_log(node_id);

CREATE INDEX IF NOT EXISTS idx_notebook_activity_type 
  ON public.notebook_activity_log(action_type);

-- RLS
ALTER TABLE public.notebook_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity log
CREATE POLICY "Users can view their own notebook activity"
  ON public.notebook_activity_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own activity (for frontend logging)
CREATE POLICY "Users can log their own notebook activity"
  ON public.notebook_activity_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.notebook_activity_log TO authenticated;

-- Comments
COMMENT ON TABLE public.notebook_activity_log IS 'Tracks all notebook hierarchy changes (add/remove/pause/update/etc.)';
COMMENT ON COLUMN public.notebook_activity_log.action_type IS 'Type of action: goal_created, goal_updated, goal_deleted, goal_suspended, goal_resumed, goal_completed, chapter_created, chapter_updated, chapter_deleted';
COMMENT ON COLUMN public.notebook_activity_log.old_value IS 'Previous state of the node (for updates)';
COMMENT ON COLUMN public.notebook_activity_log.new_value IS 'New state of the node (for updates)';
COMMENT ON COLUMN public.notebook_activity_log.metadata IS 'Additional context (e.g., UI location, user agent, etc.)';
