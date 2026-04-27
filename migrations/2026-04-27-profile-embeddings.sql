-- =============================================================================
-- Profile Embeddings — semantic text affinity for matching
-- =============================================================================
-- Stores pre-computed Gemini text-embedding-004 vectors of user's text corpus
-- (bio + non-private diary entries + non-private notebook entries).
-- Used alongside goal_embeddings for composite match scoring.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.profile_embeddings (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  embedding     vector(768),
  text_sources  TEXT[] DEFAULT '{}',   -- ['bio', 'diary', 'notebook']
  entry_count   INT DEFAULT 0,          -- total documents embedded
  metadata      JSONB DEFAULT '{}',     -- corpus stats (avg length, etc.)
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profile_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role bypass profile embeddings" ON public.profile_embeddings;
CREATE POLICY "Service role bypass profile embeddings" ON public.profile_embeddings
  USING (true);

-- pgvector index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_profile_embeddings_embedding
  ON public.profile_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =============================================================================
-- MATCH_PROFILES_BY_TEXT — cosine-similarity on profile embeddings
-- =============================================================================

CREATE OR REPLACE FUNCTION public.match_profiles_by_text(
  query_user_id UUID,
  match_limit   INT DEFAULT 40
)
RETURNS TABLE (matched_user_id UUID, text_score FLOAT8)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.user_id                                          AS matched_user_id,
    (1.0 - (a.embedding <=> b.embedding))::FLOAT8      AS text_score
  FROM public.profile_embeddings a
  JOIN public.profile_embeddings b ON a.user_id != b.user_id
  WHERE a.user_id        = query_user_id
    AND a.embedding      IS NOT NULL
    AND b.embedding      IS NOT NULL
  ORDER BY text_score DESC
  LIMIT match_limit;
END;
$$;
