-- Migration: Make goal_node_id optional in bets table
-- Reason: Axiom-generated bets might be free-text challenges not yet linked to a specific goal tree node.

ALTER TABLE public.bets ALTER COLUMN goal_node_id DROP NOT NULL;
