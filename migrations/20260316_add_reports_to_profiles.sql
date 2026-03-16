-- Migration: Add latest_axiom_report and latest_ai_narrative to profiles
-- Generated: 2026-03-16

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latest_axiom_report JSONB,
  ADD COLUMN IF NOT EXISTS latest_ai_narrative TEXT;
