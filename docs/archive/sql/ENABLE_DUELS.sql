-- Enable Duels Feature - Quick Setup
-- Run this in Supabase SQL Editor to ensure duels are enabled

-- 1. Check if duels table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'duels') THEN
    RAISE NOTICE 'Creating duels table...';
    
    -- Create the duels table
    CREATE TABLE public.duels (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      creator_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      opponent_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      goal_node_id        TEXT,
      title               TEXT NOT NULL,
      description         TEXT,
      category            TEXT NOT NULL,
      stake_pp            INT NOT NULL DEFAULT 50,
      deadline_days       INT NOT NULL DEFAULT 7,
      deadline            DATE NOT NULL,
      status              TEXT NOT NULL DEFAULT 'open',
      won_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      creator_claimed     BOOLEAN NOT NULL DEFAULT false,
      opponent_claimed    BOOLEAN NOT NULL DEFAULT false,
      creator_claimed_at  TIMESTAMPTZ,
      opponent_claimed_at TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Duels table already exists!';
  END IF;
END $$;

-- 2. Create RLS Policies (if not exist)
DO $$
BEGIN
  -- Anyone can read duels
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'duels' AND policyname = 'Duels read all') THEN
    CREATE POLICY "Duels read all" ON public.duels FOR SELECT USING (true);
  END IF;
  
  -- Only creator can insert
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'duels' AND policyname = 'Duels insert own') THEN
    CREATE POLICY "Duels insert own" ON public.duels FOR INSERT WITH CHECK (auth.uid() = creator_id);
  END IF;
  
  -- Only participants can update
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'duels' AND policyname = 'Duels update party') THEN
    CREATE POLICY "Duels update party" ON public.duels FOR UPDATE
      USING (auth.uid() = creator_id OR auth.uid() = opponent_id);
  END IF;
END $$;

-- 3. Create indexes (if not exist)
CREATE INDEX IF NOT EXISTS duels_status_idx ON public.duels (status);
CREATE INDEX IF NOT EXISTS duels_category_idx ON public.duels (category);
CREATE INDEX IF NOT EXISTS duels_creator_idx ON public.duels (creator_id);
CREATE INDEX IF NOT EXISTS duels_opponent_idx ON public.duels (opponent_id);
CREATE INDEX IF NOT EXISTS duels_created_at_idx ON public.duels (created_at DESC);

-- 4. Ensure profiles have praxis_points column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS praxis_points INT DEFAULT 100;

-- 5. Verification
DO $$
DECLARE
  duel_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duel_count FROM public.duels;
  RAISE NOTICE '✅ Duels feature enabled! Current duels: %', duel_count;
END $$;

-- Query to check your duels
-- SELECT * FROM public.duels ORDER BY created_at DESC LIMIT 10;
