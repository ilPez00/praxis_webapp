import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, NotFoundError, BadRequestError, InternalServerError } from '../utils/appErrors';

const handleSupabaseError = (error: any) => {
  logger.error('Supabase error (posts):', error);
  throw new InternalServerError(error.message || 'Internal server error during Supabase operation.');
};

// ---------------------------------------------------------------------------
// GET /posts?context=general&userId=<uuid>
// ---------------------------------------------------------------------------
export const getPosts = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const context = (req.query.context as string) || 'general';
  const userId = req.query.userId as string | undefined;

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*, post_likes(count), post_comments(count)')
    .eq('context', context)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('not found')) {
      logger.warn('posts table not found — returning empty list.');
      return res.status(200).json([]);
    }
    handleSupabaseError(error);
  }

  const postList = (posts ?? []).map((p: any) => ({
    ...p,
    like_count: p.post_likes?.[0]?.count ?? 0,
    comment_count: p.post_comments?.[0]?.count ?? 0,
    user_liked: false,
  }));

  // Attach user_liked if userId provided
  if (userId && postList.length > 0) {
    const postIds = postList.map((p: any) => p.id);
    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    const likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
    for (const p of postList) {
      p.user_liked = likedSet.has(p.id);
    }
  }

  return res.status(200).json(postList);
});

// ---------------------------------------------------------------------------
// POST /posts
// Body: { userId, userName, userAvatarUrl?, content, mediaUrl?, mediaType?, context }
// ---------------------------------------------------------------------------
export const createPost = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, userName, userAvatarUrl, content, mediaUrl, mediaType, context } = req.body;

  if (!userId) throw new BadRequestError('userId is required.');
  if (!userName) throw new BadRequestError('userName is required.');
  if (!content || !content.trim()) throw new BadRequestError('content is required.');

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      user_name: userName,
      user_avatar_url: userAvatarUrl ?? null,
      content: content.trim(),
      media_url: mediaUrl ?? null,
      media_type: mediaType ?? null,
      context: context || 'general',
    })
    .select()
    .single();

  if (error) handleSupabaseError(error);
  if (!data) throw new InternalServerError('Insert returned no data.');

  res.status(201).json({ ...data, like_count: 0, comment_count: 0, user_liked: false });
});

// ---------------------------------------------------------------------------
// DELETE /posts/:id
// Body: { userId }
// ---------------------------------------------------------------------------
export const deletePost = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) throw new BadRequestError('userId is required.');

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) handleSupabaseError(error);

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// POST /posts/:id/likes
// Body: { userId }  — toggles like on/off
// ---------------------------------------------------------------------------
export const toggleLike = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: postId } = req.params;
  const { userId } = req.body;

  if (!userId) throw new BadRequestError('userId is required.');

  const { data: existing, error: fetchError } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') handleSupabaseError(fetchError);

  if (existing) {
    const { error } = await supabase.from('post_likes').delete().eq('id', existing.id);
    if (error) handleSupabaseError(error);
    return res.status(200).json({ liked: false });
  }

  const { error: insertError } = await supabase
    .from('post_likes')
    .insert({ post_id: postId, user_id: userId });

  if (insertError) handleSupabaseError(insertError);

  return res.status(200).json({ liked: true });
});

// ---------------------------------------------------------------------------
// GET /posts/:id/comments
// ---------------------------------------------------------------------------
export const getComments = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: postId } = req.params;

  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) handleSupabaseError(error);

  res.status(200).json(data ?? []);
});

// ---------------------------------------------------------------------------
// POST /posts/:id/comments
// Body: { userId, userName, userAvatarUrl?, content }
// ---------------------------------------------------------------------------
export const addComment = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { id: postId } = req.params;
  const { userId, userName, userAvatarUrl, content } = req.body;

  if (!userId) throw new BadRequestError('userId is required.');
  if (!userName) throw new BadRequestError('userName is required.');
  if (!content || !content.trim()) throw new BadRequestError('content is required.');

  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      user_name: userName,
      user_avatar_url: userAvatarUrl ?? null,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) handleSupabaseError(error);
  if (!data) throw new InternalServerError('Insert returned no data.');

  res.status(201).json(data);
});

// ---------------------------------------------------------------------------
// DELETE /posts/:postId/comments/:commentId
// Body: { userId }
// ---------------------------------------------------------------------------
export const deleteComment = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { commentId } = req.params;
  const { userId } = req.body;

  if (!userId) throw new BadRequestError('userId is required.');

  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) handleSupabaseError(error);

  res.status(204).send();
});
