-- =============================================================================
-- 2026-03-16 — Create Duels Table for P2P Challenges
-- =============================================================================
-- This migration enables the duels feature: peer-to-peer challenges with
-- Praxis Points (PP) stakes. Users can create open challenges or challenge
-- specific opponents. Winner takes the pot minus a 5% house fee.
-- =============================================================================

-- 1. Ensure praxis_points column exists on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS praxis_points INT DEFAULT 100;

-- 2. Create the duels table
CREATE TABLE IF NOT EXISTS public.duels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  goal_node_id        TEXT,                   -- Reference to specific goal node
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL,          -- goal domain / category
  stake_pp            INT  NOT NULL DEFAULT 50,
  deadline_days       INT  NOT NULL DEFAULT 7,
  deadline            DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open',
    -- open: public, anyone can accept
    -- pending: direct challenge awaiting response
    -- active: accepted, in progress
    -- completed: resolved, winner set
    -- declined: opponent declined
    -- cancelled: creator cancelled before acceptance
  won_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  creator_claimed     BOOLEAN NOT NULL DEFAULT false,
  opponent_claimed    BOOLEAN NOT NULL DEFAULT false,
  creator_claimed_at  TIMESTAMPTZ,
  opponent_claimed_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Anyone can read duels (public feed)
DROP POLICY IF EXISTS "Duels read all" ON public.duels;
CREATE POLICY "Duels read all" ON public.duels FOR SELECT USING (true);

-- Only the creator can insert (create) a duel
DROP POLICY IF EXISTS "Duels insert own" ON public.duels;
CREATE POLICY "Duels insert own" ON public.duels FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Only participants can update their own duel
DROP POLICY IF EXISTS "Duels update party" ON public.duels;
CREATE POLICY "Duels update party" ON public.duels FOR UPDATE
  USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS duels_status_idx    ON public.duels (status);
CREATE INDEX IF NOT EXISTS duels_category_idx  ON public.duels (category);
CREATE INDEX IF NOT EXISTS duels_creator_idx   ON public.duels (creator_id);
CREATE INDEX IF NOT EXISTS duels_opponent_idx  ON public.duels (opponent_id);
CREATE INDEX IF NOT EXISTS duels_created_at_idx ON public.duels (created_at DESC);

-- =============================================================================
-- End of Migration
-- =============================================================================
