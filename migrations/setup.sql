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
-- 0. STORAGE — avatars bucket + access policies
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars"               ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars"          ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars"          ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());


-- =============================================================================
-- 1a. GOAL_TREES — Create if not exists (camelCase columns match backend queries)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.goal_trees (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"    UUID        REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nodes       JSONB       NOT NULL DEFAULT '[]',
  "rootNodes" JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Add columns that may be missing if goal_trees was created before setup.sql existed
ALTER TABLE public.goal_trees ADD COLUMN IF NOT EXISTS "rootNodes" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.goal_trees ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.goal_trees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own goal tree" ON public.goal_trees;
CREATE POLICY "Users can manage own goal tree"
  ON public.goal_trees FOR ALL
  USING (auth.uid() = "userId");


-- =============================================================================
-- 1. PROFILES — Add missing columns
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name                  TEXT,
  ADD COLUMN IF NOT EXISTS age                   INT,
  ADD COLUMN IF NOT EXISTS bio                   TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url            TEXT,
  ADD COLUMN IF NOT EXISTS is_premium            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS goal_tree_edit_count  INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sex                   TEXT,
  ADD COLUMN IF NOT EXISTS location              TEXT,
  ADD COLUMN IF NOT EXISTS current_streak        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date    DATE,
  ADD COLUMN IF NOT EXISTS praxis_points         INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_verified           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_admin              BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_banned             BOOLEAN DEFAULT false;


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

-- Add columns that may be missing if messages was created before these were added
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS goal_node_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url    TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS room_id      UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata     JSONB;

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

-- Add columns that may be missing if chat_rooms was created before these were added
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS domain      TEXT;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS type        TEXT DEFAULT 'board';
UPDATE public.chat_rooms SET type = 'board' WHERE type IS NULL;

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
-- 13. challenges
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.challenges (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  domain      TEXT NOT NULL,
  duration_days INT NOT NULL DEFAULT 30,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read challenges" ON public.challenges;
CREATE POLICY "Anyone can read challenges" ON public.challenges FOR SELECT USING (true);

-- 14. challenge_participants
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (challenge_id, user_id)
);
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can join/leave challenges" ON public.challenge_participants;
CREATE POLICY "Anyone can read participants" ON public.challenge_participants FOR SELECT USING (true);
CREATE POLICY "Users can join/leave challenges" ON public.challenge_participants
  FOR ALL USING (auth.uid() = user_id);


-- =============================================================================
-- 15. COACH_PROFILES — Profiles for coaches
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coach_profiles (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  bio           TEXT        NOT NULL DEFAULT '',
  skills        JSONB       NOT NULL DEFAULT '[]',
  domains       JSONB       NOT NULL DEFAULT '[]',
  hourly_rate   NUMERIC,
  is_available  BOOLEAN     NOT NULL DEFAULT true,
  rating        NUMERIC     NOT NULL DEFAULT 0,
  total_reviews INT         NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read coach_profiles"  ON public.coach_profiles;
DROP POLICY IF EXISTS "Own coach_profiles insert"   ON public.coach_profiles;
DROP POLICY IF EXISTS "Own coach_profiles update"   ON public.coach_profiles;
DROP POLICY IF EXISTS "Own coach_profiles delete"   ON public.coach_profiles;

CREATE POLICY "Public read coach_profiles"  ON public.coach_profiles FOR SELECT USING (true);
CREATE POLICY "Own coach_profiles insert"   ON public.coach_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own coach_profiles update"   ON public.coach_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own coach_profiles delete"   ON public.coach_profiles FOR DELETE USING (auth.uid() = user_id);


-- =============================================================================
-- 16. PROFILES — Marketplace columns
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_shield         BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_boosted_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS badge                 TEXT;


-- =============================================================================
-- 17. MARKETPLACE_TRANSACTIONS — Log of point purchases
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_transactions (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type  TEXT        NOT NULL,
  cost       INT         NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marketplace_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own marketplace_transactions" ON public.marketplace_transactions;

CREATE POLICY "Own marketplace_transactions"
  ON public.marketplace_transactions FOR ALL
  USING (auth.uid() = user_id);


-- =============================================================================
-- 18. FIX coach_profiles FK — point to public.profiles instead of auth.users
-- Run this block if you previously ran section 15 (coach_profiles creation).
-- This allows PostgREST to auto-embed profiles data via the JOIN syntax.
-- =============================================================================

ALTER TABLE public.coach_profiles
  DROP CONSTRAINT IF EXISTS coach_profiles_user_id_fkey;

ALTER TABLE public.coach_profiles
  ADD CONSTRAINT coach_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- =============================================================================
-- 19. POSTS — Community feed (Dashboard / Coaching / Marketplace)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.posts (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name       TEXT        NOT NULL,
  user_avatar_url TEXT,
  title           TEXT,
  content         TEXT        NOT NULL,
  media_url       TEXT,
  media_type      TEXT,
  context         TEXT        NOT NULL DEFAULT 'general',
  created_at      TIMESTAMPTZ DEFAULT now()
);
-- Add title column for Reddit-style board posts (idempotent)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Own posts insert"      ON public.posts;
DROP POLICY IF EXISTS "Own posts delete"      ON public.posts;
CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Own posts insert"      ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own posts delete"      ON public.posts FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_likes (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read post_likes" ON public.post_likes;
DROP POLICY IF EXISTS "Own post_likes insert"      ON public.post_likes;
DROP POLICY IF EXISTS "Own post_likes delete"      ON public.post_likes;
CREATE POLICY "Anyone can read post_likes" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Own post_likes insert"      ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own post_likes delete"      ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id         UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  user_name       TEXT        NOT NULL,
  user_avatar_url TEXT,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read post_comments" ON public.post_comments;
DROP POLICY IF EXISTS "Own post_comments insert"      ON public.post_comments;
DROP POLICY IF EXISTS "Own post_comments delete"      ON public.post_comments;
CREATE POLICY "Anyone can read post_comments" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Own post_comments insert"      ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own post_comments delete"      ON public.post_comments FOR DELETE USING (auth.uid() = user_id);


-- =============================================================================
-- 12. MATCH_USERS_BY_GOALS — pgvector cosine-similarity matchmaking function
-- (kept at end for dependency ordering)
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
