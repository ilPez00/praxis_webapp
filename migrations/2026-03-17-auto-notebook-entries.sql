-- Migration: Auto-register Life Events to Notebook
-- Generated: 2026-03-17
-- Description: Automatically create notebook entries when users:
--   1. Join events (RSVP 'going')
--   2. Visit/bookmark places
--   3. Accept friendships
--   4. Join groups (chat rooms)
--   5. Give/receive honor votes

-- =============================================================================
-- 1. Update notebook_entries check constraint to include new entry types
-- =============================================================================

ALTER TABLE public.notebook_entries DROP CONSTRAINT IF EXISTS notebook_entries_entry_type_check;
ALTER TABLE public.notebook_entries ADD CONSTRAINT notebook_entries_entry_type_check
  CHECK (entry_type IN (
    'note', 'tracker', 'goal_progress', 'post', 'event', 'message',
    'checkin', 'achievement', 'bet', 'match', 'verification', 'comment', 
    'place', 'friendship', 'group', 'honor'
  ));

-- =============================================================================
-- 2. Event RSVPs → Notebook Entries
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_event_rsvp_to_notebook()
RETURNS TRIGGER AS $$
DECLARE
  event_title TEXT;
  event_date_val DATE;
  event_location TEXT;
BEGIN
  -- Get event details
  SELECT e.title, e.event_date, e.location 
  INTO event_title, event_date_val, event_location
  FROM public.events e 
  WHERE e.id = NEW.event_id;

  -- Only create notebook entry for 'going' status
  IF NEW.status = 'going' THEN
    INSERT INTO public.notebook_entries (
      user_id,
      entry_type,
      source_table,
      source_id,
      title,
      content,
      domain,
      occurred_at,
      metadata
    ) VALUES (
      NEW.user_id,
      'event',
      'event_rsvps',
      NEW.id,
      'Joined Event: ' || COALESCE(event_title, 'Unknown Event'),
      'RSVPed as going' || 
        CASE 
          WHEN event_location IS NOT NULL THEN ' at ' || event_location
          ELSE ''
        END,
      'Social',
      COALESCE(NEW.created_at, NOW()),
      jsonb_build_object(
        'event_id', NEW.event_id,
        'event_title', event_title,
        'event_date', event_date_val,
        'rsvp_status', NEW.status,
        'location', event_location
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_event_rsvps_notebook ON public.event_rsvps;
CREATE TRIGGER trg_event_rsvps_notebook
AFTER INSERT ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.sync_event_rsvp_to_notebook();

-- =============================================================================
-- 3. Place Members → Notebook Entries (already exists, but let's ensure it's complete)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_place_member_to_notebook()
RETURNS TRIGGER AS $$
DECLARE
  place_name TEXT;
  place_type TEXT;
  place_description TEXT;
BEGIN
  -- Get place details
  SELECT p.name, p.type, p.description 
  INTO place_name, place_type, place_description
  FROM public.places p 
  WHERE p.id = NEW.place_id;

  INSERT INTO public.notebook_entries (
    user_id,
    entry_type,
    source_table,
    source_id,
    title,
    content,
    domain,
    occurred_at,
    metadata
  ) VALUES (
    NEW.user_id,
    'place',
    'place_members',
    NEW.place_id,
    'Visited Place: ' || COALESCE(place_name, 'Unknown Place'),
    COALESCE(place_description, 'Bookmarked place: ' || COALESCE(place_name, 'Unknown')),
    place_type,
    COALESCE(NEW.joined_at, NOW()),
    jsonb_build_object(
      'place_id', NEW.place_id,
      'place_name', place_name,
      'place_type', place_type
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_place_members_notebook ON public.place_members;
CREATE TRIGGER trg_place_members_notebook
AFTER INSERT ON public.place_members
FOR EACH ROW EXECUTE FUNCTION public.sync_place_member_to_notebook();

-- =============================================================================
-- 4. Friendships → Notebook Entries (when accepted)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_friendship_to_notebook()
RETURNS TRIGGER AS $$
DECLARE
  requester_name TEXT;
  recipient_name TEXT;
  friend_name TEXT;
  user_id_val UUID;
BEGIN
  -- Only create entry when friendship is accepted
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    -- Get user names
    SELECT pr.name INTO requester_name FROM public.profiles pr WHERE pr.id = NEW.requester_id;
    SELECT pr.name INTO recipient_name FROM public.profiles pr WHERE pr.id = NEW.recipient_id;

    -- Create notebook entry for requester
    SELECT pr.name INTO friend_name FROM public.profiles pr WHERE pr.id = NEW.recipient_id;
    INSERT INTO public.notebook_entries (
      user_id,
      entry_type,
      source_table,
      source_id,
      title,
      content,
      domain,
      occurred_at,
      metadata
    ) VALUES (
      NEW.requester_id,
      'friendship',
      'friendships',
      NEW.id,
      'New Friendship: ' || COALESCE(friend_name, 'Unknown User'),
      'Connected with ' || COALESCE(friend_name, 'someone') || ' on Praxis',
      'Social',
      COALESCE(NEW.updated_at, NOW()),
      jsonb_build_object(
        'friend_id', NEW.recipient_id,
        'friend_name', friend_name,
        'requester_id', NEW.requester_id
      )
    );

    -- Create notebook entry for recipient
    SELECT pr.name INTO friend_name FROM public.profiles pr WHERE pr.id = NEW.requester_id;
    INSERT INTO public.notebook_entries (
      user_id,
      entry_type,
      source_table,
      source_id,
      title,
      content,
      domain,
      occurred_at,
      metadata
    ) VALUES (
      NEW.recipient_id,
      'friendship',
      'friendships',
      NEW.id,
      'New Friendship: ' || COALESCE(friend_name, 'Unknown User'),
      'Connected with ' || COALESCE(friend_name, 'someone') || ' on Praxis',
      'Social',
      COALESCE(NEW.updated_at, NOW()),
      jsonb_build_object(
        'friend_id', NEW.requester_id,
        'friend_name', friend_name,
        'recipient_id', NEW.recipient_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_friendships_notebook ON public.friendships;
CREATE TRIGGER trg_friendships_notebook
AFTER UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.sync_friendship_to_notebook();

-- =============================================================================
-- 5. Group Members (Chat Room Members) → Notebook Entries
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_group_member_to_notebook()
RETURNS TRIGGER AS $$
DECLARE
  room_name TEXT;
  room_type TEXT;
  room_description TEXT;
BEGIN
  -- Get chat room details
  SELECT cr.name, cr.type, cr.description 
  INTO room_name, room_type, room_description
  FROM public.chat_rooms cr 
  WHERE cr.id = NEW.room_id;

  -- Only for group chats (not direct messages)
  IF room_type IN ('group', 'board', 'place') THEN
    INSERT INTO public.notebook_entries (
      user_id,
      entry_type,
      source_table,
      source_id,
      title,
      content,
      domain,
      occurred_at,
      metadata
    ) VALUES (
      NEW.user_id,
      'group',
      'chat_room_members',
      NEW.room_id,
      'Joined Group: ' || COALESCE(room_name, 'Unknown Group'),
      COALESCE(room_description, 'Joined group chat: ' || COALESCE(room_name, 'Unknown')),
      'Social',
      COALESCE(NEW.joined_at, NOW()),
      jsonb_build_object(
        'room_id', NEW.room_id,
        'room_name', room_name,
        'room_type', room_type
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_room_members_notebook ON public.chat_room_members;
CREATE TRIGGER trg_chat_room_members_notebook
AFTER INSERT ON public.chat_room_members
FOR EACH ROW EXECUTE FUNCTION public.sync_group_member_to_notebook();

-- =============================================================================
-- 6. Honor Votes → Notebook Entries (for both giver and receiver)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_honor_vote_to_notebook()
RETURNS TRIGGER AS $$
DECLARE
  voter_name TEXT;
  target_name TEXT;
BEGIN
  -- Get user names
  SELECT pr.name INTO voter_name FROM public.profiles pr WHERE pr.id = NEW.voter_id;
  SELECT pr.name INTO target_name FROM public.profiles pr WHERE pr.id = NEW.target_id;

  -- Create notebook entry for honor giver (voter)
  INSERT INTO public.notebook_entries (
    user_id,
    entry_type,
    source_table,
    source_id,
    title,
    content,
    domain,
    occurred_at,
    metadata
  ) VALUES (
    NEW.voter_id,
    'honor',
    'honor_votes',
    NEW.id,
    'Gave Honor to: ' || COALESCE(target_name, 'Unknown User'),
    'Recognized ' || COALESCE(target_name, 'someone') || ' for their contributions to the community',
    'Social',
    COALESCE(NEW.created_at, NOW()),
    jsonb_build_object(
      'target_id', NEW.target_id,
      'target_name', target_name,
      'voter_id', NEW.voter_id,
      'action', 'given'
    )
  );

  -- Create notebook entry for honor receiver (target)
  INSERT INTO public.notebook_entries (
    user_id,
    entry_type,
    source_table,
    source_id,
    title,
    content,
    domain,
    occurred_at,
    metadata
  ) VALUES (
    NEW.target_id,
    'honor',
    'honor_votes',
    NEW.id,
    'Received Honor from: ' || COALESCE(voter_name, 'Unknown User'),
    COALESCE(voter_name, 'Someone') || ' recognized your contributions to the community',
    'Social',
    COALESCE(NEW.created_at, NOW()),
    jsonb_build_object(
      'voter_id', NEW.voter_id,
      'voter_name', voter_name,
      'target_id', NEW.target_id,
      'action', 'received'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_honor_votes_notebook ON public.honor_votes;
CREATE TRIGGER trg_honor_votes_notebook
AFTER INSERT ON public.honor_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_honor_vote_to_notebook();

-- =============================================================================
-- End of Migration
-- =============================================================================
