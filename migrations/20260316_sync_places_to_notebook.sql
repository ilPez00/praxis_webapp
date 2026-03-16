-- Migration: Sync Reported Places to Notebook
-- Generated: 2026-03-16

-- 1. Update notebook_entries check constraint to include 'place'
-- We have to drop and recreate the constraint because ALTER TABLE doesn't allow direct enum update in CHECK
ALTER TABLE public.notebook_entries DROP CONSTRAINT IF EXISTS notebook_entries_entry_type_check;
ALTER TABLE public.notebook_entries ADD CONSTRAINT notebook_entries_entry_type_check 
  CHECK (entry_type IN (
    'note', 'tracker', 'goal_progress', 'post', 'event', 'message', 
    'checkin', 'achievement', 'bet', 'match', 'verification', 'comment', 'place'
  ));

-- 2. Create trigger function to sync places
CREATE OR REPLACE FUNCTION public.sync_place_to_notebook()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into notebook_entries whenever a user creates or bookmarks a place
  INSERT INTO public.notebook_entries (
    user_id,
    entry_type,
    source_table,
    source_id,
    title,
    content,
    domain,
    occurred_at
  ) VALUES (
    NEW.owner_id,
    'place',
    'places',
    NEW.id,
    'Reported Place: ' || NEW.name,
    COALESCE(NEW.description, 'New place bookmarked: ' || NEW.name),
    NEW.type,
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger on places table
DROP TRIGGER IF EXISTS trg_places_notebook ON public.places;
CREATE TRIGGER trg_places_notebook
AFTER INSERT ON public.places
FOR EACH ROW EXECUTE FUNCTION public.sync_place_to_notebook();
