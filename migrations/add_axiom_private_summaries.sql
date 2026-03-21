-- Migration: Add axiom_private_summaries table
-- Purpose: Store private Axiom summaries visible only to admins and Axiom
-- Benefits: Prevents re-reading same material across multiple scans

CREATE TABLE IF NOT EXISTS public.axiom_private_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary JSONB NOT NULL,
  last_processed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one summary per user (upsert pattern)
  UNIQUE(user_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_axiom_summaries_user ON public.axiom_private_summaries(user_id);
CREATE INDEX idx_axiom_summaries_processed ON public.axiom_private_summaries(last_processed_at);

-- RLS Policies
ALTER TABLE public.axiom_private_summaries ENABLE ROW LEVEL SECURITY;

-- Users can only see their own summary (but in practice, only Axiom reads this)
CREATE POLICY "Users can view own summary"
  ON public.axiom_private_summaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all summaries
CREATE POLICY "Admins can view all summaries"
  ON public.axiom_private_summaries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'is_admin')::boolean = true
    )
  );

-- Service role (Axiom) can insert/update all summaries
CREATE POLICY "Service role can manage all summaries"
  ON public.axiom_private_summaries
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Grant permissions
GRANT SELECT ON public.axiom_private_summaries TO authenticated;
GRANT ALL ON public.axiom_private_summaries TO service_role;

-- Comment
COMMENT ON TABLE public.axiom_private_summaries IS 'Private Axiom summaries - visible only to admins and Axiom service';
COMMENT ON COLUMN public.axiom_private_summaries.summary IS 'Contains: recent_themes, recent_achievements, recent_challenges, mood_patterns, activity_summary, insights';
