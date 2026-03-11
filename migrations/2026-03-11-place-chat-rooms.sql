ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES public.places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_rooms_place ON public.chat_rooms(place_id);
