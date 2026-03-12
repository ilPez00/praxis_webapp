-- 1. Add stated_location column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stated_location TEXT;

-- 2. Set all existing users to Verona, Italy
UPDATE public.profiles
SET 
  city = 'Verona',
  stated_location = 'Verona, Italy',
  latitude = 45.4384,
  longitude = 10.9916
WHERE city IS NULL OR city = 'Unknown';

-- 3. Ensure we have an index for geo queries if not already present
CREATE INDEX IF NOT EXISTS profiles_geo_idx ON public.profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
