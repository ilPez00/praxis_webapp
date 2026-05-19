-- Open bets: public challenges any user can join
CREATE TABLE IF NOT EXISTS public.open_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT,
  stake_points INTEGER NOT NULL DEFAULT 0,
  stake_euros NUMERIC(10,2),
  is_real_money BOOLEAN DEFAULT false,
  deadline TIMESTAMPTZ NOT NULL,
  max_participants INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.open_bet_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_bet_id UUID NOT NULL REFERENCES public.open_bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'withdrawn')),
  UNIQUE (open_bet_id, user_id)
);

-- RLS
ALTER TABLE public.open_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_bet_participants ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read open bets
CREATE POLICY "open_bets_read" ON public.open_bets
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Creator can update/delete their own
CREATE POLICY "open_bets_creator" ON public.open_bets
  FOR ALL USING (auth.uid() = creator_id);

-- Participants readable by authenticated users
CREATE POLICY "open_bet_participants_read" ON public.open_bet_participants
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can manage their own participation
CREATE POLICY "open_bet_participants_self" ON public.open_bet_participants
  FOR ALL USING (auth.uid() = user_id);

-- Service role bypass for backend resolution
CREATE POLICY "open_bets_service" ON public.open_bets
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "open_bet_participants_service" ON public.open_bet_participants
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS open_bets_status_idx ON public.open_bets (status);
CREATE INDEX IF NOT EXISTS open_bets_deadline_idx ON public.open_bets (deadline);
CREATE INDEX IF NOT EXISTS open_bets_creator_idx ON public.open_bets (creator_id);
CREATE INDEX IF NOT EXISTS open_bet_participants_bet_idx ON public.open_bet_participants (open_bet_id);
CREATE INDEX IF NOT EXISTS open_bet_participants_user_idx ON public.open_bet_participants (user_id);
