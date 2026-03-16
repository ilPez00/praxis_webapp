import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, NotFoundError, ForbiddenError, InternalServerError } from '../utils/appErrors';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('42P01');

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
  const { lat, lng, radius, limit: limitParam } = req.query;
  const userLat = lat ? parseFloat(lat as string) : null;
  const userLng = lng ? parseFloat(lng as string) : null;
  const radiusKm = radius ? parseFloat(radius as string) : 50;
  const hasGeo = userLat !== null && userLng !== null && !isNaN(userLat!) && !isNaN(userLng!);
  const maxResults = Math.min(limitParam ? parseInt(limitParam as string, 10) : (hasGeo ? 10 : 50), 200);

  let query = supabase
    .from('events')
    .select(`
      *,
      creator:profiles!creator_id(id, name, avatar_url),
      rsvps:event_rsvps(user_id, status)
    `)
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (!hasGeo) query = query.limit(maxResults);

  const { data, error } = await query;

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
      })
      .slice(0, maxResults);
  }

  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
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

  const basePayload = {
    creator_id: userId,
    title,
    description: description || null,
    event_date: eventDate,
    event_time: eventTime || null,
    location: location || null,
  };

  // Try with geo columns first; fall back to base payload if columns don't exist yet
  const COLUMN_MISSING = (msg: string) => msg?.includes('42703') || msg?.toLowerCase().includes('column') && msg?.includes('does not exist');

  let { data: event, error } = await supabase
    .from('events')
    .insert({ ...basePayload, latitude: latitude ?? null, longitude: longitude ?? null, city: city || null })
    .select()
    .single();

  if (error && COLUMN_MISSING(error.message)) {
    logger.warn('Geo columns missing on events table — retrying without lat/lng/city. Run migrations to enable geo features.');
    ({ data: event, error } = await supabase
      .from('events')
      .insert(basePayload)
      .select()
      .single());
  }

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      logger.warn('events table not found. Run migrations/setup.sql.');
      return res.status(503).json({ message: 'Events feature not yet enabled. Run DB migrations.' });
    }
    logger.error('Error creating event:', error.message);
    throw new InternalServerError(`Failed to create event: ${error.message}`);
  }

  // Fire-and-forget: create a linked group chat room for this event
  if (event?.id) {
    supabase.from('chat_rooms').insert({
      name: event.title,
      description: `Group for event: ${event.title}`,
      creator_id: userId,
      type: 'event',
      event_id: event.id,
    }).then(({ error: roomErr }) => {
      if (roomErr) logger.warn('Could not auto-create event group room:', roomErr.message);
    });
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

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('creator_id')
    .eq('id', id)
    .single();

  if (fetchError || !event) throw new NotFoundError('Event not found.');
  if (event.creator_id !== userId && !profile?.is_admin) {
    throw new ForbiddenError('Only the creator or an admin can delete this event.');
  }

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

  const { data: rsvp, error } = await supabase
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

  // If status is 'going', auto-join the linked group chat
  if (status === 'going') {
    const { data: room } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();
    
    if (room) {
      await supabase
        .from('chat_room_members')
        .upsert({ room_id: room.id, user_id: userId }, { onConflict: 'room_id,user_id' });
      logger.info(`User ${userId} auto-joined group room ${room.id} after RSVPing 'going' to event ${eventId}`);
    }
  }

  res.json(rsvp);
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

import crypto from 'crypto';

const QR_CHECKIN_AWARD = 50; // PP awarded per event check-in
const CHECKIN_WINDOW_HOURS = 24; // Token valid for 24h after event start

function getAppSecret(): string {
  const secret = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'praxis-dev-secret';
  return secret;
}

function signToken(payload: string): string {
  return crypto.createHmac('sha256', getAppSecret()).update(payload).digest('hex');
}

/**
 * GET /events/:id/checkin-token
 * Returns a signed check-in token for the organizer to display as QR code.
 * Token encodes { eventId, exp } and is valid for CHECKIN_WINDOW_HOURS after event start.
 */
export const getCheckinToken = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const eventId = String(req.params.id);

  const { data: event, error } = await supabase
    .from('events')
    .select('id, creator_id, event_date, event_time')
    .eq('id', eventId)
    .single();

  if (error || !event) throw new NotFoundError('Event not found.');
  if (event.creator_id !== userId) throw new ForbiddenError('Only the event organizer can generate a check-in token.');

  // Token expires 24h after event start (or 24h from now if start is in the past)
  const eventStart = event.event_date
    ? new Date(`${event.event_date}T${event.event_time || '00:00:00'}`)
    : new Date();
  const exp = Math.max(eventStart.getTime(), Date.now()) + CHECKIN_WINDOW_HOURS * 3600 * 1000;

  const payload = Buffer.from(JSON.stringify({ eventId, exp })).toString('base64url');
  const sig = signToken(payload);
  const token = `${payload}.${sig}`;

  res.json({ token, exp });
});

