-- Axiom Provider Health Tracking
-- Tracks provider health check results for the admin panel.
-- Each row records the last health check result for one provider.

CREATE TABLE IF NOT EXISTS axiom_provider_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  reachable BOOLEAN DEFAULT FALSE,
  latency_ms INTEGER,
  error TEXT,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axiom_provider_health_name ON axiom_provider_health(provider_name);
CREATE INDEX IF NOT EXISTS idx_axiom_provider_health_last_checked ON axiom_provider_health(last_checked_at);

-- Enable RLS (no public access — admin-only via API)
ALTER TABLE axiom_provider_health ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (used by backend)
CREATE POLICY "service_role all" ON axiom_provider_health
  FOR ALL TO service_role USING (true) WITH CHECK (true);
