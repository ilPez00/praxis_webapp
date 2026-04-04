-- =============================================================================
-- 2026-04-04 — Create Duels Table for P2P Betting
-- =============================================================================
-- Enables betting against opponents: challenger creates duel, opponent matches stake.
-- Winner takes 1.8× their stake, loser forfeits.
-- =============================================================================

-- 1. Create the duels table (extending existing duels table from earlier migration)
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS stake_points INTEGER DEFAULT 100;
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS challenger_stake_locked BOOLEAN DEFAULT false;
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS opponent_stake_locked BOOLEAN DEFAULT false;
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS challenger_id UUID REFERENCES auth.users(id);
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS opponent_id UUID REFERENCES auth.users(id);
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS opponent_type TEXT DEFAULT 'random'; -- 'random' or 'specific'
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Update existing rows if needed
UPDATE public.duels SET challenger_id = creator_id WHERE challenger_id IS NULL;

-- 2. Create index for invite_code lookups
CREATE INDEX IF NOT EXISTS duels_invite_code_idx ON public.duels (invite_code);

-- 3. Function to generate invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
  SELECT upper(substring(md5(random()::text) from 1 for 8));
$$ LANGUAGE sql IMMUTABLE;

-- =============================================================================
-- End of Migration
-- =============================================================================
