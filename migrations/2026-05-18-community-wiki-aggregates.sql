-- 2026-05-18 — Community Wiki Aggregates (Anonymized federation)
CREATE TABLE IF NOT EXISTS public.community_wiki_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    scores JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    content TEXT,
    logged_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for trend analysis
CREATE INDEX IF NOT EXISTS idx_wiki_agg_user ON public.community_wiki_aggregates(user_id);
CREATE INDEX IF NOT EXISTS idx_wiki_agg_type ON public.community_wiki_aggregates(source_type);
CREATE INDEX IF NOT EXISTS idx_wiki_agg_logged ON public.community_wiki_aggregates(logged_at DESC);

-- RLS
ALTER TABLE public.community_wiki_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own aggregates" 
ON public.community_wiki_aggregates FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all aggregates" 
ON public.community_wiki_aggregates FOR ALL 
USING (true);

GRANT ALL ON public.community_wiki_aggregates TO service_role;
GRANT INSERT ON public.community_wiki_aggregates TO authenticated;
