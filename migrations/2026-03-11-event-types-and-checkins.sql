-- Add type to events to match places tags
ALTER TABLE events ADD COLUMN IF NOT EXISTS type TEXT;

-- Create event_checkins table for verified attendees (via QR)
CREATE TABLE IF NOT EXISTS event_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;

-- Policies for event_checkins
CREATE POLICY "Users can view own checkins" ON event_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Creators can view all checkins for their events" ON event_checkins FOR SELECT 
  USING (EXISTS (SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid()));
