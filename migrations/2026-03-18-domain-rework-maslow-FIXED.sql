-- Migration: Goal Domain System Rework - Maslow's Hierarchy Based
-- Date: 2026-03-18
-- Description: 
--   - Replaces old 9-domain system with new 14-domain Maslow-based system
--   - Adds Gaming & Esports as legitimate domain
--   - Organizes domains into 5 hierarchical levels
--   - Provides better granularity and scientific foundation
--
-- IMPORTANT: Domains are stored in JSONB 'nodes' column, not as separate column

-- =============================================================================
-- 1. Create new domain enum type (for reference and future use)
-- =============================================================================

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
-- 2. Create helper function to get Maslow level from domain name
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
-- 3. Create helper function to migrate old domain names to new ones
-- =============================================================================

CREATE OR REPLACE FUNCTION migrate_domain_name(old_domain TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE old_domain
    -- Level 1: Physiological
    WHEN 'Fitness' THEN 'Body & Fitness'
    WHEN 'Body & Health' THEN 'Body & Fitness'
    WHEN 'Mental Health' THEN 'Mental Balance'
    
    -- Level 2: Safety
    WHEN 'Environment & Gear' THEN 'Environment & Home'
    WHEN 'Investing / Financial Growth' THEN 'Financial Security'
    WHEN 'Money & Assets' THEN 'Financial Security'
    
    -- Level 3: Love/Belonging
    WHEN 'Friendship / Social Engagement' THEN 'Friendship & Social'
    WHEN 'Intimacy / Romantic Exploration' THEN 'Romance & Intimacy'
    
    -- Level 4: Esteem
    WHEN 'Career' THEN 'Career & Craft'
    WHEN 'Academics' THEN 'Career & Craft'
    WHEN 'Investing / Financial Growth' THEN 'Wealth & Assets'
    
    -- Level 5: Self-Transcendence
    WHEN 'Philosophical Development' THEN 'Spirit & Purpose'
    WHEN 'Personal Goals' THEN 'Impact & Legacy'
    WHEN 'Culture / Hobbies / Creative Pursuits' THEN 'Gaming & Esports'
    
    -- Default
    ELSE 'Career & Craft'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- 4. Update all goal_trees to migrate domain names in JSONB nodes
-- =============================================================================

-- This updates the 'domain' field inside each node in the JSONB array
-- Only updates nodes that are JSON objects (not scalars)
UPDATE goal_trees
SET nodes = (
  SELECT jsonb_agg(
    CASE 
      WHEN jsonb_typeof(node) = 'object' AND node ? 'domain' THEN
        jsonb_set(
          node,
          '{domain}',
          to_jsonb(migrate_domain_name(node->>'domain'))
        )
      ELSE node
    END
  )
  FROM jsonb_array_elements(goal_trees.nodes) AS node
)
WHERE jsonb_array_length(nodes) > 0;

-- Also update root_nodes if they contain domain information
UPDATE goal_trees
SET root_nodes = (
  SELECT jsonb_agg(
    CASE 
      WHEN jsonb_typeof(node) = 'object' AND node ? 'domain' THEN
        jsonb_set(
          node,
          '{domain}',
          to_jsonb(migrate_domain_name(node->>'domain'))
        )
      ELSE node
    END
  )
  FROM jsonb_array_elements(goal_trees.root_nodes) AS node
)
WHERE jsonb_array_length(root_nodes) > 0;

-- =============================================================================
-- 5. Update places table domains (if column exists)
-- =============================================================================

-- Only run if places table has domain column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'places' AND column_name = 'domain'
  ) THEN
    -- Add new domain column if not exists
    ALTER TABLE places ADD COLUMN IF NOT EXISTS domain_new TEXT;

    -- Migrate domains
    UPDATE places
    SET domain_new = migrate_domain_name(domain)
    WHERE domain IS NOT NULL;

    -- Rename columns
    ALTER TABLE places DROP COLUMN IF EXISTS domain_old;
    ALTER TABLE places RENAME COLUMN domain TO domain_old;
    ALTER TABLE places RENAME COLUMN domain_new TO domain;
  END IF;
END $$;

-- =============================================================================
-- 6. Update challenges table categories (if column exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'category'
  ) THEN
    -- Add new category column if not exists
    ALTER TABLE challenges ADD COLUMN IF NOT EXISTS category_new TEXT;

    -- Migrate categories
    UPDATE challenges
    SET category_new = migrate_domain_name(category)
    WHERE category IS NOT NULL;

    -- Rename columns
    ALTER TABLE challenges DROP COLUMN IF EXISTS category_old;
    ALTER TABLE challenges RENAME COLUMN category TO category_old;
    ALTER TABLE challenges RENAME COLUMN category_new TO category;
  END IF;
END $$;

-- =============================================================================
-- 7. Create indexes for performance (if columns exist)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'places' AND column_name = 'domain'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_places_domain ON places(domain);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'category'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);
  END IF;
END $$;

-- =============================================================================
-- 8. Create view for domain balance analytics
-- =============================================================================

CREATE OR REPLACE VIEW user_domain_balance AS
SELECT 
  user_id,
  get_maslow_level(node->>'domain') as maslow_level,
  node->>'domain' as domain,
  (node->>'progress')::numeric as progress,
  node->>'id' as node_id
FROM goal_trees,
     jsonb_array_elements(nodes) as node
WHERE node->>'domain' IS NOT NULL;

-- =============================================================================
-- 9. Create tracker to domain mapping table
-- =============================================================================

CREATE TABLE IF NOT EXISTS tracker_domain_mapping (
  tracker_type TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default mappings (Maslow-based)
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
  ('rank', 'Gaming & Esports'),
  ('streaming', 'Gaming & Esports'),
  
  -- Level 5
  ('mentoring', 'Impact & Legacy'),
  ('teaching', 'Impact & Legacy'),
  ('content_creation', 'Impact & Legacy'),
  ('reading', 'Spirit & Purpose')
ON CONFLICT (tracker_type) DO UPDATE SET domain = EXCLUDED.domain;

-- =============================================================================
-- 10. Create function to auto-assign domain based on tracker type
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_assign_domain(p_tracker_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_domain TEXT;
BEGIN
  SELECT domain INTO v_domain
  FROM tracker_domain_mapping
  WHERE tracker_type = p_tracker_type;
  
  IF v_domain IS NULL THEN
    v_domain := 'Career & Craft';
  END IF;
  
  RETURN v_domain;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- Verification Queries (Uncomment to run after migration)
-- =============================================================================

-- Check domain distribution in goal_trees
-- SELECT node->>'domain' as domain, COUNT(*) as count
-- FROM goal_trees, jsonb_array_elements(nodes) as node
-- WHERE node->>'domain' IS NOT NULL
-- GROUP BY node->>'domain'
-- ORDER BY count DESC;

-- Test Maslow level function
-- SELECT get_maslow_level('Gaming & Esports'); -- Should return 4
-- SELECT get_maslow_level('Body & Fitness'); -- Should return 1

-- Test domain migration function
-- SELECT migrate_domain_name('Fitness'); -- Should return 'Body & Fitness'
-- SELECT migrate_domain_name('Culture / Hobbies / Creative Pursuits'); -- Should return 'Gaming & Esports'

-- Check tracker mapping
-- SELECT * FROM tracker_domain_mapping WHERE domain = 'Gaming & Esports';

-- =============================================================================
-- End of Migration
-- =============================================================================
