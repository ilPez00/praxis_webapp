-- ================================================================
-- MINIMAL TEST - Run this FIRST to verify table creation works
-- ================================================================

-- Just create goal_trees table alone
DROP TABLE IF EXISTS public.goal_trees CASCADE;

CREATE TABLE public.goal_trees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nodes JSONB NOT NULL DEFAULT '[]',
  root_nodes JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.goal_trees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own goal tree" ON public.goal_trees;

CREATE POLICY "Users can manage own goal tree" ON public.goal_trees
  FOR ALL USING (auth.uid() = user_id);

-- Test insert
INSERT INTO public.goal_trees (user_id, nodes, root_nodes) 
VALUES (auth.uid(), '[]', '[]');

-- Test select
SELECT * FROM public.goal_trees WHERE user_id = auth.uid();

-- ================================================================
-- If this works, the table is created correctly!
-- Then run the FULL migration script
-- ================================================================
