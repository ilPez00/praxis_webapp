import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

/**
 * GET /diary/entries
 * Get diary entries with filters
 */
router.get('/entries', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const {
    entry_type,
    tag,
    search,
    limit = '100',
    offset = '0',
  } = req.query as {
    entry_type?: string;
    tag?: string;
    search?: string;
    limit?: string;
    offset?: string;
  };

  // Use the database function for filtered queries
  const { data, error } = await supabase.rpc('get_diary_entries', {
    p_user_id: userId,
    p_entry_type: entry_type === 'all' ? null : entry_type,
    p_tag: tag === 'all' ? null : tag,
    p_search: search || null,
    p_limit: Math.min(parseInt(limit, 10) || 100, 200),
    p_offset: parseInt(offset, 10) || 0,
  });

  if (error) throw error;
  res.json(data || []);
}));

/**
 * GET /diary/stats
 * Get diary statistics for user
 */
router.get('/stats', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data, error } = await supabase.rpc('get_diary_stats', {
    p_user_id: userId,
  });

  if (error) throw error;
  res.json(data || {});
}));

/**
 * POST /diary/entries
 * Create a new diary entry
 */
router.post('/entries', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const {
    entry_type = 'note',
    title,
    content,
    source_table,
    source_id,
    metadata = {},
    latitude,
    longitude,
    location_name,
    location_accuracy,
    tags,
    mood,
    is_private = true,
    occurred_at,
  } = req.body;

  if (!entry_type) throw new BadRequestError('entry_type is required');

  // Validate coordinates if provided
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    throw new BadRequestError('latitude must be between -90 and 90');
  }
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    throw new BadRequestError('longitude must be between -180 and 180');
  }

  const { data, error } = await supabase
    .from('diary_entries')
    .insert({
      user_id: userId,
      entry_type,
      title: title || null,
      content: content || null,
      source_table: source_table || null,
      source_id: source_id || null,
      metadata: metadata || {},
      latitude: latitude || null,
      longitude: longitude || null,
      location_name: location_name || null,
      location_accuracy: location_accuracy || null,
      tags: tags || null,
      mood: mood || null,
      is_private,
      occurred_at: occurred_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * POST /diary/entries/share
 * Quick share to diary from chat/post/place/event
 */
router.post('/entries/share', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const {
    source_table,  // 'posts', 'profiles', 'places', 'events', 'messages'
    source_id,
    content,       // Optional note to add
    latitude,
    longitude,
    location_name,
    tags,
  } = req.body;

  if (!source_table || !source_id) {
    throw new BadRequestError('source_table and source_id are required');
  }

  // Fetch source data based on table
  let title = '';
  let entryContent = '';
  let metadata = {};
  let entryType = 'note';

  switch (source_table) {
    case 'posts':
      entryType = 'post';
      const { data: postData } = await supabase
        .from('posts')
        .select('content, user_id')
        .eq('id', source_id)
        .single();
      if (postData) {
        title = 'Saved post';
        entryContent = postData.content;
        metadata = { shared_from: 'post', original_user_id: postData.user_id };
      }
      break;

    case 'profiles':
      entryType = 'user';
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, bio, avatar_url')
        .eq('id', source_id)
        .single();
      if (profileData) {
        title = `Saved: ${profileData.name || 'User'}`;
        entryContent = profileData.bio || '';
        metadata = { shared_from: 'profile', avatar_url: profileData.avatar_url };
      }
      break;

    case 'places':
      entryType = 'place';
      const { data: placeData } = await supabase
        .from('places')
        .select('name, description, city, tags, latitude, longitude')
        .eq('id', source_id)
        .single();
      if (placeData) {
        title = `Saved place: ${placeData.name}`;
        entryContent = placeData.description || '';
        metadata = { 
          shared_from: 'place', 
          city: placeData.city,
          place_tags: placeData.tags,
          place_latitude: placeData.latitude,
          place_longitude: placeData.longitude,
        };
      }
      break;

    case 'events':
      entryType = 'event';
      const { data: eventData } = await supabase
        .from('events')
        .select('title, description, event_date, city')
        .eq('id', source_id)
        .single();
      if (eventData) {
        title = `Saved event: ${eventData.title}`;
        entryContent = eventData.description || '';
        metadata = { 
          shared_from: 'event',
          event_date: eventData.event_date,
          city: eventData.city,
        };
      }
      break;

    case 'messages':
      entryType = 'message';
      const { data: messageData } = await supabase
        .from('messages')
        .select('content, sender_id, created_at')
        .eq('id', source_id)
        .single();
      if (messageData) {
        title = 'Saved message';
        entryContent = messageData.content;
        metadata = { 
          shared_from: 'message',
          sender_id: messageData.sender_id,
          sent_at: messageData.created_at,
        };
      }
      break;

    default:
      throw new BadRequestError(`Unsupported source_table: ${source_table}`);
  }

  // Add user's note if provided
  if (content) {
    entryContent = entryContent ? `${entryContent}\n\n---\n\n${content}` : content;
  }

  // Create diary entry
  const { data, error } = await supabase
    .from('diary_entries')
    .insert({
      user_id: userId,
      entry_type: entryType,
      title: title || 'Saved item',
      content: entryContent || null,
      source_table,
      source_id,
      metadata,
      latitude: latitude || null,
      longitude: longitude || null,
      location_name: location_name || null,
      tags: tags || null,
      is_private: true,
      occurred_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /diary/entries/:id
 * Update a diary entry
 */
router.patch('/entries/:id', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;
  const updates = req.body;

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('diary_entries')
    .select('user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('Entry not found');
  }

  const { data, error } = await supabase
    .from('diary_entries')
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
 * PATCH /diary/entries/:id/pin
 * Pin or unpin a diary entry
 */
router.patch('/entries/:id/pin', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;
  const { is_pinned } = req.body;

  const { data, error } = await supabase
    .from('diary_entries')
    .update({ is_pinned, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/**
 * DELETE /diary/entries/:id
 * Delete a diary entry
 */
router.delete('/entries/:id', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;

  const { error } = await supabase
    .from('diary_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
  res.json({ message: 'Entry deleted' });
}));

/**
 * GET /diary/tags
 * Get user's diary tags
 */
router.get('/tags', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data, error } = await supabase
    .from('diary_entries')
    .select('tags')
    .eq('user_id', userId)
    .not('tags', 'is', null);

  if (error) throw error;

  // Flatten and deduplicate tags
  const allTags = data?.flatMap(d => d.tags || []) || [];
  const uniqueTags = [...new Set(allTags)].sort();

  res.json(uniqueTags);
}));

export default router;
