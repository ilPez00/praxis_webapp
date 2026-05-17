-- Migration: Create action_records table (ayu.md action schema)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.action_records (
  -- identity
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id     UUID NOT NULL DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- classification
  domain        TEXT NOT NULL CHECK (domain IN ('FABRICATE','STUDY','CONSTRUCT','BOND','HEAL')),
  mode          TEXT NOT NULL CHECK (mode IN ('LIFT','WALK','WORK','LEARN','CODE','CREATE','REST')),
  scope         TEXT NOT NULL DEFAULT 'PERSONAL' CHECK (scope IN ('PERSONAL','COLLABORATIVE','COMMUNAL')),

  -- execution
  duration_min  INTEGER NOT NULL DEFAULT 0,
  trigger       TEXT NOT NULL DEFAULT 'SELF' CHECK (trigger IN ('PROPOSAL','SELF','EXTERNAL')),
  action_text   TEXT NOT NULL,

  -- assessment
  grade         REAL CHECK (grade >= 0.0 AND grade <= 1.0),
  grade_rationale TEXT CHECK (grade_rationale IN ('COMPLETENESS','EFFORT','OUTCOME','CONSISTENCY')),
  tags          TEXT[] DEFAULT '{}',

  -- validation
  goal_id       UUID,
  external_signals JSONB DEFAULT '[]',

  -- collaboration
  outcome_type  TEXT CHECK (outcome_type IN ('COMPLETION','PROGRESS','DISCOVERY','MAINTENANCE')),
  collaborators UUID[] DEFAULT '{}',

  -- metadata
  location      TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_action_records_user       ON public.action_records(user_id);
CREATE INDEX IF NOT EXISTS idx_action_records_user_time  ON public.action_records(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_action_records_domain     ON public.action_records(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_action_records_goal       ON public.action_records(goal_id) WHERE goal_id IS NOT NULL;

-- RLS
ALTER TABLE public.action_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own action records"
  ON public.action_records FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own action records"
  ON public.action_records FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own action records"
  ON public.action_records FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own action records"
  ON public.action_records FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.action_records TO authenticated;

COMMENT ON TABLE public.action_records IS 'Action records per ayu.md schema — the PDCA action primitive';
