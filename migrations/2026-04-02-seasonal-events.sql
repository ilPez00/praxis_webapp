-- Seasonal Events Framework
-- Supports limited-time challenges with progress tracking and rewards

CREATE TABLE IF NOT EXISTS seasonal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  theme_color VARCHAR(20) DEFAULT '#F59E0B',
  icon VARCHAR(50) DEFAULT '🎯',
  event_type VARCHAR(50) NOT NULL, -- 'streak_challenge', 'goal_crusher', 'participation', 'betting'
  
  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  
  -- Goals & Rewards
  target_value INTEGER NOT NULL, -- e.g., 30 days, 10 goals
  target_metric VARCHAR(50) NOT NULL, -- 'streak_days', 'goals_completed', 'checkins', 'bets_won'
  reward_pp INTEGER DEFAULT 0,
  reward_xp INTEGER DEFAULT 0,
  reward_badge VARCHAR(100),
  
  -- Participation tracking
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User participation in events
CREATE TABLE IF NOT EXISTS seasonal_event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES seasonal_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  progress INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reward_claimed BOOLEAN DEFAULT false,
  UNIQUE(event_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seasonal_events_active ON seasonal_events(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_event_participants_user ON seasonal_event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON seasonal_event_participants(event_id);

-- RLS Policies
ALTER TABLE seasonal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_event_participants ENABLE ROW LEVEL SECURITY;

-- Everyone can read events
CREATE POLICY "Public read seasonal events" ON seasonal_events
  FOR SELECT USING (true);

-- Users can manage their own participation
CREATE POLICY "Users manage own participation" ON seasonal_event_participants
  FOR ALL USING (user_id = auth.uid());
