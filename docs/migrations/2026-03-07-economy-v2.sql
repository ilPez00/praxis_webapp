-- Economy V2 migration — 2026-03-07
-- Run in Supabase SQL Editor

-- 1. Post votes (replaces post_likes for karma system)
CREATE TABLE IF NOT EXISTS post_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value       SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_votes_post ON post_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_votes_user ON post_votes(user_id);

-- 2. Karma score on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS karma_score INTEGER DEFAULT 0;

-- 3. Event attendees (QR check-in)
CREATE TABLE IF NOT EXISTS event_attendees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- 4. Link chat_rooms to events
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- 5. honor_score as float (weighted decay score, not integer count)
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'honor_score') <> 'double precision' THEN
    ALTER TABLE profiles ALTER COLUMN honor_score TYPE FLOAT
      USING COALESCE(honor_score, 0)::FLOAT;
  END IF;
END$$;

-- 6. honor_votes: add created_at if missing (needed for decay calculation)
ALTER TABLE honor_votes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 7. Onboarding grant note:
-- New profiles should be created with praxis_points = 200 in application code.
-- To backfill existing zero-point users (run manually if desired):
-- UPDATE profiles SET praxis_points = 200 WHERE praxis_points IS NULL OR praxis_points = 0;
