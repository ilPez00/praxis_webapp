import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, ForbiddenError, NotFoundError, InternalServerError } from '../utils/appErrors';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('42P01') || msg?.includes('42703');

export const getPlaces = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { type, lat, lng, radius, limit: limitParam } = req.query;
  const userLat = lat ? parseFloat(lat as string) : null;
  const userLng = lng ? parseFloat(lng as string) : null;
  const radiusKm = radius ? parseFloat(radius as string) : 50;
  const hasGeo = userLat !== null && userLng !== null && !isNaN(userLat!) && !isNaN(userLng!);
  const maxResults = Math.min(limitParam ? parseInt(limitParam as string, 10) : (hasGeo ? 10 : 50), 200);

  let query = supabase
    .from('places')
    .select('*, owner:profiles!owner_id(id, name, avatar_url), members:place_members(user_id)')
    .order('name', { ascending: true });

  if (type) query = query.eq('type', type as string);
  // When no geo, apply DB-level limit for performance
  if (!hasGeo) query = query.limit(maxResults);

  const { data, error } = await query;

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      logger.warn('places table not found — returning []. Run migrations.');
      return res.json([]);
    }
    throw new InternalServerError('Failed to fetch places.');
  }

  let places = data || [];

  if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
    const R = 6371;
    places = places
      .map((p: any) => {
        if (p.latitude != null && p.longitude != null) {
          const dLat = ((p.latitude - userLat) * Math.PI) / 180;
          const dLng = ((p.longitude - userLng) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((userLat * Math.PI) / 180) * Math.cos((p.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return { ...p, distance_km: Math.round(dist * 10) / 10 };
        }
        return { ...p, distance_km: null };
      })
      .filter((p: any) => p.distance_km === null || p.distance_km <= radiusKm)
      .sort((a: any, b: any) => {
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return a.distance_km - b.distance_km;
      })
      .slice(0, maxResults);
  }

  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
  res.json(places);
});

export const createPlace = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { name, type, address, city, latitude, longitude, description, website, schedule } = req.body;
  if (!name?.trim() || !type?.trim()) throw new BadRequestError('name and type are required.');

  const { data, error } = await supabase
    .from('places')
    .insert({
      owner_id: userId,
      name: name.trim(),
      type: type.trim(),
      address: address?.trim() || null,
      city: city?.trim() || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      description: description?.trim() || null,
      website: website?.trim() || null,
      schedule: schedule?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      return res.status(503).json({ message: 'Places feature not yet enabled. Run DB migrations.' });
    }
    logger.error('Error creating place:', error.message);
    throw new InternalServerError(`Failed to create place: ${error.message}`);
  }

  // Auto-create linked group room for the place
  if (data?.id) {
    supabase.from('chat_rooms').insert({
      name: data.name,
      description: `Community group for ${data.name}`,
      creator_id: userId,
      type: 'place',
      place_id: data.id,
    }).then(({ error: roomErr }) => {
      if (roomErr) logger.warn('Could not auto-create place group room:', roomErr.message);
    });
  }

  res.status(201).json(data);
});

export const joinPlace = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { error } = await supabase
    .from('place_members')
    .upsert({ place_id: id, user_id: userId }, { onConflict: 'place_id,user_id' });

  if (error) {
    if (SCHEMA_MISSING(error.message)) return res.status(503).json({ message: 'Run DB migrations.' });
    throw new InternalServerError('Failed to join place.');
  }

  // Auto-join the linked group chat
  const { data: room } = await supabase
    .from('chat_rooms')
    .select('id')
    .eq('place_id', id)
    .maybeSingle();

  if (room) {
    await supabase
      .from('chat_room_members')
      .upsert({ room_id: room.id, user_id: userId }, { onConflict: 'room_id,user_id' });
  }
  
  res.json({ success: true });
});

export const leavePlace = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { error } = await supabase
    .from('place_members')
    .delete()
    .eq('place_id', id)
    .eq('user_id', userId);

  if (error) throw new InternalServerError('Failed to leave place.');
  res.json({ success: true });
});

export const updatePlace = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;
  const { name, type, address, city, latitude, longitude, description, website, schedule, tags } = req.body;

  // Check if owner or admin
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  const { data: place } = await supabase.from('places').select('owner_id').eq('id', id).single();

  if (!place) throw new NotFoundError('Place not found.');
  if (place.owner_id !== userId && !profile?.is_admin) {
    throw new ForbiddenError('Only the owner or an admin can update this place.');
  }

  const { data, error } = await supabase
    .from('places')
    .update({
      name: name?.trim() || undefined,
      type: type?.trim() || undefined,
      address: address?.trim() || null,
      city: city?.trim() || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      description: description?.trim() || null,
      website: website?.trim() || null,
      schedule: schedule?.trim() || null,
      tags: tags ?? undefined,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new InternalServerError('Failed to update place.');
  res.json(data);
});

export const deletePlace = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  const { data: place } = await supabase.from('places').select('owner_id').eq('id', id).single();

  if (!place) throw new NotFoundError('Place not found.');
  if (place.owner_id !== userId && !profile?.is_admin) {
    throw new ForbiddenError('Only the owner or an admin can delete this place.');
  }

  const { error } = await supabase.from('places').delete().eq('id', id);
  if (error) throw new InternalServerError('Failed to delete place.');
  res.json({ message: 'Place deleted.' });
});
