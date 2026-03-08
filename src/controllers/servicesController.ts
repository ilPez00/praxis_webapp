import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, AppError, BadRequestError, NotFoundError } from '../utils/appErrors';

/**
 * GET /services
 * Query params: type (service|job|gig), domain, q (search), limit, offset
 */
export const listServices = catchAsync(async (req: Request, res: Response) => {
  const { type, domain, q, limit = '24', offset = '0' } = req.query as Record<string, string>;

  let query = supabase
    .from('services')
    .select('id, user_id, user_name, user_avatar_url, title, description, type, domain, price, price_currency, tags, contact_info, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (type) query = query.eq('type', type);
  if (domain) query = query.eq('domain', domain);
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Failed to fetch services.' });
  return res.json(data ?? []);
});

/**
 * GET /services/mine
 * Returns authenticated user's own listings (including inactive).
 */
export const getMyServices = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Failed to fetch your services.' });
  return res.json(data ?? []);
});

/**
 * GET /services/:id
 */
export const getService = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Service listing not found.');
  return res.json(data);
});

/**
 * POST /services
 * Body: { title, description, type, domain, price, price_currency, tags, contact_info }
 */
export const createService = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { title, description, type, domain, price, price_currency, tags, contact_info } = req.body as {
    title: string;
    description?: string;
    type: string;
    domain?: string;
    price?: number;
    price_currency?: string;
    tags?: string[];
    contact_info?: string;
  };

  if (!title?.trim()) throw new BadRequestError('title is required.');
  if (!type || !['service', 'job', 'gig'].includes(type)) {
    throw new BadRequestError('type must be one of: service, job, gig');
  }

  // Fetch user profile for denormalization
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url, praxis_points')
    .eq('id', userId)
    .single();

  const SERVICE_POST_COST = 30;
  const currentPP: number = (profile as any)?.praxis_points ?? 0;
  if (currentPP < SERVICE_POST_COST) {
    throw new AppError(`Not enough PP — posting a service costs ${SERVICE_POST_COST} PP (you have ${currentPP}).`, 402);
  }

  const { data, error } = await supabase
    .from('services')
    .insert({
      user_id: userId,
      user_name: profile?.name ?? 'Unknown',
      user_avatar_url: profile?.avatar_url ?? null,
      title: title.trim(),
      description: description ?? null,
      type,
      domain: domain ?? null,
      price: price ?? null,
      price_currency: price_currency ?? 'negotiable',
      tags: tags ?? [],
      contact_info: contact_info ?? null,
      active: true,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: `Failed to create listing: ${error.message}` });
  return res.status(201).json(data);
});

/**
 * PUT /services/:id
 * Updates own listing.
 */
export const updateService = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const { data: existing } = await supabase.from('services').select('user_id').eq('id', id).single();
  if (!existing) throw new NotFoundError('Service listing not found.');
  if (existing.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

  const { title, description, type, domain, price, price_currency, tags, contact_info, active } = req.body;
  const { data, error } = await supabase
    .from('services')
    .update({ title, description, type, domain, price, price_currency, tags, contact_info, active })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to update listing.' });
  return res.json(data);
});

/**
 * DELETE /services/:id
 */
export const deleteService = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const { data: existing } = await supabase.from('services').select('user_id').eq('id', id).single();
  if (!existing) throw new NotFoundError('Service listing not found.');
  if (existing.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

  await supabase.from('services').delete().eq('id', id);
  return res.json({ success: true });
});
