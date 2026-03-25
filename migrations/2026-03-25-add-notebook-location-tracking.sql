-- Add location tracking to notebook entries
-- Allows showing notes on a map view

ALTER TABLE public.notebook_entries 
ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Add index for location-based queries
CREATE INDEX IF NOT EXISTS idx_notebook_entries_location 
ON public.notebook_entries(location_lat, location_lng) 
WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.notebook_entries.location_lat IS 'Latitude where entry was created';
COMMENT ON COLUMN public.notebook_entries.location_lng IS 'Longitude where entry was created';
COMMENT ON COLUMN public.notebook_entries.location_name IS 'Human-readable location name (city, place)';
