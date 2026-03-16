-- Change source_id from UUID to TEXT in notebook_entries table to allow for non-UUID sources (like Axiom insights)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notebook_entries' AND column_name = 'source_id' AND data_type = 'uuid') THEN
    ALTER TABLE public.notebook_entries ALTER COLUMN source_id TYPE TEXT;
    RAISE NOTICE 'Changed source_id to TEXT in notebook_entries';
  END IF;
END $$;
