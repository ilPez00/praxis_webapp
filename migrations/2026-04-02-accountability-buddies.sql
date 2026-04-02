-- Accountability Buddy System
-- Partners check in together for bonus XP and mutual accountability

-- Buddy pairs table
CREATE TABLE IF NOT EXISTS accountability_buddies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'paused'
  
  -- Stats
  mutual_checkin_streak INTEGER DEFAULT 0,
  longest_mutual_streak INTEGER DEFAULT 0,
  total_buddy_days INTEGER DEFAULT 0,
  
  -- Settings
  reminder_time TIME DEFAULT '20:00', -- Daily reminder time
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(requester_id, receiver_id),
  CHECK (requester_id != receiver_id)
);

-- Daily buddy check-ins (tracks who checked in with their buddy each day)
CREATE TABLE IF NOT EXISTS buddy_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buddy_pair_id UUID NOT NULL REFERENCES accountability_buddies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(buddy_pair_id, user_id, checkin_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buddy_pairs_requester ON accountability_buddies(requester_id);
CREATE INDEX IF NOT EXISTS idx_buddy_pairs_receiver ON accountability_buddies(receiver_id);
CREATE INDEX IF NOT EXISTS idx_buddy_pairs_status ON accountability_buddies(status);
CREATE INDEX IF NOT EXISTS idx_buddy_checkins_pair ON buddy_checkins(buddy_pair_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_buddy_checkins_user ON buddy_checkins(user_id);

-- RLS Policies
ALTER TABLE accountability_buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_checkins ENABLE ROW LEVEL SECURITY;

-- Users can manage their own buddy relationships
CREATE POLICY "Users manage own buddy requests" ON accountability_buddies
  FOR ALL USING (requester_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users see their buddy checkins" ON buddy_checkins
  FOR SELECT USING (user_id = auth.uid() OR user_id IN (
    SELECT receiver_id FROM accountability_buddies WHERE requester_id = auth.uid() AND status = 'accepted'
    UNION
    SELECT requester_id FROM accountability_buddies WHERE receiver_id = auth.uid() AND status = 'accepted'
  ));

CREATE POLICY "Users create their own checkins" ON buddy_checkins
  FOR INSERT WITH CHECK (user_id = auth.uid());
