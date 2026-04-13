-- Push notification subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  keys       JSONB NOT NULL,  -- { p256dh, auth }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Push subs own" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS push_subs_user_idx ON public.push_subscriptions (user_id);
