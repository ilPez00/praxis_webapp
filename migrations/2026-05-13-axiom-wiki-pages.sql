-- ============================================================================
-- AXIOM WIKI PAGES — Persistent knowledge base for Axiom semantic memory
-- Inspired by Karpathy's llm-wiki pattern, powered by krakiun/llmwiki search
--
-- Each wiki page is a dense, LLM-synthesized markdown file with YAML
-- frontmatter stored in JSONB. Written nightly by the unified scan and
-- indexed by llmwiki (Tantivy BM25 + usearch embeddings) for low-token
-- context retrieval.
--
-- Migrated by: Giovanni (g@iconicair.com)
-- Date: 2026-05-13
-- ============================================================================

-- 1. Wiki pages — source of truth for Axiom's semantic memory
CREATE TABLE IF NOT EXISTS public.axiom_wiki_pages (
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_path    TEXT        NOT NULL,
  frontmatter  JSONB       NOT NULL DEFAULT '{}',
  content      TEXT        NOT NULL,
  token_count  INTEGER     DEFAULT 0,
  generated_by TEXT        DEFAULT 'algorithm' CHECK (generated_by IN ('llm', 'algorithm')),
  version      INTEGER     DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, page_path)
);

-- 2. Full-text search vector (PostgreSQL FTS fallback for Railway)
ALTER TABLE public.axiom_wiki_pages ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_wiki_fts
  ON public.axiom_wiki_pages USING GIN (fts);

CREATE INDEX IF NOT EXISTS idx_wiki_updated
  ON public.axiom_wiki_pages(updated_at DESC);

-- 3. RLS — users see own pages, service_role manages all
ALTER TABLE public.axiom_wiki_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wiki pages"
  ON public.axiom_wiki_pages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all wiki pages"
  ON public.axiom_wiki_pages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Search function — used by Railway's TypeScript wiki service
--    (local dev uses llmwiki search instead)
CREATE OR REPLACE FUNCTION public.wiki_search(
  query_user_id UUID,
  search_query  TEXT,
  max_results   INT DEFAULT 3
) RETURNS TABLE(
  page_path TEXT,
  snippet   TEXT,
  rank      REAL
) LANGUAGE sql STABLE AS $$
  SELECT
    page_path,
    substring(content, 0, 200) AS snippet,
    ts_rank(fts, plainto_tsquery('english', search_query)) AS rank
  FROM axiom_wiki_pages
  WHERE user_id = query_user_id
    AND fts @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
$$;

-- Grants
GRANT SELECT ON public.axiom_wiki_pages TO authenticated;
GRANT ALL ON public.axiom_wiki_pages TO service_role;
GRANT EXECUTE ON FUNCTION public.wiki_search TO service_role;

-- Comment
COMMENT ON TABLE public.axiom_wiki_pages IS 'Axiom wiki pages — persistent LLM-synthesized knowledge per user';
COMMENT ON COLUMN public.axiom_wiki_pages.frontmatter IS 'YAML-style metadata: {title, description, confidence, updated, tags[]}';
COMMENT ON COLUMN public.axiom_wiki_pages.fts IS 'Auto-generated PostgreSQL FTS vector for English search';
COMMENT ON FUNCTION public.wiki_search IS 'Search wiki pages by PostgreSQL FTS, return ranked snippets (Railway fallback)';
