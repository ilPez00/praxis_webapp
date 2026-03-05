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
  ADD COLUMN IF NOT EXISTS is_banned             BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_instagram      TEXT,
  ADD COLUMN IF NOT EXISTS social_twitter        TEXT,
  ADD COLUMN IF NOT EXISTS social_linkedin       TEXT,
  ADD COLUMN IF NOT EXISTS social_whatsapp       TEXT,
  ADD COLUMN IF NOT EXISTS social_telegram       TEXT;


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
-- 12. TRACKERS + TRACKER_ENTRIES — custom activity tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trackers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, type)
);

ALTER TABLE public.trackers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own trackers select" ON public.trackers;
DROP POLICY IF EXISTS "Own trackers insert" ON public.trackers;
DROP POLICY IF EXISTS "Own trackers delete" ON public.trackers;

CREATE POLICY "Own trackers select" ON public.trackers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own trackers insert" ON public.trackers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own trackers delete" ON public.trackers FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tracker_entries (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracker_id UUID REFERENCES public.trackers(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  logged_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tracker_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own tracker_entries select" ON public.tracker_entries;
DROP POLICY IF EXISTS "Own tracker_entries insert" ON public.tracker_entries;
DROP POLICY IF EXISTS "Own tracker_entries delete" ON public.tracker_entries;

CREATE POLICY "Own tracker_entries select" ON public.tracker_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own tracker_entries insert" ON public.tracker_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own tracker_entries delete" ON public.tracker_entries FOR DELETE USING (auth.uid() = user_id);


-- =============================================================================
-- 13. COACHING_BRIEFS — cached Master Roshi analysis per user
-- One row per user, upserted on each background generation.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coaching_briefs (
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  brief        JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coaching_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own coaching_briefs select" ON public.coaching_briefs;
DROP POLICY IF EXISTS "Own coaching_briefs upsert" ON public.coaching_briefs;

CREATE POLICY "Own coaching_briefs select" ON public.coaching_briefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own coaching_briefs upsert" ON public.coaching_briefs FOR ALL  USING (auth.uid() = user_id);

-- NOTE: Enable Realtime for this table in the Supabase dashboard
-- (Table Editor → coaching_briefs → Realtime toggle ON)


-- =============================================================================
-- 14. MATCH_USERS_BY_GOALS — pgvector cosine-similarity matchmaking function
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


-- =============================================================================
-- 15. CHECKINS — daily check-in tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.checkins (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  streak_day    INT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS checkins_user_day_idx
  ON public.checkins (user_id, DATE(checked_in_at AT TIME ZONE 'UTC'));

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own checkins" ON public.checkins;
CREATE POLICY "Users manage own checkins" ON public.checkins FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 16. PROFILES — reliability_score column
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reliability_score FLOAT DEFAULT 0;


-- =============================================================================
-- 17. CHALLENGES — add reward_points column
-- =============================================================================
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS reward_points INT NOT NULL DEFAULT 100;


-- =============================================================================
-- 18. PROFILES — username column
-- =============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(30) UNIQUE;


-- =============================================================================
-- 19. SERVICES — marketplace listings (services, jobs, gigs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name       TEXT        NOT NULL DEFAULT '',
  user_avatar_url TEXT,
  title           TEXT        NOT NULL,
  description     TEXT,
  type            TEXT        NOT NULL DEFAULT 'service'
                              CHECK (type IN ('service', 'job', 'gig')),
  domain          TEXT,
  price           NUMERIC,
  price_currency  TEXT        NOT NULL DEFAULT 'negotiable'
                              CHECK (price_currency IN ('USD', 'PP', 'negotiable', 'free')),
  tags            JSONB       NOT NULL DEFAULT '[]',
  contact_info    TEXT,
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active services" ON public.services;
DROP POLICY IF EXISTS "Own services insert"             ON public.services;
DROP POLICY IF EXISTS "Own services update"             ON public.services;
DROP POLICY IF EXISTS "Own services delete"             ON public.services;

CREATE POLICY "Anyone can read active services" ON public.services
  FOR SELECT USING (active = true OR auth.uid() = user_id);

CREATE POLICY "Own services insert" ON public.services
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own services update" ON public.services
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Own services delete" ON public.services
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 20. PERFORMANCE INDEXES
-- =============================================================================

-- Messages: conversation lookups (ChatPage, ChatRoom)
CREATE INDEX IF NOT EXISTS messages_sender_receiver_idx
  ON public.messages (sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS messages_receiver_sender_idx
  ON public.messages (receiver_id, sender_id);
-- Group chat message queries
CREATE INDEX IF NOT EXISTS messages_room_timestamp_idx
  ON public.messages (room_id, timestamp DESC);

-- Posts: board/context feed queries
CREATE INDEX IF NOT EXISTS posts_context_created_idx
  ON public.posts (context, created_at DESC);

-- Achievements: user feed + dashboard
CREATE INDEX IF NOT EXISTS achievements_user_created_idx
  ON public.achievements (user_id, created_at DESC);

-- Chat room members: getJoinedRooms, getRoomMembers
CREATE INDEX IF NOT EXISTS chat_room_members_user_idx
  ON public.chat_room_members (user_id);
CREATE INDEX IF NOT EXISTS chat_room_members_room_idx
  ON public.chat_room_members (room_id);

-- =============================================================================
-- 21. EVENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  event_time  TIME,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events read all"       ON public.events FOR SELECT USING (true);
CREATE POLICY "Events insert own"     ON public.events FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Events delete own"     ON public.events FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "RSVPs read all"        ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "RSVPs insert own"      ON public.event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "RSVPs upsert own"      ON public.event_rsvps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "RSVPs delete own"      ON public.event_rsvps FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS events_date_idx ON public.events (event_date ASC);
CREATE INDEX IF NOT EXISTS event_rsvps_event_idx ON public.event_rsvps (event_id);

-- =============================================================================
-- 22. REPLIES + CONTENT REFERENCES
-- =============================================================================

-- WhatsApp-style reply-to on group messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Linked references on posts (goal / service / post links)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reference JSONB;

CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- =============================================================================
-- 23. STAFF/MOD HIERARCHY + HONOR SYSTEM + EVENT GEO
-- =============================================================================

-- Role column on profiles (user < staff < moderator < admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'staff', 'moderator', 'admin'));

-- Honor score (community respect, distinct from reliability score)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS honor_score INTEGER NOT NULL DEFAULT 0;

-- Honor votes table (each user can honor each other user once)
CREATE TABLE IF NOT EXISTS public.honor_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (voter_id, target_id)
);

ALTER TABLE public.honor_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Honor votes readable by all" ON public.honor_votes FOR SELECT USING (true);
CREATE POLICY "Honor votes insert own"      ON public.honor_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Honor votes delete own"      ON public.honor_votes FOR DELETE USING (auth.uid() = voter_id);

CREATE INDEX IF NOT EXISTS honor_votes_target_idx ON public.honor_votes (target_id);
CREATE INDEX IF NOT EXISTS honor_votes_voter_idx  ON public.honor_votes (voter_id);

-- Geo columns on events (enables nearby search)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS latitude  FLOAT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS longitude FLOAT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS city      TEXT;

-- Spatial index (approximate — no PostGIS needed)
CREATE INDEX IF NOT EXISTS events_geo_idx ON public.events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =============================================================================
-- 26. REFERRAL SYSTEM
-- =============================================================================

-- Each user gets one unique referral code (on-demand generation via API)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  code       VARCHAR(8) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracks who claimed whose code; each claimer can only claim once
CREATE TABLE IF NOT EXISTS public.referral_claims (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claimer_id  UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referral codes: own user read/write" ON public.referral_codes USING (auth.uid() = user_id);
CREATE POLICY "Referral codes: insert own"          ON public.referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Referral claims: read all"           ON public.referral_claims FOR SELECT USING (true);
CREATE POLICY "Referral claims: insert own"         ON public.referral_claims FOR INSERT WITH CHECK (auth.uid() = claimer_id);

CREATE INDEX IF NOT EXISTS referral_codes_code_idx      ON public.referral_codes (code);
CREATE INDEX IF NOT EXISTS referral_claims_referrer_idx ON public.referral_claims (referrer_id);

-- =============================================================================
-- 25. GEO COLUMNS ON PROFILES (user location for nearby discovery + feed scoring)
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city      TEXT;

-- Spatial index (bounding-box approximate — no PostGIS needed)
CREATE INDEX IF NOT EXISTS profiles_geo_idx ON public.profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =============================================================================
-- 24. COACHING BRIEFS (cached AI coaching reports)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coaching_briefs (
  user_id      UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  brief        JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Briefs: own user only" ON public.coaching_briefs
  USING (auth.uid() = user_id);
