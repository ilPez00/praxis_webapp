import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError } from '../utils/appErrors';
import logger from '../utils/logger';

/**
 * POST /api/streams
 * Start a new live stream
 */
export const startStream = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { title, description, stream_type, room_id } = req.body;

  // End any existing live stream for this user
  await supabase
    .from('streams')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'live');

  const { data, error } = await supabase
    .from('streams')
    .insert({
      user_id: userId,
      title: title || 'Live Stream',
      description: description || null,
      stream_type: stream_type || 'camera',
      room_id: room_id || null,
    })
    .select()
    .single();

  if (error) {
    logger.error('[Stream] Failed to create stream:', error);
    throw error;
  }

  logger.info(`[Stream] User ${userId} started stream ${data.id}`);
  res.status(201).json(data);
});

/**
 * POST /api/streams/:id/end
 * End a live stream
 */
export const endStream = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;

  const { data, error } = await supabase
    .from('streams')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) throw new NotFoundError('Stream not found');

  logger.info(`[Stream] Stream ${id} ended`);
  res.json(data);
});

/**
 * GET /api/streams/live
 * Get all currently live streams
 */
export const getLiveStreams = catchAsync(async (req: Request, res: Response) => {
  const { room_id } = req.query as { room_id?: string };

  let query = supabase
    .from('streams')
    .select('*, profiles!streams_user_id_fkey(name, avatar_url, username)')
    .eq('status', 'live')
    .order('viewer_count', { ascending: false });

  if (room_id) {
    query = query.eq('room_id', room_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  res.json(data || []);
});

/**
 * GET /api/streams/:id
 * Get stream details
 */
export const getStream = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('streams')
    .select('*, profiles!streams_user_id_fkey(name, avatar_url, username)')
    .eq('id', id)
    .single();

  if (error || !data) throw new NotFoundError('Stream not found');

  res.json(data);
});

/**
 * POST /api/streams/:id/viewer-count
 * Update viewer count (called by broadcaster periodically)
 */
export const updateViewerCount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;
  const { count } = req.body;

  if (typeof count !== 'number' || count < 0) {
    throw new BadRequestError('count must be a non-negative number');
  }

  const { data, error } = await supabase
    .from('streams')
    .update({
      viewer_count: count,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('peak_viewers')
    .single();

  if (error) throw error;

  // Update peak separately to use greatest()
  if (data && count > (data.peak_viewers || 0)) {
    await supabase
      .from('streams')
      .update({ peak_viewers: count })
      .eq('id', id);
  }

  res.json({ ok: true });
});

/**
 * POST /api/streams/:id/donate
 * Send honor points to a streamer
 */
export const donateToStream = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;
  const { amount, message } = req.body;

  if (!amount || typeof amount !== 'number' || amount < 1) {
    throw new BadRequestError('amount must be at least 1');
  }

  // Get stream to find streamer
  const { data: stream, error: streamErr } = await supabase
    .from('streams')
    .select('user_id, status')
    .eq('id', id)
    .single();

  if (streamErr || !stream) throw new NotFoundError('Stream not found');
  if (stream.status !== 'live') throw new BadRequestError('Stream is not live');
  if (stream.user_id === userId) throw new BadRequestError('Cannot donate to your own stream');

  // Check donor balance
  const { data: donor } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single();

  const balance = donor?.praxis_points ?? 0;
  if (balance < amount) {
    throw new BadRequestError(`Insufficient PP (have ${balance}, need ${amount})`);
  }

  // Deduct from donor, add to streamer, record donation — all best-effort
  await Promise.all([
    supabase.from('profiles')
      .update({ praxis_points: balance - amount })
      .eq('id', userId),
    supabase.rpc('increment_field', {
      table_name: 'profiles',
      field_name: 'praxis_points',
      row_id: stream.user_id,
      amount: amount,
    }).then(({ error }) => {
      // Fallback if RPC doesn't exist
      if (error) {
        return supabase.from('profiles')
          .select('praxis_points')
          .eq('id', stream.user_id)
          .single()
          .then(({ data: streamer }) => {
            return supabase.from('profiles')
              .update({ praxis_points: (streamer?.praxis_points ?? 0) + amount })
              .eq('id', stream.user_id);
          });
      }
    }),
    supabase.from('stream_donations').insert({
      stream_id: id,
      donor_id: userId,
      amount,
      message: message || null,
    }),
    supabase.from('streams')
      .update({ total_honors: (stream as any).total_honors ? (stream as any).total_honors + amount : amount })
      .eq('id', id),
  ]);

  logger.info(`[Stream] User ${userId} donated ${amount} PP to stream ${id}`);
  res.json({ ok: true, spent: amount });
});
