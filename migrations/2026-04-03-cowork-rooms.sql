-- Co-working Rooms Migration
-- Adds co-working room support for real-time focus sessions

-- 1. Add coworker-specific columns to chat_rooms
ALTER TABLE chat_rooms 
ADD COLUMN IF NOT EXISTS is_cowork BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS current_session_start TIMESTAMP WITH TIME ZONE;

-- 2. Create cowork_sessions table
CREATE TABLE IF NOT EXISTS cowork_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  goal_domain VARCHAR(100),
  goal_description TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create cowork_participants for tracking who's in a cowork session
CREATE TABLE IF NOT EXISTS cowork_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  total_focus_minutes INTEGER DEFAULT 0,
  sessions_completed INTEGER DEFAULT 0,
  UNIQUE(room_id, user_id)
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_cowork_sessions_room ON cowork_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_cowork_sessions_user ON cowork_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_participants_room ON cowork_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_cowork_participants_active ON cowork_participants(room_id, is_active);

-- 5. Add RLS policies
ALTER TABLE cowork_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cowork_participants ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "cowork_sessions_read" ON cowork_sessions FOR SELECT USING (true);
CREATE POLICY "cowork_participants_read" ON cowork_participants FOR SELECT USING (true);

-- Users can insert their own sessions
CREATE POLICY "cowork_sessions_insert" ON cowork_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cowork_participants_insert" ON cowork_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own
CREATE POLICY "cowork_sessions_update" ON cowork_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cowork_participants_update" ON cowork_participants FOR UPDATE USING (auth.uid() = user_id);

-- 6. Function to get active coworkers in a room
CREATE OR REPLACE FUNCTION get_active_coworkers(p_room_id UUID)
RETURNS TABLE (
  user_id UUID,
  name VARCHAR(255),
  avatar_url TEXT,
  joined_at TIMESTAMP WITH TIME ZONE,
  total_focus_minutes INTEGER,
  sessions_completed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.user_id,
    p.name,
    p.avatar_url,
    cp.joined_at,
    cp.total_focus_minutes,
    cp.sessions_completed
  FROM cowork_participants cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE cp.room_id = p_room_id AND cp.is_active = true
  ORDER BY cp.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to get user's cowork stats
CREATE OR REPLACE FUNCTION get_user_cowork_stats(p_user_id UUID)
RETURNS TABLE (
  total_sessions INTEGER,
  total_minutes INTEGER,
  completed_sessions INTEGER,
  current_streak_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_sessions,
    COALESCE(SUM(duration_minutes), 0)::INTEGER AS total_minutes,
    COUNT(*) FILTER (WHERE completed = true)::INTEGER AS completed_sessions,
    0::INTEGER AS current_streak_days
  FROM cowork_sessions
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Seed default cowork room types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chat_room_types WHERE type = 'cowork') THEN
    INSERT INTO chat_room_types (type, label, description, created_at)
    VALUES ('cowork', 'Co-working Room', 'Focus together in timed sessions', NOW());
  END IF;
END $$;
