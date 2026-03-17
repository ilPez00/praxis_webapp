-- Migration: Auto-create Goals from Challenges, Duels, Events, and Bets
-- Generated: 2026-03-17
-- Description: Automatically create goals/subgoals in goal_trees when users:
--   1. Join challenges → creates a goal in the challenge domain
--   2. Accept/create duels → creates a goal with deadline
--   3. RSVP to events → creates a preparation goal (optional)
--   4. Place bets → creates a subgoal under the linked goal node

-- =============================================================================
-- 1. Add metadata fields to goal_trees for tracking external commitments
-- =============================================================================

-- Add column to track external source of goals (for nodes created from bets, duels, etc.)
ALTER TABLE public.goal_trees ADD COLUMN IF NOT EXISTS external_commitments JSONB DEFAULT '[]'::jsonb;

-- Add column to track goal expiration dates (for time-bound goals from duels/bets)
-- This is stored in the nodes JSONB, but we add a helper column for quick queries
ALTER TABLE public.goal_trees ADD COLUMN IF NOT EXISTS expiring_goals JSONB DEFAULT '[]'::jsonb;

-- =============================================================================
-- 2. Challenge Participation → Goal Creation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_challenge_to_goal()
RETURNS TRIGGER AS $$
DECLARE
  challenge_record RECORD;
  goal_node_id TEXT;
  goal_node JSONB;
  existing_goals JSONB;
  root_goals JSONB;
BEGIN
  -- Get challenge details
  SELECT c.id, c.title, c.description, c.domain, c.duration_days
  INTO challenge_record
  FROM public.challenges c
  WHERE c.id = NEW.challenge_id;

  -- Generate a unique node ID for this goal
  goal_node_id := 'challenge_' || NEW.challenge_id::text;

  -- Create goal node structure
  goal_node := jsonb_build_object(
    'id', goal_node_id,
    'domain', challenge_record.domain,
    'name', 'Complete Challenge: ' || challenge_record.title,
    'weight', 0.7,
    'progress', 0.0,
    'customDetails', challenge_record.description,
    'deadline_days', challenge_record.duration_days,
    'is_auto_generated', true,
    'source', jsonb_build_object(
      'table', 'challenges',
      'id', NEW.challenge_id,
      'joined_at', NEW.joined_at
    )
  );

  -- Get user's existing goal tree
  SELECT gt.nodes, gt.root_nodes
  INTO existing_goals, root_goals
  FROM public.goal_trees gt
  WHERE gt.user_id = NEW.user_id;

  -- If no goal tree exists, create one
  IF existing_goals IS NULL THEN
    INSERT INTO public.goal_trees (user_id, nodes, root_nodes)
    VALUES (
      NEW.user_id,
      jsonb_build_array(goal_node),
      jsonb_build_array(goal_node_id)
    );
  ELSE
    -- Check if this challenge goal already exists
    IF NOT (existing_goals @> jsonb_build_array(goal_node)) THEN
      -- Add to nodes array
      UPDATE public.goal_trees
      SET 
        nodes = nodes || jsonb_build_array(goal_node),
        root_nodes = root_nodes || jsonb_build_array(goal_node_id),
        updated_at = NOW()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_challenge_participation_goal ON public.challenge_participants;
CREATE TRIGGER trg_challenge_participation_goal
AFTER INSERT ON public.challenge_participants
FOR EACH ROW EXECUTE FUNCTION public.sync_challenge_to_goal();

-- =============================================================================
-- 3. Duel Acceptance → Goal Creation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_duel_to_goal()
RETURNS TRIGGER AS $$
DECLARE
  goal_node_id TEXT;
  goal_node JSONB;
  user_id_val UUID;
  opponent_name TEXT;
