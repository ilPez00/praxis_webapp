-- Predefined AI agents whitelist
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  icon_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-authorized AI agent API keys
CREATE TABLE public.agent_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id),
  api_key TEXT UNIQUE NOT NULL,
  scope TEXT[] DEFAULT ARRAY['read', 'write'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 year',
  revoked_at TIMESTAMPTZ
);

-- Temp codes for OAuth flow (single-use, 5min expiry)
CREATE TABLE public.agent_connect_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id),
  code TEXT UNIQUE NOT NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_keys_api_key ON public.agent_keys(api_key);
CREATE INDEX idx_agent_keys_user ON public.agent_keys(user_id);
CREATE INDEX idx_agent_connect_codes_code ON public.agent_connect_codes(code);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_connect_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "agents_select_all" ON public.agents;
CREATE POLICY "agents_select_all" ON public.agents FOR SELECT USING (true);

DROP POLICY IF EXISTS "agent_keys_user_select" ON public.agent_keys;
CREATE POLICY "agent_keys_user_select" ON public.agent_keys FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_keys_user_insert" ON public.agent_keys;
CREATE POLICY "agent_keys_user_insert" ON public.agent_keys FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_keys_user_delete" ON public.agent_keys;
CREATE POLICY "agent_keys_user_delete" ON public.agent_keys FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_connect_codes_user_insert" ON public.agent_connect_codes;
CREATE POLICY "agent_connect_codes_user_insert" ON public.agent_connect_codes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_connect_codes_user_select" ON public.agent_connect_codes;
CREATE POLICY "agent_connect_codes_user_select" ON public.agent_connect_codes FOR SELECT USING (auth.uid() = user_id);

-- Seed predefined agents
INSERT INTO public.agents (slug, name, website, description) VALUES
  ('openclaw', 'OpenClaw', 'https://openclaw-ai.net', 'Local-first AI agent gateway with 50+ platform integrations'),
  ('hermes', 'Hermes', 'https://hermes-agent.org', 'Open-source autonomous agent with persistent memory'),
  ('lindy', 'Lindy', 'https://lindy.ai', 'No-code AI automation platform'),
  ('relay', 'Relay.app', 'https://relay.app', 'Workflow automation with human checkpoints'),
  ('agentgpt', 'AgentGPT', 'https://agentgpt.so', 'Browser-based autonomous AI agent')
ON CONFLICT (slug) DO NOTHING;