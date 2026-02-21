-- =============================================================================
-- Praxis Web App - Supabase Database Migration
-- Generated: 2026-02-21
--
-- This file creates all missing tables for the Praxis project.
-- It is fully idempotent: safe to run multiple times.
--
-- Existing tables (already present, not recreated here):
--   public.profiles
--   public.goal_trees
--   public.user_subscriptions
--
-- Execution order respects foreign key dependencies:
--   1. profiles (ALTER only — add missing columns)
--   2. messages
--   3. completion_requests
--   4. chat_rooms
--   5. chat_room_members
--   6. achievements
--   7. achievement_comments
--   8. achievement_votes
--   9. feedback
--  10. goal_embeddings  (requires pgvector extension)
--  11. bets
--  12. match_users_by_goals function
-- =============================================================================


-- =============================================================================
-- 1. PROFILES — Add missing columns
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_tree_edit_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sex                  TEXT,
  ADD COLUMN IF NOT EXISTS location             TEXT,
  ADD COLUMN IF NOT EXISTS current_streak       INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date   DATE,
  ADD COLUMN IF NOT EXISTS praxis_points        INT DEFAULT 100;


-- =============================================================================
-- 2. MESSAGES — Direct messages and group chat messages
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL,
  goal_node_id TEXT,
  message_type TEXT        DEFAULT 'text',
  media_url    TEXT,
  room_id      UUID,
  metadata     JSONB,
  timestamp    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages"     ON public.messages;

CREATE POLICY "Users can read own messages" ON public.messages
  FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() = receiver_id
    OR room_id IS NOT NULL
  );

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);


-- =============================================================================
-- 3. COMPLETION_REQUESTS — Peer goal verification
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.completion_requests (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verifier_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_node_id TEXT        NOT NULL,
  goal_name    TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

ALTER TABLE public.completion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see own requests"    ON public.completion_requests;
DROP POLICY IF EXISTS "Users can create requests"     ON public.completion_requests;

CREATE POLICY "Users can see own requests" ON public.completion_requests
  FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = verifier_id);

CREATE POLICY "Users can create requests" ON public.completion_requests
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id);


-- =============================================================================
-- 4. CHAT_ROOMS — Group chat rooms
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT,
  domain      TEXT,
  creator_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rooms"               ON public.chat_rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.chat_rooms;

CREATE POLICY "Anyone can read rooms" ON public.chat_rooms
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create rooms" ON public.chat_rooms
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);