BEGIN
  -- Only create goals when duel is accepted (status changes to 'active')
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Create goal for creator
    user_id_val := NEW.creator_id;
    
    SELECT pr.name INTO opponent_name
    FROM public.profiles pr
    WHERE pr.id = NEW.opponent_id;

    goal_node_id := 'duel_' || NEW.id::text;

    goal_node := jsonb_build_object(
      'id', goal_node_id,
      'domain', NEW.category,
      'name', 'Duel: ' || NEW.title,
      'weight', 0.8,
      'progress', 0.0,
      'customDetails', COALESCE(NEW.description, 'P2P challenge against ' || COALESCE(opponent_name, 'opponent')),
      'deadline_date', NEW.deadline,
      'stake_pp', NEW.stake_pp,
      'is_auto_generated', true,
      'source', jsonb_build_object(
        'table', 'duels',
        'id', NEW.id,
        'opponent_id', NEW.opponent_id,
        'opponent_name', opponent_name,
        'stake_pp', NEW.stake_pp
      )
    );

    -- Insert or update goal tree for creator
    INSERT INTO public.goal_trees (user_id, nodes, root_nodes)
    VALUES (
      user_id_val,
      jsonb_build_array(goal_node),
      jsonb_build_array(goal_node_id)
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
      nodes = public.goal_trees.nodes || jsonb_build_array(goal_node),
      root_nodes = public.goal_trees.root_nodes || jsonb_build_array(goal_node_id),
      updated_at = NOW()
    WHERE NOT (public.goal_trees.nodes @> jsonb_build_array(goal_node));

    -- Create goal for opponent (if exists)
    IF NEW.opponent_id IS NOT NULL THEN
      user_id_val := NEW.opponent_id;
      
      SELECT pr.name INTO opponent_name
      FROM public.profiles pr
      WHERE pr.id = NEW.creator_id;

      goal_node_id := 'duel_' || NEW.id::text || '_opponent';

      goal_node := jsonb_build_object(
        'id', goal_node_id,
        'domain', NEW.category,
        'name', 'Duel: ' || NEW.title,
        'weight', 0.8,
        'progress', 0.0,
        'customDetails', COALESCE(NEW.description, 'P2P challenge against ' || COALESCE(opponent_name, 'opponent')),
        'deadline_date', NEW.deadline,
        'stake_pp', NEW.stake_pp,
        'is_auto_generated', true,
        'source', jsonb_build_object(
          'table', 'duels',
          'id', NEW.id,
          'opponent_id', NEW.creator_id,
          'opponent_name', opponent_name,
          'stake_pp', NEW.stake_pp
        )
      );

      INSERT INTO public.goal_trees (user_id, nodes, root_nodes)
      VALUES (
        user_id_val,
        jsonb_build_array(goal_node),
        jsonb_build_array(goal_node_id)
      )
      ON CONFLICT (user_id) DO UPDATE
      SET 
        nodes = public.goal_trees.nodes || jsonb_build_array(goal_node),
        root_nodes = public.goal_trees.root_nodes || jsonb_build_array(goal_node_id),
        updated_at = NOW()
      WHERE NOT (public.goal_trees.nodes @> jsonb_build_array(goal_node));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_duel_goal ON public.duels;
CREATE TRIGGER trg_duel_goal
AFTER UPDATE ON public.duels
FOR EACH ROW EXECUTE FUNCTION public.sync_duel_to_goal();

-- =============================================================================
-- 4. Event RSVP → Optional Preparation Goal
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_event_rsvp_to_goal()
RETURNS TRIGGER AS $$
DECLARE
  event_record RECORD;
  goal_node_id TEXT;
  goal_node JSONB;
  days_until_event INT;
BEGIN
  -- Only create goals for 'going' status
  IF NEW.status = 'going' THEN
    -- Get event details
    SELECT e.id, e.title, e.description, e.event_date, e.location
    INTO event_record
    FROM public.events e
    WHERE e.id = NEW.event_id;

    -- Calculate days until event
    days_until_event := event_record.event_date - CURRENT_DATE;

    -- Only create goal if event is at least 3 days away (worth preparing for)
    IF days_until_event >= 3 THEN
      goal_node_id := 'event_' || NEW.event_id::text;

      goal_node := jsonb_build_object(
        'id', goal_node_id,
        'domain', 'Social',
        'name', 'Prepare for: ' || event_record.title,
        'weight', 0.5,
        'progress', 0.0,
        'customDetails', COALESCE(event_record.description, 'Event preparation') || 
                        CASE 
                          WHEN event_record.location IS NOT NULL THEN ' at ' || event_record.location
                          ELSE ''
                        END,
        'deadline_date', event_record.event_date,
        'is_auto_generated', true,
        'is_optional', true,
        'source', jsonb_build_object(
          'table', 'event_rsvps',
          'event_id', NEW.event_id,
          'event_date', event_record.event_date,
          'location', event_record.location
        )
      );

      -- Insert or update goal tree
      INSERT INTO public.goal_trees (user_id, nodes, root_nodes)
      VALUES (
        NEW.user_id,
        jsonb_build_array(goal_node),
        jsonb_build_array(goal_node_id)
      )
      ON CONFLICT (user_id) DO UPDATE
      SET 
        nodes = public.goal_trees.nodes || jsonb_build_array(goal_node),
        root_nodes = public.goal_trees.root_nodes || jsonb_build_array(goal_node_id),
        updated_at = NOW()
      WHERE NOT (public.goal_trees.nodes @> jsonb_build_array(goal_node));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_event_rsvp_goal ON public.event_rsvps;
CREATE TRIGGER trg_event_rsvp_goal
AFTER INSERT ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.sync_event_rsvp_to_goal();

-- =============================================================================
-- 5. Bet Placement → Subgoal under Existing Goal
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_bet_to_subgoal()
RETURNS TRIGGER AS $$
DECLARE
  goal_tree_record RECORD;
  parent_node JSONB;
  subgoal_node JSONB;
  subgoal_id TEXT;
  updated_nodes JSONB;
  node_index INT;
BEGIN
  -- Get the parent goal node from user's goal tree
  SELECT gt.nodes, gt.root_nodes
  INTO goal_tree_record
  FROM public.goal_trees gt
  WHERE gt.user_id = NEW.user_id;

  -- Find the parent goal node by ID (goal_node_id from bet)
  -- The goal_node_id is stored as text, we need to find it in the nodes array
  SELECT 
    nodes #> ARRAY[node_idx] as parent,
    node_idx
  INTO parent_node, node_index
  FROM public.goal_trees,
       LATERAL jsonb_array_elements(nodes) WITH ORDINALITY AS elem(node, node_idx)
  WHERE user_id = NEW.user_id
    AND (elem.node->>'id')::text = NEW.goal_node_id;

  -- If parent goal exists, add bet as a subgoal/commitment
  IF parent_node IS NOT NULL THEN
    subgoal_id := 'bet_' || NEW.id::text;

    subgoal_node := jsonb_build_object(
      'id', subgoal_id,
      'domain', parent_node->>'domain',
      'name', 'Bet: ' || NEW.goal_name,
      'weight', 0.9,
      'progress', 0.0,
      'customDetails', 'Stake: ' || NEW.stake_points || ' PP | Deadline: ' || to_char(NEW.deadline, 'YYYY-MM-DD'),
      'deadline_date', NEW.deadline,
      'stake_points', NEW.stake_points,
      'parent_goal_id', NEW.goal_node_id,
      'is_auto_generated', true,
      'source', jsonb_build_object(
        'table', 'bets',
        'id', NEW.id,
        'parent_goal_id', NEW.goal_node_id
      )
    );

    -- Update the parent node to include this subgoal in its children
    -- We'll add a 'children' or 'subgoals' field to the parent
    updated_nodes := jsonb_build_array();
    
    FOR i IN 0..(jsonb_array_length(goal_tree_record.nodes) - 1) LOOP
      IF (goal_tree_record.nodes->i->>'id')::text = NEW.goal_node_id THEN
        -- This is the parent node, add subgoals array
        updated_nodes := updated_nodes || 
          jsonb_build_array(
            goal_tree_record.nodes->i || jsonb_build_object(
              'subgoals', jsonb_build_array(subgoal_node)
            )
          );
      ELSIF (goal_tree_record.nodes->i->>'id')::text = subgoal_id THEN
        -- Subgoal already exists, skip
        updated_nodes := updated_nodes || jsonb_build_array(goal_tree_record.nodes->i);
      ELSE
        updated_nodes := updated_nodes || jsonb_build_array(goal_tree_record.nodes->i);
      END IF;
    END LOOP;

    UPDATE public.goal_trees
    SET 
      nodes = updated_nodes,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  ELSE
    -- If no parent goal exists, create a standalone goal for the bet
    subgoal_id := 'bet_' || NEW.id::text;

    subgoal_node := jsonb_build_object(
      'id', subgoal_id,
      'domain', 'Commitment',
      'name', 'Bet: ' || NEW.goal_name,
      'weight', 0.85,
      'progress', 0.0,
      'customDetails', 'Stake: ' || NEW.stake_points || ' PP | Deadline: ' || to_char(NEW.deadline, 'YYYY-MM-DD'),
      'deadline_date', NEW.deadline,
      'stake_points', NEW.stake_points,
      'is_auto_generated', true,
      'source', jsonb_build_object(
        'table', 'bets',
        'id', NEW.id,
        'goal_node_id', NEW.goal_node_id
      )
    );

    INSERT INTO public.goal_trees (user_id, nodes, root_nodes)
    VALUES (
      NEW.user_id,
      jsonb_build_array(subgoal_node),
      jsonb_build_array(subgoal_id)
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
      nodes = public.goal_trees.nodes || jsonb_build_array(subgoal_node),
      root_nodes = public.goal_trees.root_nodes || jsonb_build_array(subgoal_id),
      updated_at = NOW()
    WHERE NOT (public.goal_trees.nodes @> jsonb_build_array(subgoal_node));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bet_subgoal ON public.bets;
CREATE TRIGGER trg_bet_subgoal
AFTER INSERT ON public.bets
FOR EACH ROW EXECUTE FUNCTION public.sync_bet_to_subgoal();

-- =============================================================================
-- 6. Helper Function: Expire Completed/Expired Goals
-- =============================================================================

CREATE OR REPLACE FUNCTION public.expire_time_bound_goals()
RETURNS void AS $$
DECLARE
  goal_record RECORD;
  updated_nodes JSONB;
  goal_index INT;
  goal_node JSONB;
  deadline_date TIMESTAMPTZ;
  is_expired BOOLEAN;
BEGIN
  -- Iterate through all goal trees
  FOR goal_record IN SELECT user_id, nodes FROM public.goal_trees LOOP
    updated_nodes := jsonb_build_array();
    
    FOR i IN 0..(jsonb_array_length(goal_record.nodes) - 1) LOOP
      goal_node := goal_record.nodes->i;
      deadline_date := (goal_node->>'deadline_date')::TIMESTAMPTZ;
      is_expired := false;
      
      -- Check if goal has expired
      IF deadline_date IS NOT NULL AND deadline_date < NOW() THEN
        -- Mark as expired by adding expired flag
        goal_node := goal_node || jsonb_build_object('is_expired', true, 'progress', 1.0);
        is_expired := true;
      END IF;
      
      -- Check if goal is from a completed source (duel won/lost, bet resolved, etc.)
      IF goal_node->'source'->>'table' = 'duels' THEN
        -- Check duel status
        DECLARE
          duel_status TEXT;
        BEGIN
          SELECT d.status INTO duel_status
          FROM public.duels d
          WHERE d.id = (goal_node->'source'->>'id')::uuid;
          
          IF duel_status = 'completed' THEN
            goal_node := goal_node || jsonb_build_object('is_completed', true, 'progress', 1.0);
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      ELSIF goal_node->'source'->>'table' = 'bets' THEN
        -- Check bet status
        DECLARE
          bet_status TEXT;
        BEGIN
          SELECT b.status INTO bet_status
          FROM public.bets b
          WHERE b.id = (goal_node->'source'->>'id')::uuid;
          
          IF bet_status IN ('won', 'lost', 'cancelled') THEN
            goal_node := goal_node || jsonb_build_object('is_completed', true, 'progress', 1.0);
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
      
      updated_nodes := updated_nodes || jsonb_build_array(goal_node);
    END LOOP;
    
    -- Update if changes were made
    IF updated_nodes != goal_record.nodes THEN
      UPDATE public.goal_trees
      SET nodes = updated_nodes, updated_at = NOW()
      WHERE user_id = goal_record.user_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule this to run daily via cron or call manually
-- SELECT public.expire_time_bound_goals();

-- =============================================================================
-- 7. Index for Quick Expiring Goals Lookup
-- =============================================================================

-- Create a view for quick access to expiring goals
CREATE OR REPLACE VIEW public.user_expiring_goals AS
SELECT 
  gt.user_id as user_id,
  elem.node->>'id' as goal_id,
  elem.node->>'name' as goal_name,
  elem.node->>'domain' as domain,
  (elem.node->>'deadline_date')::TIMESTAMPTZ as deadline_date,
  (elem.node->>'progress')::numeric as progress,
  elem.node->'source' as source,
  CASE 
    WHEN (elem.node->>'deadline_date')::TIMESTAMPTZ < NOW() THEN 'expired'
    WHEN (elem.node->>'deadline_date')::TIMESTAMPTZ < NOW() + INTERVAL '7 days' THEN 'due_soon'
    ELSE 'active'
  END as status
FROM public.goal_trees gt,
     LATERAL jsonb_array_elements(gt.nodes) WITH ORDINALITY AS elem(node, node_idx)
WHERE elem.node->>'deadline_date' IS NOT NULL
  AND (elem.node->>'is_completed')::boolean IS NOT true;

CREATE INDEX IF NOT EXISTS idx_expiring_goals_deadline ON public.user_expiring_goals (deadline_date ASC);

-- =============================================================================
-- End of Migration
-- =============================================================================
