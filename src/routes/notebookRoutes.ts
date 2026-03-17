import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

/**
 * GET /notebook/entries
 * Get notebook entries with filters
 */
router.get('/entries', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const {
    entry_type,
    domain,
    tag,
    search,
    limit = '100',
    offset = '0',
  } = req.query as {
    entry_type?: string;
    domain?: string;
    tag?: string;
    search?: string;
    limit?: string;
    offset?: string;
  };

  console.log('[notebookRoutes] Fetching entries:', {
    userId,
    entry_type,
    domain,
    tag,
    search,
  });

  // Use the database function for filtered queries
  const { data, error } = await supabase.rpc('get_notebook_entries', {
    p_user_id: userId,
    p_entry_type: entry_type === 'all' ? null : entry_type,
    p_domain: domain === 'all' ? null : domain,
    p_tag: tag === 'all' ? null : tag,
    p_search: search || null,
    p_limit: Math.min(parseInt(limit, 10) || 100, 200),
    p_offset: parseInt(offset, 10) || 0,
  });

  if (error) {
    console.error('[notebookRoutes] Error fetching entries:', error);
    throw error;
  }
  
  console.log('[notebookRoutes] Fetched entries:', data?.length || 0);
  res.json(data || []);
}));

/**
 * GET /notebook/stats
 * Get notebook statistics for user
 */
router.get('/stats', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data, error } = await supabase.rpc('get_notebook_stats', {
    p_user_id: userId,
  });

  if (error) throw error;
  res.json(data || {});
}));

/**
 * POST /notebook/entries
 * Create a new notebook entry
 */
router.post('/entries', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const {
    entry_type = 'note',
    title,
    content,
    mood,
    tags,
    goal_id,
    domain,
    source_table,
    source_id,
    attachments,
    is_private = false,
    metadata,
  } = req.body;

  if (!content) throw new BadRequestError('content is required');

  console.log('[notebookRoutes] Creating entry:', {
    userId,
    entry_type,
    title,
    source_table,
    source_id,
    contentLength: content.length,
  });

  const insertPayload: any = {
    user_id: userId,
    entry_type,
    title: title || null,
    content,
    mood: mood || null,
    tags: tags || null,
    goal_id: goal_id || null,
    domain: domain || null,
    source_table: source_table || null,
    source_id: source_id || null,
    attachments: attachments || [],
    is_private,
    occurred_at: new Date().toISOString(),
  };
  if (metadata) insertPayload.metadata = metadata;

  let { data, error } = await supabase
    .from('notebook_entries')
    .insert(insertPayload)
    .select()
    .single();

  // If metadata column doesn't exist yet, retry without it
  if (error && metadata && error.message?.includes('metadata')) {
    console.log('[notebookRoutes] Retrying without metadata');
    delete insertPayload.metadata;
    ({ data, error } = await supabase
      .from('notebook_entries')
      .insert(insertPayload)
      .select()
      .single());
  }

  if (error) {
    console.error('[notebookRoutes] Error creating entry:', error);
    throw error;
  }
  
  console.log('[notebookRoutes] Entry created successfully:', data.id);
  res.status(201).json(data);
}));

/**
 * PATCH /notebook/entries/:id
 * Update a notebook entry
 */
router.patch('/entries/:id', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;
  const updates = req.body;

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('notebook_entries')
    .select('user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('Entry not found');
  }

  const { data, error } = await supabase
    .from('notebook_entries')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/**
 * PATCH /notebook/entries/:id/pin
 * Pin or unpin a notebook entry
 */
router.patch('/entries/:id/pin', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;
  const { is_pinned } = req.body;

  const { data, error } = await supabase
    .from('notebook_entries')
    .update({ is_pinned, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/**
 * DELETE /notebook/entries/:id
 * Delete a notebook entry
 */
router.delete('/entries/:id', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;

  const { error } = await supabase
    .from('notebook_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
  res.json({ message: 'Entry deleted' });
}));

/**
 * GET /notebook/tags
 * Get user's tags
 */
router.get('/tags', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data, error } = await supabase
    .from('notebook_tags')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) throw error;
  res.json(data || []);
}));

/**
 * POST /notebook/tags
 * Create a new tag
 */
router.post('/tags', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { name, color } = req.body;

  if (!name) throw new BadRequestError('name is required');

  const { data, error } = await supabase
    .from('notebook_tags')
    .insert({
      user_id: userId,
      name,
      color: color || '#8B5CF6',
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /notebook/tags/:id
 * Delete a tag
 */
router.delete('/tags/:id', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;

  const { error } = await supabase
    .from('notebook_tags')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
  res.json({ message: 'Tag deleted' });
}));

export default router;
