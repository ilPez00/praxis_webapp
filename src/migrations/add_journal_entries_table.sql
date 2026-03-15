-- Migration: Create journal_entries table for goal notes
-- Run this on your Supabase SQL Editor

-- Journal entries table (for goal-specific notes)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL,
  note TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_node 
  ON public.journal_entries(user_id, node_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date 
  ON public.journal_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_node 
  ON public.journal_entries(node_id);

-- RLS Policies
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

-- Grant permissions to authenticated users
GRANT ALL ON public.journal_entries TO authenticated;

-- Comment
COMMENT ON TABLE public.journal_entries IS 'Stores user journal/note entries for goals';
