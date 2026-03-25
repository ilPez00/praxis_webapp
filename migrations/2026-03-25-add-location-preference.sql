-- Add location tracking preference to user profiles
-- Allows users to enable/disable location logging

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location_enabled BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.profiles.location_enabled IS 'User preference for location tracking in notebook entries';

-- Update existing users to have location disabled by default (privacy-first)
UPDATE public.profiles SET location_enabled = false WHERE location_enabled IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_location_enabled 
ON public.profiles(location_enabled) WHERE location_enabled = true;
