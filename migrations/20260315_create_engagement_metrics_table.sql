-- Migration: Create engagement_metrics table
-- Purpose: Cache user engagement metrics for 24h to avoid recalculation
-- Created: 2026-03-15

CREATE TABLE IF NOT EXISTS engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metrics JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_metrics UNIQUE (user_id)
);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_user_id 
  ON engagement_metrics(user_id);

-- Index for cleanup (find expired records)
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_expires_at 
  ON engagement_metrics(expires_at);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_engagement_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_engagement_metrics_updated_at ON engagement_metrics;

CREATE TRIGGER update_engagement_metrics_updated_at
  BEFORE UPDATE ON engagement_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_engagement_metrics_updated_at();

-- Grant access to authenticated users (read own metrics only)
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own engagement metrics" ON engagement_metrics;
CREATE POLICY "Users can view own engagement metrics"
  ON engagement_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all metrics
DROP POLICY IF EXISTS "Service role can manage all metrics" ON engagement_metrics;
CREATE POLICY "Service role can manage all metrics"
  ON engagement_metrics
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Cleanup function for expired metrics (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_engagement_metrics()
RETURNS void AS $$
BEGIN
  DELETE FROM engagement_metrics
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment
COMMENT ON TABLE engagement_metrics IS 
  'Caches user engagement metrics for 24h. Metrics are calculated from behavioral patterns only (no content scanning).';

COMMENT ON COLUMN engagement_metrics.metrics IS 
  'JSONB containing: archetype, motivationStyle, riskFactors, checkinStreak, weeklyActivityScore, etc.';
