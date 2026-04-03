import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync } from '../utils/appErrors';

export const getActiveEvents = catchAsync(async (_req: Request, res: Response) => {
  const now = new Date().toISOString();
  
  const { data: events, error } = await supabase
    .from('seasonal_events')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('ends_at', { ascending: true });

  if (error) {
    // Table might not exist yet - return empty gracefully
    if (error.code === '42P01') {
      return res.json({ events: [] });
    }
    throw error;
  }
  res.json({ events: events || [] });
});

export const getEventBySlug = catchAsync(async (req: Request, res: Response) => {
  const { slug } = req.params;
  
  const { data: event, error } = await supabase
    .from('seasonal_events')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !event) {
    return res.status(404).json({ message: 'Event not found' });
  }
  
  res.json({ event });
});

export const joinEvent = catchAsync(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const userId = req.user!.id;
  
  // Check if event exists and is active
  const { data: event, error: eventError } = await supabase
    .from('seasonal_events')
    .select('*')
    .eq('id', eventId)
    .eq('is_active', true)
    .single();

  if (eventError || !event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  const now = new Date().toISOString();
  if (now < event.starts_at || now > event.ends_at) {
    return res.status(400).json({ message: 'Event is not currently active' });
  }

  // Join or get existing participation
  const { data: existing, error: existingError } = await supabase
    .from('seasonal_event_participants')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    return res.json({ participant: existing, event });
  }

  const { data: participant, error: joinError } = await supabase
    .from('seasonal_event_participants')
    .insert({ event_id: eventId, user_id: userId, progress: 0 })
    .select()
    .single();

  if (joinError) throw joinError;
  res.json({ participant, event });
});

export const getMyEventProgress = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  const { data: participations, error } = await supabase
    .from('seasonal_event_participants')
    .select(`
      *,
      seasonal_events (*)
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (error) throw error;
  res.json({ participations: participations || [] });
});

export const updateProgress = catchAsync(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { increment = 1 } = req.body;
  const userId = req.user!.id;

  // Get current participation
  const { data: participant, error: getError } = await supabase
    .from('seasonal_event_participants')
    .select('*, seasonal_events(*)')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();

  if (getError || !participant) {
    return res.status(404).json({ message: 'Not participating in this event' });
  }

  const event = participant.seasonal_events;
  const newProgress = Math.min(participant.progress + increment, event.target_value);
  const completed = newProgress >= event.target_value;

  const { data: updated, error: updateError } = await supabase
    .from('seasonal_event_participants')
    .update({
      progress: newProgress,
      completed_at: completed && !participant.completed_at ? new Date().toISOString() : participant.completed_at,
    })
    .eq('id', participant.id)
    .select()
    .single();

  if (updateError) throw updateError;

  res.json({
    participant: updated,
    completed,
    rewardsEarned: completed && !participant.completed_at ? {
      pp: event.reward_pp,
      xp: event.reward_xp,
      badge: event.reward_badge,
    } : null,
  });
});

export const claimReward = catchAsync(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const userId = req.user!.id;

  const { data: participant, error: getError } = await supabase
    .from('seasonal_event_participants')
    .select('*, seasonal_events(*)')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();

  if (getError || !participant) {
    return res.status(404).json({ message: 'Not participating in this event' });
  }

  if (!participant.completed_at) {
    return res.status(400).json({ message: 'Event not completed yet' });
  }

  if (participant.reward_claimed) {
    return res.status(400).json({ message: 'Reward already claimed' });
  }

  const event = participant.seasonal_events;

  // Mark as claimed
  const { data: updated, error: updateError } = await supabase
    .from('seasonal_event_participants')
    .update({ reward_claimed: true })
    .eq('id', participant.id)
    .select()
    .single();

  if (updateError) throw updateError;

  res.json({
    participant: updated,
    rewards: {
      pp: event.reward_pp,
      xp: event.reward_xp,
      badge: event.reward_badge,
    },
  });
});

export const getLeaderboard = catchAsync(async (req: Request, res: Response) => {
  const { eventId } = req.params;
  const { limit = 10 } = req.query;

  const { data: leaderboard, error } = await supabase
    .from('seasonal_event_participants')
    .select(`
      *,
      profiles:user_id (
        id,
        name,
        avatar_url
      )
    `)
    .eq('event_id', eventId)
    .order('progress', { ascending: false })
    .limit(Number(limit));

  if (error) throw error;
  res.json({ leaderboard: leaderboard || [] });
});
