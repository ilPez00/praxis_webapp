import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, ForbiddenError, NotFoundError, InternalServerError } from '../utils/appErrors';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('42P01') || msg?.includes('42703');

/** GET /offers — list open job offers, newest first */
export const getOffers = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { type, domain, city } = req.query;

  let query = supabase
    .from('offers')
    .select('*, poster:profiles!poster_id(id, name, avatar_url, is_premium)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type as string);
  if (domain) query = query.eq('domain', domain as string);
  if (city) query = query.ilike('city', `%${city}%`);

  const { data, error } = await query;

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      logger.warn('offers table not found — returning []. Run migrations.');
      return res.json([]);
    }
    throw new InternalServerError('Failed to fetch offers.');
  }

  res.json(data || []);
});

/** POST /offers — create a new offer */
export const createOffer = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { title, description, type, domain, city, compensation, remote, requirements, contact } = req.body;
  if (!title?.trim() || !type?.trim()) throw new BadRequestError('title and type are required.');

  const { data, error } = await supabase
    .from('offers')
    .insert({
      poster_id: userId,
      title: title.trim(),
      description: description?.trim() || null,
      type: type.trim(), // 'job' | 'gig' | 'volunteer' | 'internship' | 'collab'
      domain: domain?.trim() || null,
      city: city?.trim() || null,
      compensation: compensation?.trim() || null,
      remote: remote ?? false,
      requirements: requirements?.trim() || null,
      contact: contact?.trim() || null,
      status: 'open',
    })
    .select()
    .single();

  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      return res.status(503).json({ message: 'Offers feature not yet enabled. Run DB migrations.' });
    }
    logger.error('Error creating offer:', error.message);
    throw new InternalServerError(`Failed to create offer: ${error.message}`);
  }

  res.status(201).json(data);
});

/** DELETE /offers/:id — close/delete an offer (poster only) */
export const deleteOffer = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { data: offer } = await supabase.from('offers').select('poster_id').eq('id', id).single();
  if (!offer) throw new NotFoundError('Offer not found.');
  if (offer.poster_id !== userId) throw new ForbiddenError('Only the poster can delete this offer.');

  const { error } = await supabase.from('offers').delete().eq('id', id);
  if (error) throw new InternalServerError('Failed to delete offer.');
  res.json({ message: 'Offer deleted.' });
});

/** PATCH /offers/:id/close — mark offer as closed */
export const closeOffer = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');
  const { id } = req.params;

  const { data: offer } = await supabase.from('offers').select('poster_id').eq('id', id).single();
  if (!offer) throw new NotFoundError('Offer not found.');
  if (offer.poster_id !== userId) throw new ForbiddenError('Only the poster can close this offer.');

  const { error } = await supabase.from('offers').update({ status: 'closed' }).eq('id', id);
  if (error) throw new InternalServerError('Failed to close offer.');
  res.json({ success: true });
});
