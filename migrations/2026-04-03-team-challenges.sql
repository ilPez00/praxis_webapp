-- Team Challenges Migration
-- Adds team support to challenges for group-based competitions

-- 1. Add team-related columns to challenges table
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS is_team BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES chat_rooms(id);

-- 2. Create team_challenge_participants table (for team-based challenges)
CREATE TABLE IF NOT EXISTS team_challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  team_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  total_xp INTEGER DEFAULT 0,
  total_pp INTEGER DEFAULT 0,
  members_count INTEGER DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(challenge_id, team_id)
);

-- 3. Create team challenge members table
CREATE TABLE IF NOT EXISTS team_challenge_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_participant_id UUID REFERENCES team_challenge_participants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contributed_xp INTEGER DEFAULT 0,
  contributed_pp INTEGER DEFAULT 0,
  UNIQUE(team_participant_id, user_id)
);

-- 4. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_team_challenge_participants_challenge 
ON team_challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_team_challenge_members_team 
ON team_challenge_members(team_participant_id);

-- 5. Add RLS policies
ALTER TABLE team_challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_challenge_members ENABLE ROW LEVEL SECURITY;

-- Anyone can read team challenge participants
CREATE POLICY "team_challenge_participants_read" ON team_challenge_participants
  FOR SELECT USING (true);

-- Team challenge members - anyone can read
CREATE POLICY "team_challenge_members_read" ON team_challenge_members
  FOR SELECT USING (true);

-- Users can insert their own team challenge memberships
CREATE POLICY "team_challenge_members_insert" ON team_challenge_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own contributions
CREATE POLICY "team_challenge_members_update" ON team_challenge_members
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. Function to calculate team total XP from members
CREATE OR REPLACE FUNCTION calculate_team_xp(p_challenge_id UUID, p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_xp INTEGER;
BEGIN
  SELECT COALESCE(SUM(contributed_xp), 0) INTO total_xp
  FROM team_challenge_members tcm
  JOIN team_challenge_participants tcp ON tcp.id = tcm.team_participant_id
  WHERE tcp.challenge_id = p_challenge_id AND tcp.team_id = p_team_id;
  
  RETURN total_xp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to update team totals
CREATE OR REPLACE FUNCTION update_team_totals(p_team_participant_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE team_challenge_participants tcp
  SET 
    total_xp = (
      SELECT COALESCE(SUM(tcm.contributed_xp), 0)
      FROM team_challenge_members tcm
      WHERE tcm.team_participant_id = tcp.id
    ),
    total_pp = (
      SELECT COALESCE(SUM(tcm.contributed_pp), 0)
      FROM team_challenge_members tcm
      WHERE tcm.team_participant_id = tcp.id
    ),
    members_count = (
      SELECT COUNT(*)
      FROM team_challenge_members tcm
      WHERE tcm.team_participant_id = tcp.id
    ),
    updated_at = NOW()
  WHERE tcp.id = p_team_participant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger to auto-update team totals when member contributes
CREATE OR REPLACE FUNCTION trigger_update_team_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.team_participant_id IS NOT NULL THEN
    PERFORM update_team_totals(NEW.team_participant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_team_member_contributions ON team_challenge_members;
CREATE TRIGGER trigger_team_member_contributions
  AFTER INSERT OR UPDATE ON team_challenge_members
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_team_totals();

-- 9. Function to get team leaderboard for a challenge
CREATE OR REPLACE FUNCTION get_team_leaderboard(p_challenge_id UUID)
RETURNS TABLE (
  rank INTEGER,
  team_id UUID,
  team_name TEXT,
  total_xp INTEGER,
  total_pp INTEGER,
  members_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY tcp.total_xp DESC)::INTEGER AS rank,
    tcp.team_id,
    cr.name AS team_name,
    tcp.total_xp,
    tcp.total_pp,
    tcp.members_count
  FROM team_challenge_participants tcp
  JOIN chat_rooms cr ON cr.id = tcp.team_id
  WHERE tcp.challenge_id = p_challenge_id
  ORDER BY tcp.total_xp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Seed data: Add a sample team challenge type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM challenge_types WHERE type = 'team') THEN
    INSERT INTO challenge_types (type, label, description, default_stake_pp, created_at)
    VALUES ('team', 'Team Challenge', 'Collaborate with a team to achieve goals together', 50, NOW());
  END IF;
END $$;
