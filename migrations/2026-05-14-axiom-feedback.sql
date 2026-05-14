-- Migration: Create axiom_feedback table for user feedback on Axiom outputs
-- Date: 2026-05-14

CREATE TABLE IF NOT EXISTS axiom_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    prompt_hash TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like','dislike','irrelevant','inaccurate')),
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookup by user and prompt
CREATE INDEX IF NOT EXISTS idx_axiom_feedback_user_id ON axiom_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_axiom_feedback_prompt_hash ON axiom_feedback(prompt_hash);
