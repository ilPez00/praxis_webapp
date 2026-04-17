-- Migration: add_external_accounts_table.sql
-- Description: Stores OAuth tokens for external services like Google Calendar

CREATE TABLE IF NOT EXISTS public.external_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL, -- 'google'
  provider_id   TEXT NOT NULL, -- Google user ID
  email         TEXT,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  scopes        TEXT[],
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- RLS
ALTER TABLE public.external_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own external accounts"
  ON public.external_accounts FOR ALL
  USING (auth.uid() = user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_external_accounts_updated_at
    BEFORE UPDATE ON public.external_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Index
CREATE INDEX IF NOT EXISTS idx_external_accounts_user_provider ON public.external_accounts (user_id, provider);
