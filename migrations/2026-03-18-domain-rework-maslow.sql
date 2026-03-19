-- Migration: Goal Domain System Rework - Maslow's Hierarchy Based
-- Date: 2026-03-18
-- Description: 
--   - Replaces old 9-domain system with new 14-domain Maslow-based system
--   - Adds Gaming & Esports as legitimate domain
--   - Organizes domains into 5 hierarchical levels
--   - Provides better granularity and scientific foundation

-- =============================================================================
-- 1. Create new domain enum with 14 domains
-- =============================================================================

-- Create new enum type
DO $$ BEGIN
  CREATE TYPE goal_domain_new AS ENUM (
    -- Level 1: Physiological Needs
    'Body & Fitness',
    'Rest & Recovery',
    'Mental Balance',
    
    -- Level 2: Safety Needs
    'Environment & Home',
    'Health & Longevity',
    'Financial Security',
    
    -- Level 3: Love/Belonging
    'Friendship & Social',
    'Romance & Intimacy',
    'Community & Contribution',
    
    -- Level 4: Esteem Needs
    'Career & Craft',
    'Wealth & Assets',
    'Gaming & Esports',
    
    -- Level 5: Self-Transcendence
    'Impact & Legacy',
    'Spirit & Purpose'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. Add new column to goal_trees
-- =============================================================================

ALTER TABLE goal_trees ADD COLUMN IF NOT EXISTS domain_new goal_domain_new;

-- =============================================================================
-- 3. Migrate existing data with mapping
-- =============================================================================

UPDATE goal_trees 
SET domain_new = CASE
  -- Level 1: Physiological
  WHEN domain = 'Fitness' OR domain = 'Body & Health' THEN 'Body & Fitness'::goal_domain_new
  WHEN domain = 'Mental Health' THEN 'Mental Balance'::goal_domain_new
  
  -- Level 2: Safety
  WHEN domain = 'Environment & Gear' THEN 'Environment & Home'::goal_domain_new
  WHEN domain = 'Investing / Financial Growth' THEN 'Financial Security'::goal_domain_new
  WHEN domain = 'Money & Assets' THEN 'Financial Security'::goal_domain_new
  
  -- Level 3: Love/Belonging
  WHEN domain = 'Friendship / Social Engagement' THEN 'Friendship & Social'::goal_domain_new
  WHEN domain = 'Intimacy / Romantic Exploration' THEN 'Romance & Intimacy'::goal_domain_new
  
  -- Level 4: Esteem
  WHEN domain = 'Career' THEN 'Career & Craft'::goal_domain_new
  WHEN domain = 'Academics' THEN 'Career & Craft'::goal_domain_new
  WHEN domain = 'Investing / Financial Growth' THEN 'Wealth & Assets'::goal_domain_new
  
  -- Level 5: Self-Transcendence
  WHEN domain = 'Philosophical Development' THEN 'Spirit & Purpose'::goal_domain_new
  WHEN domain = 'Personal Goals' THEN 'Impact & Legacy'::goal_domain_new
  WHEN domain = 'Culture / Hobbies / Creative Pursuits' THEN 'Gaming & Esports'::goal_domain_new
  
  -- Default fallback
  ELSE 'Career & Craft'::goal_domain_new
END
WHERE domain IS NOT NULL;

-- =============================================================================
-- 4. Update related tables (places, events, challenges, etc.)
-- =============================================================================

-- Update places table if it has domain column
ALTER TABLE places ADD COLUMN IF NOT EXISTS domain_new goal_domain_new;

UPDATE places 
SET domain_new = CASE
  WHEN domain = 'Fitness' OR domain = 'Body & Health' THEN 'Body & Fitness'::goal_domain_new
  WHEN domain = 'Environment & Gear' THEN 'Environment & Home'::goal_domain_new
  WHEN domain = 'Career' THEN 'Career & Craft'::goal_domain_new
  WHEN domain = 'Friendship / Social Engagement' THEN 'Friendship & Social'::goal_domain_new
  WHEN domain = 'Culture / Hobbies / Creative Pursuits' THEN 'Gaming & Esports'::goal_domain_new
  ELSE 'Career & Craft'::goal_domain_new
END
WHERE domain IS NOT NULL;

-- Update challenges table if it has domain column  
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS domain_new goal_domain_new;

UPDATE challenges
SET domain_new = CASE
  WHEN category = 'Fitness' OR category = 'Body & Health' THEN 'Body & Fitness'::goal_domain_new
  WHEN category = 'Career' THEN 'Career & Craft'::goal_domain_new
  WHEN category = 'Friendship / Social Engagement' THEN 'Friendship & Social'::goal_domain_new
  ELSE 'Career & Craft'::goal_domain_new
END
WHERE category IS NOT NULL;

-- =============================================================================
-- 5. Drop old constraints and columns
-- =============================================================================

-- Drop old check constraint if exists
ALTER TABLE goal_trees DROP CONSTRAINT IF EXISTS goal_trees_domain_check;

-- Rename columns (old → backup, new → primary)
ALTER TABLE goal_trees RENAME COLUMN domain TO domain_old;
ALTER TABLE goal_trees RENAME COLUMN domain_new TO domain;

-- Drop old column after verification (commented out for safety)
-- ALTER TABLE goal_trees DROP COLUMN domain_old;

-- Same for places
ALTER TABLE places DROP CONSTRAINT IF EXISTS places_domain_check;
ALTER TABLE places RENAME COLUMN domain TO domain_old;
ALTER TABLE places RENAME COLUMN domain_new TO domain;

-- Same for challenges
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_category_check;
ALTER TABLE challenges RENAME COLUMN category TO category_old;
ALTER TABLE challenges RENAME COLUMN domain_new TO category;

-- =============================================================================
-- 6. Add new check constraints
-- =============================================================================

-- Note: Enum type already enforces valid values, but adding constraint for clarity
ALTER TABLE goal_trees 
  ALTER COLUMN domain SET NOT NULL,
  ALTER COLUMN domain SET DEFAULT 'Career & Craft'::goal_domain_new;

ALTER TABLE places 
  ALTER COLUMN domain SET DEFAULT 'Career & Craft'::goal_domain_new;

ALTER TABLE challenges 
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'Career & Craft'::goal_domain_new;

-- =============================================================================
-- 7. Create helper function to get Maslow level from domain
-- =============================================================================

CREATE OR REPLACE FUNCTION get_maslow_level(p_domain TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE p_domain
    -- Level 1: Physiological
    WHEN 'Body & Fitness' THEN 1
    WHEN 'Rest & Recovery' THEN 1
    WHEN 'Mental Balance' THEN 1
    
    -- Level 2: Safety
    WHEN 'Environment & Home' THEN 2
    WHEN 'Health & Longevity' THEN 2
    WHEN 'Financial Security' THEN 2
    
    -- Level 3: Love/Belonging
    WHEN 'Friendship & Social' THEN 3
    WHEN 'Romance & Intimacy' THEN 3
    WHEN 'Community & Contribution' THEN 3
    
    -- Level 4: Esteem
    WHEN 'Career & Craft' THEN 4
    WHEN 'Wealth & Assets' THEN 4
    WHEN 'Gaming & Esports' THEN 4
    
    -- Level 5: Self-Transcendence
    WHEN 'Impact & Legacy' THEN 5
    WHEN 'Spirit & Purpose' THEN 5
    
    ELSE 4
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 8. Create indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_goal_trees_domain ON goal_trees(domain);
CREATE INDEX IF NOT EXISTS idx_places_domain ON places(domain);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);

-- Index for Maslow level queries (using helper function)
CREATE INDEX IF NOT EXISTS idx_goal_trees_maslow_level ON goal_trees(get_maslow_level(domain));

-- =============================================================================
-- 9. Create view for domain balance analytics
-- =============================================================================

CREATE OR REPLACE VIEW user_domain_balance AS
SELECT 
  user_id,
  get_maslow_level(domain) as maslow_level,
  domain,
  COUNT(*) as goal_count,
  AVG(progress) as avg_progress,
  SUM(CASE WHEN progress = 100 THEN 1 ELSE 0 END) as completed_goals
FROM goal_trees,
     jsonb_array_elements(nodes) as node
WHERE node->>'domain' = domain
GROUP BY user_id, domain
ORDER BY user_id, maslow_level, domain;

-- =============================================================================
-- 10. Update tracker auto-assignment mapping
-- =============================================================================

-- Create tracker to domain mapping table
CREATE TABLE IF NOT EXISTS tracker_domain_mapping (
  tracker_type TEXT PRIMARY KEY,
  domain goal_domain_new NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default mappings
INSERT INTO tracker_domain_mapping (tracker_type, domain) VALUES
  -- Level 1
  ('lift', 'Body & Fitness'),
  ('cardio', 'Body & Fitness'),
  ('steps', 'Body & Fitness'),
  ('sports', 'Body & Fitness'),
  ('sleep', 'Rest & Recovery'),
  ('meditation', 'Mental Balance'),
  ('journal', 'Mental Balance'),
  ('mood', 'Mental Balance'),
  
  -- Level 2
  ('cleaning', 'Environment & Home'),
  ('home_projects', 'Environment & Home'),
  ('meals', 'Health & Longevity'),
  ('water', 'Health & Longevity'),
  ('supplements', 'Health & Longevity'),
  ('budget', 'Financial Security'),
  ('expenses', 'Financial Security'),
  ('savings', 'Financial Security'),
  
  -- Level 3
  ('hangout', 'Friendship & Social'),
  ('social_events', 'Friendship & Social'),
  ('dates', 'Romance & Intimacy'),
  ('volunteer', 'Community & Contribution'),
  
  -- Level 4
  ('deep_work', 'Career & Craft'),
  ('job_apps', 'Career & Craft'),
  ('projects', 'Career & Craft'),
  ('investments', 'Wealth & Assets'),
  ('gaming', 'Gaming & Esports'),
  ('achievements', 'Gaming & Esports'),
  ('streaming', 'Gaming & Esports'),
  
  -- Level 5
  ('mentoring', 'Impact & Legacy'),
  ('content_creation', 'Impact & Legacy'),
  ('reading', 'Spirit & Purpose')
ON CONFLICT (tracker_type) DO UPDATE SET domain = EXCLUDED.domain;

-- =============================================================================
-- 11. Create function to auto-assign domain based on tracker type
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_assign_domain(p_tracker_type TEXT)
RETURNS goal_domain_new AS $$
DECLARE
  v_domain goal_domain_new;
BEGIN
  SELECT domain INTO v_domain
  FROM tracker_domain_mapping
  WHERE tracker_type = p_tracker_type;
  
  IF v_domain IS NULL THEN
    v_domain := 'Career & Craft'::goal_domain_new;
  END IF;
  
  RETURN v_domain;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- End of Migration
-- =============================================================================

-- Verification queries (run these to ensure migration succeeded):
-- SELECT domain, COUNT(*) FROM goal_trees GROUP BY domain ORDER BY domain;
-- SELECT get_maslow_level('Gaming & Esports'::goal_domain_new); -- Should return 4
-- SELECT get_maslow_level('Body & Fitness'::goal_domain_new); -- Should return 1
