-- Session: March 14, 2026 — Minimal AI Mode
-- Adds minimal_ai_mode toggle to profiles table (default: true = templates only, no LLM)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS minimal_ai_mode BOOLEAN DEFAULT TRUE;

-- Index for fast lookup during coaching sessions
CREATE INDEX IF NOT EXISTS idx_profiles_minimal_ai_mode ON public.profiles(minimal_ai_mode);

-- SUCCESS: No error; profiles table now supports Minimal AI Mode toggle.
-- Default is TRUE (template-based responses) to minimize API costs and maximize speed.
-- Users can disable it in Settings to enable premium "Master Roshi Boost" LLM features.
