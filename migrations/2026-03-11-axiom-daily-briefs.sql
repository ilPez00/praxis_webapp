-- 32. axiom_daily_briefs — Midnight automated scan results
CREATE TABLE IF NOT EXISTS axiom_daily_briefs (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  brief JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- Enable RLS
ALTER TABLE axiom_daily_briefs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own daily briefs
CREATE POLICY "Users can view own daily brief" 
  ON axiom_daily_briefs FOR SELECT 
  USING (auth.uid() = user_id);
