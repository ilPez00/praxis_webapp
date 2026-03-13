-- Migration: Standardize goal_trees to snake_case and update RLS policies
-- This resolves 500 errors on Dashboard and "0 goal trees" stats

-- 1. Rename columns to snake_case if they exist in camelCase
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='goal_trees' AND column_name='userId') THEN
    ALTER TABLE public.goal_trees RENAME COLUMN "userId" TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='goal_trees' AND column_name='rootNodes') THEN
    ALTER TABLE public.goal_trees RENAME COLUMN "rootNodes" TO root_nodes;
  END IF;
END $$;

-- 2. Update RLS Policies to use new column names
DROP POLICY IF EXISTS "Users can manage own goal tree" ON public.goal_trees;
CREATE POLICY "Users can manage own goal tree"
  ON public.goal_trees FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view all goal trees (needed for matching and global stats)
DROP POLICY IF EXISTS "Public can view goal trees" ON public.goal_trees;
CREATE POLICY "Public can view goal trees" 
  ON public.goal_trees FOR SELECT 
  TO authenticated 
  USING (true);

-- 3. Update comments
COMMENT ON COLUMN public.goal_trees.user_id IS 'FK to profiles.id (standardized from userId)';
COMMENT ON COLUMN public.goal_trees.root_nodes IS 'JSONB array of root node objects (standardized from rootNodes)';
