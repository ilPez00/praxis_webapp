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
export const getEvents = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(id, full_name, avatar_url),
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

  res.json(data || []);
});

/**
 * POST /events
 * Create a new event.
 * Body: { title, description?, eventDate, eventTime?, location? }
 */
export const createEvent = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { title, description, eventDate, eventTime, location } = req.body;
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
    })
    .select()
    .single();

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      logger.warn('events table not found. Run migrations/setup.sql.');
      return res.status(503).json({ message: 'Events feature not yet enabled. Run DB migrations.' });
    }
    logger.error('Error creating event:', error.message);
    throw new InternalServerError('Failed to create event.');
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
