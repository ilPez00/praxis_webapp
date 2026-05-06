-- Session 61: Axiom Persona + Life Domain Matching
-- Run in Supabase SQL Editor

-- 1. Axiom Persona table (nightly behavioral fingerprint)
CREATE TABLE IF NOT EXISTS public.axiom_persona (
  user_id            UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  true_will_domains  TEXT[]      DEFAULT '{}',
  stated_domains     TEXT[]      DEFAULT '{}',
  divergence_insight TEXT,
  emotional_profile  JSONB       DEFAULT '{}',
  avoidance_patterns TEXT[]      DEFAULT '{}',
  connection_intent  TEXT[]      DEFAULT '{}',
  life_stage         TEXT,
  computed_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.axiom_persona ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own persona" ON public.axiom_persona;
CREATE POLICY "Users read own persona" ON public.axiom_persona
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Profile extensions for life domain matching
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS connection_intent TEXT[]  DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS life_stage        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_links      JSONB   DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seeking_description TEXT;

-- 3. Index for matching by connection_intent overlap
CREATE INDEX IF NOT EXISTS idx_profiles_connection_intent ON public.profiles USING GIN (connection_intent);
CREATE INDEX IF NOT EXISTS idx_axiom_persona_user_id ON public.axiom_persona (user_id);
