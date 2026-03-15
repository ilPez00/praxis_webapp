-- Migration: Add missing 'reference' column to posts table
-- Run this on your Supabase SQL Editor

-- Add reference column to posts table (for linking to goals, services, etc.)
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS reference JSONB;

-- Add index for faster lookups if querying by reference type
CREATE INDEX IF NOT EXISTS idx_posts_reference 
  ON public.posts USING GIN (reference);

-- Comment
COMMENT ON COLUMN public.posts.reference IS 'Linked reference data (goal, service, post, etc.) in JSONB format';
