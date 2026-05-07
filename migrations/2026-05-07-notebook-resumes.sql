-- Notebook Resume snapshots — periodic cache for NotebookLM queries
-- Reduces cost by avoiding full notebook re-reads on every scan.
CREATE TABLE IF NOT EXISTS notebook_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  context_hash TEXT NOT NULL,        -- md5 hash of notebook IDs + seed
  data JSONB NOT NULL,               -- cached snapshot data
  expires_at TIMESTAMPTZ NOT NULL,   -- TTL for cache validity
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, context_hash)
);

CREATE INDEX IF NOT EXISTS idx_notebook_resumes_user ON notebook_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_resumes_expires ON notebook_resumes(expires_at);
