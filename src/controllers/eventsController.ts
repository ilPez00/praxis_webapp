import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('does not exist') || msg?.includes('42P01');

/**
 * GET /events
 * Returns all upcoming events (ordered by date asc), with RSVP counts.
 */
// Haversine distance in km between two lat/lng pairs
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const getEvents = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { lat, lng, radius } = req.query;
  const userLat = lat ? parseFloat(lat as string) : null;
  const userLng = lng ? parseFloat(lng as string) : null;
  const radiusKm = radius ? parseFloat(radius as string) : 50;

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!creator_id(id, name, avatar_url),
      rsvps:event_rsvps(user_id, status)
    `)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      logger.warn('events table not found — returning empty list. Run migrations/setup.sql.');
      return res.json([]);
    }
    throw new InternalServerError('Failed to fetch events.');
  }

  let events = data || [];

  // If caller provides geo coords, attach distance and optionally filter
  if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
    events = events
      .map((e: any) => {
        if (e.latitude != null && e.longitude != null) {
          const dist = haversineKm(userLat, userLng, e.latitude, e.longitude);
          return { ...e, distance_km: Math.round(dist * 10) / 10 };
        }
        return { ...e, distance_km: null }; // no geo — include but no distance
      })
      .filter((e: any) => e.distance_km === null || e.distance_km <= radiusKm)
      .sort((a: any, b: any) => {
        // Events with geo sort by distance; others fall to the end
        if (a.distance_km === null && b.distance_km === null) return 0;
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return a.distance_km - b.distance_km;
      });
  }

  res.json(events);
});

/**
 * POST /events
 * Create a new event.
 * Body: { title, description?, eventDate, eventTime?, location? }
 */
export const createEvent = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { title, description, eventDate, eventTime, location, latitude, longitude, city } = req.body;
  if (!title || !eventDate) {
    throw new BadRequestError('title and eventDate are required.');
  }

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      creator_id: userId,
      title,
      description: description || null,
      event_date: eventDate,
      event_time: eventTime || null,
      location: location || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      city: city || null,
    })
    .select()
    .single();

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      logger.warn('events table not found. Run migrations/setup.sql.');
      return res.status(503).json({ message: 'Events feature not yet enabled. Run DB migrations.' });
    }
    logger.error('Error creating event:', error.message);
    throw new InternalServerError(`Failed to create event: ${error.message}`);
  }

  res.status(201).json(event);
});

/**
 * DELETE /events/:id
 * Delete an event (only creator can delete).
 */
export const deleteEvent = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { id } = req.params;

  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('creator_id')
    .eq('id', id)
    .single();

  if (fetchError || !event) throw new NotFoundError('Event not found.');
  if (event.creator_id !== userId) throw new ForbiddenError('Only the creator can delete this event.');

  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new InternalServerError('Failed to delete event.');

  res.json({ message: 'Event deleted.' });
});

/**
 * POST /events/:id/rsvp
 * RSVP to an event. Upserts the user's RSVP status.
 * Body: { status: 'going' | 'maybe' | 'not_going' }
 */
export const rsvpEvent = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { id: eventId } = req.params;
  const { status } = req.body;

  if (!['going', 'maybe', 'not_going'].includes(status)) {
    throw new BadRequestError('status must be going, maybe, or not_going.');
  }

  const { data, error } = await supabase
    .from('event_rsvps')
    .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' })
    .select()
    .single();

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      return res.status(503).json({ message: 'Events feature not yet enabled. Run DB migrations.' });
    }
    logger.error('Error saving RSVP:', error.message);
    throw new InternalServerError('Failed to save RSVP.');
  }

  res.json(data);
});

/**
 * DELETE /events/:id/rsvp
 * Remove the user's RSVP from an event.
 */
export const removeRsvp = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { id: eventId } = req.params;

  const { error } = await supabase
    .from('event_rsvps')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) throw new InternalServerError('Failed to remove RSVP.');

  res.json({ message: 'RSVP removed.' });
});
