-- ============================================================================
-- AXIOM NARRATIVES TABLE - Auto-save all AI narratives
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Create table to store all Axiom narratives
CREATE TABLE IF NOT EXISTS public.axiom_narratives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  narrative_type TEXT NOT NULL CHECK (narrative_type IN ('daily_brief', 'weekly_narrative', 'ai_response', 'notebook')),
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  source TEXT CHECK (source IN ('llm', 'algorithm')),
  pp_cost INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_axiom_narratives_user_date
  ON public.axiom_narratives(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_axiom_narratives_type
  ON public.axiom_narratives(user_id, narrative_type);

-- RLS Policies
ALTER TABLE public.axiom_narratives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own narratives" ON public.axiom_narratives;
DROP POLICY IF EXISTS "Users can insert own narratives" ON public.axiom_narratives;
DROP POLICY IF EXISTS "Users can delete own narratives" ON public.axiom_narratives;

CREATE POLICY "Users can view own narratives" ON public.axiom_narratives
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own narratives" ON public.axiom_narratives
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own narratives" ON public.axiom_narratives
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.axiom_narratives TO authenticated;

-- Comment
COMMENT ON TABLE public.axiom_narratives IS 'Stores all Axiom AI narratives, daily briefs, and coaching responses for download';
