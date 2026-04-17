-- Live Streaming tables
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.streams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Live Stream',
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  stream_type   TEXT NOT NULL DEFAULT 'camera' CHECK (stream_type IN ('camera', 'screen')),
  viewer_count  INT NOT NULL DEFAULT 0,
  peak_viewers  INT NOT NULL DEFAULT 0,
  total_honors  INT NOT NULL DEFAULT 0,
  room_id       UUID REFERENCES public.chat_rooms(id) ON DELETE SET NULL,  -- if streaming in a group
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streams visible to all" ON public.streams
  FOR SELECT USING (true);

CREATE POLICY "Users manage own streams" ON public.streams
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_streams_status ON public.streams (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_user ON public.streams (user_id, status);
CREATE INDEX IF NOT EXISTS idx_streams_room ON public.streams (room_id) WHERE room_id IS NOT NULL;

-- Stream donations (honor points sent during stream)
CREATE TABLE IF NOT EXISTS public.stream_donations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  donor_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      INT NOT NULL CHECK (amount > 0),
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stream_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donations visible to all" ON public.stream_donations
  FOR SELECT USING (true);

CREATE POLICY "Users create own donations" ON public.stream_donations
  FOR INSERT WITH CHECK (auth.uid() = donor_id);

CREATE INDEX IF NOT EXISTS idx_stream_donations_stream ON public.stream_donations (stream_id, created_at DESC);
