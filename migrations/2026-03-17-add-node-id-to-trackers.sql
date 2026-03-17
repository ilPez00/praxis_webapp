-- Add node_id column to trackers table to link trackers to specific goal nodes
-- This allows tracking progress on individual goal tree nodes

ALTER TABLE public.trackers ADD COLUMN IF NOT EXISTS node_id UUID REFERENCES public.goal_trees(id) ON DELETE CASCADE;

-- Create index for faster lookups by node_id
CREATE INDEX IF NOT EXISTS idx_trackers_node_id ON public.trackers(node_id);

-- Update the unique constraint to include node_id (optional: a user can have one tracker per type per node)
-- For now, we keep the existing constraint (user_id, type) which means one tracker per type per user
-- If you want per-node trackers, you would need to:
-- 1. Drop the old constraint
-- 2. Add new constraint: UNIQUE (user_id, type, node_id)
-- 
-- ALTER TABLE public.trackers DROP CONSTRAINT IF EXISTS trackers_user_id_type_key;
-- ALTER TABLE public.trackers ADD CONSTRAINT trackers_user_id_type_node_key UNIQUE (user_id, type, node_id);

-- Update RLS policies to allow filtering by node_id
-- Existing policies already handle user_id checks, so no changes needed there