/**
 * POST /events/:id/checkin
 * Body: { token }
 * Verifies the HMAC token, prevents duplicate check-ins, awards 10 PP to BOTH.
 */
export const checkinEvent = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const eventId = String(req.params.id);
  const { token } = req.body as { token?: string };
  if (!token) throw new BadRequestError('token is required.');

  // Parse and verify token
  const parts = token.split('.');
  if (parts.length !== 2) throw new BadRequestError('Invalid token format.');
  const [payload, sig] = parts;
  const expectedSig = signToken(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    throw new BadRequestError('Invalid or tampered token.');
  }

  let parsed: { eventId: string; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    throw new BadRequestError('Malformed token payload.');
  }

  if (parsed.eventId !== eventId) throw new BadRequestError('Token does not match this event.');
  if (Date.now() > parsed.exp) throw new BadRequestError('Check-in token has expired.');

  // Check for duplicate attendance
  const { data: existing } = await supabase
    .from('event_checkins')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { data: profile } = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
    return res.json({ success: true, alreadyCheckedIn: true, newBalance: profile?.praxis_points ?? 0 });
  }

  // Get event details to find creator
  const { data: event } = await supabase.from('events').select('creator_id').eq('id', eventId).single();
  if (!event) throw new NotFoundError('Event not found.');

  // Record attendance
  const { error: insertErr } = await supabase
    .from('event_checkins')
    .insert({ event_id: eventId, user_id: userId });

  if (insertErr) {
    logger.error('Error recording event checkin:', insertErr.message);
    throw new InternalServerError('Failed to record check-in.');
  }

  // Award 10 PP to Attendee
  const { data: attendeeProfile } = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
  await supabase.from('profiles').update({ 
    praxis_points: (attendeeProfile?.praxis_points ?? 0) + 10 
  }).eq('id', userId);

  // Award 10 PP to Creator
  const { data: creatorProfile } = await supabase.from('profiles').select('praxis_points').eq('id', event.creator_id).single();
  await supabase.from('profiles').update({ 
    praxis_points: (creatorProfile?.praxis_points ?? 0) + 10 
  }).eq('id', event.creator_id);

  res.json({ success: true, alreadyCheckedIn: false });
});

/**
 * PUT /events/:id
 * Updates an event. Only creator or admin.
 */
export const updateEvent = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const { title, description, eventDate, eventTime, location, latitude, longitude, city, type } = req.body;

  const { data: event } = await supabase.from('events').select('creator_id').eq('id', id).single();
  if (!event) throw new NotFoundError('Event not found.');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  if (event.creator_id !== userId && !profile?.is_admin) {
    throw new ForbiddenError('Not authorized to edit this event.');
  }

  const updates: any = {
    title: title?.trim(),
    description: description?.trim() || null,
    event_date: eventDate,
    event_time: eventTime || null,
    location: location?.trim() || null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    city: city || null,
    type: type || null,
  };

  const { data, error } = await supabase.from('events').update(updates).eq('id', id).select().single();
  if (error) {
    logger.error('Error updating event:', error.message);
    throw new InternalServerError(error.message);
  }

  res.json(data);
});

/**
 * GET /events/:id/attendees
 * Returns list of verified attendees. Only creator/admin.
 */
export const getVerifiedAttendees = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const { data: event } = await supabase.from('events').select('creator_id').eq('id', id).single();
  if (!event) throw new NotFoundError('Event not found.');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  if (event.creator_id !== userId && !profile?.is_admin) {
    throw new ForbiddenError('Only creator can view verified attendee list.');
  }

  const { data, error } = await supabase
    .from('event_checkins')
    .select(`
      user_id,
      created_at,
      profiles:user_id(id, name, avatar_url)
    `)
    .eq('event_id', id);

  if (error) throw new InternalServerError(error.message);
  res.json(data);
});