-- =============================================================================
-- 5. CHAT_ROOM_MEMBERS — Join table linking users to chat rooms
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_room_members (
  room_id   UUID        REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id   UUID        REFERENCES auth.users(id)        ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can join rooms"    ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can leave rooms"   ON public.chat_room_members;

CREATE POLICY "Anyone can read members" ON public.chat_room_members
  FOR SELECT
  USING (true);

CREATE POLICY "Users can join rooms" ON public.chat_room_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms" ON public.chat_room_members
  FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- 6. ACHIEVEMENTS — Community achievement feed
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.achievements (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name       TEXT        NOT NULL,
  user_avatar_url TEXT,
  goal_node_id    TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  domain          TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read achievements"       ON public.achievements;
DROP POLICY IF EXISTS "Users can create own achievements"  ON public.achievements;
DROP POLICY IF EXISTS "Users can delete own achievements"  ON public.achievements;

CREATE POLICY "Anyone can read achievements" ON public.achievements
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create own achievements" ON public.achievements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own achievements" ON public.achievements
  FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- 7. ACHIEVEMENT_COMMENTS — Comments on achievements
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.achievement_comments (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  achievement_id  UUID        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  user_name       TEXT        NOT NULL,
  user_avatar_url TEXT,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.achievement_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read comments"       ON public.achievement_comments;
DROP POLICY IF EXISTS "Users can add comments"         ON public.achievement_comments;
DROP POLICY IF EXISTS "Users can delete own comments"  ON public.achievement_comments;

CREATE POLICY "Anyone can read comments" ON public.achievement_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can add comments" ON public.achievement_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.achievement_comments
  FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- 8. ACHIEVEMENT_VOTES — Upvotes and downvotes on achievements
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.achievement_votes (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  achievement_id UUID        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  type           TEXT        NOT NULL CHECK (type IN ('upvote', 'downvote')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (achievement_id, user_id)
);

ALTER TABLE public.achievement_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read votes"        ON public.achievement_votes;
DROP POLICY IF EXISTS "Users can vote"               ON public.achievement_votes;
DROP POLICY IF EXISTS "Users can change own vote"    ON public.achievement_votes;
DROP POLICY IF EXISTS "Users can remove own vote"    ON public.achievement_votes;

CREATE POLICY "Anyone can read votes" ON public.achievement_votes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can vote" ON public.achievement_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change own vote" ON public.achievement_votes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove own vote" ON public.achievement_votes
  FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- 9. FEEDBACK — Peer feedback and grading
--
-- Column names use camelCase (quoted) to match the Feedback model in
-- feedbackController.ts (giverId, receiverId, goalNodeId, createdAt).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id           UUID        PRIMARY KEY,
  "giverId"    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "receiverId" UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "goalNodeId" TEXT        NOT NULL,
  grade        TEXT        NOT NULL,
  comment      TEXT,
  "createdAt"  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see given or received feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can submit feedback"               ON public.feedback;

CREATE POLICY "Users can see given or received feedback" ON public.feedback
  FOR SELECT
  USING (auth.uid() = "giverId" OR auth.uid() = "receiverId");

CREATE POLICY "Users can submit feedback" ON public.feedback
  FOR INSERT
  WITH CHECK (auth.uid() = "giverId");


-- =============================================================================
-- 10. GOAL_EMBEDDINGS — Embedding cache for semantic goal matching
--
-- Requires the pgvector extension. vector(768) matches the embedding
-- dimension used by the matchmaking controller.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.goal_embeddings (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_node_id TEXT        NOT NULL,
  domain       TEXT        NOT NULL,
  node_name    TEXT        NOT NULL,
  embedding    vector(768),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, goal_node_id)
);

ALTER TABLE public.goal_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role bypass embeddings" ON public.goal_embeddings;

-- Open policy: real access control is enforced at the service-role level
-- in the application (matchmaking service).
CREATE POLICY "Service role bypass embeddings" ON public.goal_embeddings
  USING (true);


-- =============================================================================
-- 11. BETS — Goal betting with stake points
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bets (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_node_id TEXT        NOT NULL,
  goal_name    TEXT        NOT NULL,
  deadline     TIMESTAMPTZ NOT NULL,
  stake_points INT         DEFAULT 10 CHECK (stake_points >= 1),
  status       TEXT        DEFAULT 'active'
                           CHECK (status IN ('active', 'won', 'lost', 'cancelled')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bets"     ON public.bets;
DROP POLICY IF EXISTS "Service role bypass bets"  ON public.bets;

CREATE POLICY "Users manage own bets" ON public.bets
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role bypass bets" ON public.bets
  USING (true);


-- =============================================================================
-- 12. MATCH_USERS_BY_GOALS — pgvector cosine-similarity matchmaking function
--
-- Returns up to `match_limit` users ranked by average embedding similarity
-- across shared goal domains. Requires the goal_embeddings table and the
-- pgvector extension (both created above).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.match_users_by_goals(
  query_user_id UUID,
  match_limit   INT DEFAULT 20
)
RETURNS TABLE (matched_user_id UUID, score FLOAT8)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.user_id                                                AS matched_user_id,
    AVG(1.0 - (a.embedding <=> b.embedding))::FLOAT8        AS score
  FROM public.goal_embeddings a
  JOIN public.goal_embeddings b
    ON a.domain = b.domain
  WHERE a.user_id        = query_user_id
    AND b.user_id       != query_user_id
    AND a.embedding      IS NOT NULL
    AND b.embedding      IS NOT NULL
  GROUP BY b.user_id
  ORDER BY score DESC
  LIMIT match_limit;
END;
$$;
