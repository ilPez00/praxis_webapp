-- Migration: Add language preference to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

COMMENT ON COLUMN public.profiles.language IS 'User preferred language for UI and AI interactions (en, it, es, fr, ru)';
