import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';

/**
 * GET /api/narratives
 * Get user's saved Axiom narratives
 */
export const getNarratives = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { type, limit = '50' } = req.query as { type?: string; limit?: string };

  let query = supabase
    .from('axiom_narratives')
    .select('id, narrative_type, title, created_at, metadata, source, pp_cost')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(parseInt(limit, 10) || 50, 200));

  if (type) {
    query = query.eq('narrative_type', type);
  }

  const { data, error } = await query;

  if (error) throw error;

  res.json(data || []);
});

/**
 * GET /api/narratives/:id
 * Get single narrative with full content
 */
export const getNarrative = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;

  const { data, error } = await supabase
    .from('axiom_narratives')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ message: 'Narrative not found' });
    }
    throw error;
  }

  res.json(data);
});

/**
 * GET /api/narratives/:id/download
 * Download narrative as markdown file
 */
export const downloadNarrative = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;

  const { data, error } = await supabase
    .from('axiom_narratives')
    .select('title, content')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ message: 'Narrative not found' });
    }
    throw error;
  }

  // Set headers for file download
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${data.title || 'axiom-narrative'}.md"`);
  res.send(data.content);
});
