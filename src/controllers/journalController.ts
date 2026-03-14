import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';

export const addEntry = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { nodeId, note, mood } = req.body;
  if (!nodeId) throw new BadRequestError('nodeId is required.');

  const { data, error } = await supabase
    .from('node_journal_entries')
    .insert({ user_id: userId, node_id: nodeId, note: note ?? null, mood: mood ?? null })
    .select('id, node_id, note, mood, logged_at')
    .single();

  if (error) throw error;
  res.status(201).json(data);
});

export const getEntries = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { nodeId, limit = '20' } = req.query as { nodeId?: string; limit?: string };
  if (!nodeId) throw new BadRequestError('nodeId query param required.');

  const { data, error } = await supabase
    .from('node_journal_entries')
    .select('id, node_id, note, mood, logged_at')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .order('logged_at', { ascending: false })
    .limit(Math.min(parseInt(limit, 10) || 20, 100));

  if (error) throw error;
  res.json(data ?? []);
});

export const getRecentEntries = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { limit = '50' } = req.query as { limit?: string };

  const { data, error } = await supabase
    .from('node_journal_entries')
    .select('id, node_id, note, mood, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(Math.min(parseInt(limit, 10) || 50, 200));

  if (error) throw error;
  res.json(data ?? []);
});
