-- Migration: goal_maturity table — tracks maturity progression per goal node
-- Maturity levels per ayu.md: PERSONAL → SPECULATIVE → CANDIDATE → VALIDATED → COMMUNITY

CREATE TABLE IF NOT EXISTS public.goal_maturity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id     TEXT NOT NULL,  -- references a node id inside goal_trees.nodes JSON

  maturity    TEXT NOT NULL DEFAULT 'PERSONAL'
              CHECK (maturity IN ('PERSONAL','SPECULATIVE','CANDIDATE','VALIDATED','COMMUNITY')),

  -- Loop 1: Execution-Grade Feedback
  action_count     INTEGER NOT NULL DEFAULT 0,
  avg_grade        REAL,
  grade_trend      REAL,  -- positive = improving, negative = declining

  -- Loop 3: Belief Erosion Detection
  last_action_at   TIMESTAMP WITH TIME ZONE,
  dormant          BOOLEAN NOT NULL DEFAULT FALSE,
  dormant_since    TIMESTAMP WITH TIME ZONE,
  checkpoint_due   TIMESTAMP WITH TIME ZONE,  -- next 30-day checkpoint

  -- Loop 4: Grade-Reality Correction
  imposter_flag    BOOLEAN NOT NULL DEFAULT FALSE,  -- grades high, external signals low
  delusional_flag  BOOLEAN NOT NULL DEFAULT FALSE,  -- grades low, external signals high
  signal_divergence REAL,  -- abs(avg_grade - avg_external_signal_confidence)

  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (user_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_maturity_user ON public.goal_maturity(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_maturity_dormant ON public.goal_maturity(dormant) WHERE dormant = TRUE;
CREATE INDEX IF NOT EXISTS idx_goal_maturity_checkpoint ON public.goal_maturity(checkpoint_due);

ALTER TABLE public.goal_maturity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own maturity"   ON public.goal_maturity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own maturity" ON public.goal_maturity FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own maturity" ON public.goal_maturity FOR UPDATE USING (auth.uid() = user_id);

GRANT ALL ON public.goal_maturity TO authenticated;

COMMENT ON TABLE public.goal_maturity IS 'Goal maturity state per ayu.md four autopoietic loops';
