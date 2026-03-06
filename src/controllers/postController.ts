import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, NotFoundError, BadRequestError, InternalServerError } from '../utils/appErrors';

const handleSupabaseError = (error: any) => {
  logger.error('Supabase error (posts):', error);
  throw new InternalServerError(error.message || 'Internal server error during Supabase operation.');
};

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('not found') || msg?.includes('42P01');

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// GET /posts/feed?userId=<uuid>
// Personalized feed: scored by goal overlap, proximity, honor, reliability, recency
// Weights: goal overlap 30% | proximity 25% | honor 20% | reliability 15% | recency 10%
// Board membership bonus: ×1.3 for posts in boards the user belongs to
// ---------------------------------------------------------------------------
export const getPersonalizedFeed = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    // No userId — fall through to generic latest feed
    return getPosts(req, res, _next);
  }

  // 1. Load user context in parallel
  const [userProfileRes, userTreeRes, userBoardsRes] = await Promise.allSettled([
    supabase.from('profiles').select('latitude, longitude').eq('id', userId).single(),
    supabase.from('goal_trees').select('nodes').eq('userId', userId).maybeSingle(),
    supabase.from('chat_room_members').select('room_id').eq('user_id', userId),
  ]);

  const userProfile = userProfileRes.status === 'fulfilled' ? userProfileRes.value.data : null;
  const userLat: number | null = userProfile?.latitude ?? null;
  const userLng: number | null = userProfile?.longitude ?? null;

  const myNodes: any[] = userTreeRes.status === 'fulfilled' ? (userTreeRes.value.data?.nodes ?? []) : [];
  const myDomains = new Set<string>(myNodes.map((n: any) => n.domain).filter(Boolean));

  const myBoardIds = new Set<string>(
    userBoardsRes.status === 'fulfilled' ? (userBoardsRes.value.data ?? []).map((r: any) => r.room_id) : []
  );

  // 2. Fetch 200 recent posts across all contexts
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, user_id, user_name, user_avatar_url, title, content, media_url, media_type, context, reference, created_at, post_likes(count), post_comments(count)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    if (SCHEMA_MISSING(error.message)) return res.status(200).json([]);
    handleSupabaseError(error);
  }

  const rawPosts = posts ?? [];
  if (rawPosts.length === 0) return res.status(200).json([]);

  // 3. Collect unique author IDs (exclude self)
  const authorIds = Array.from(
    new Set<string>(rawPosts.map((p: any) => p.user_id).filter((id: string) => id && id !== userId))
  );

  // 4. Load author profiles + goal trees in parallel
  const [authorProfilesRes, authorTreesRes] = await Promise.allSettled([
    authorIds.length > 0
      ? supabase.from('profiles').select('id, honor_score, reliability_score, latitude, longitude').in('id', authorIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    authorIds.length > 0
      ? supabase.from('goal_trees').select('userId, nodes').in('userId', authorIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const authorProfiles: any[] = authorProfilesRes.status === 'fulfilled' ? (authorProfilesRes.value.data ?? []) : [];
  const authorTrees: any[] = authorTreesRes.status === 'fulfilled' ? (authorTreesRes.value.data ?? []) : [];

  const profileMap = new Map<string, any>();
  for (const p of authorProfiles) profileMap.set(p.id, p);

  const domainMap = new Map<string, Set<string>>();
  for (const tree of authorTrees) {
    const domains = new Set<string>((tree.nodes ?? []).map((n: any) => n.domain).filter(Boolean));
    domainMap.set(tree.userId, domains);
  }

  const maxHonor = Math.max(1, ...authorProfiles.map((p) => p.honor_score ?? 0));
  const maxReliability = Math.max(0.01, ...authorProfiles.map((p) => p.reliability_score ?? 0));

  const now = Date.now();

  // 5. Score each post
  const scored = rawPosts.map((p: any) => {
    const authorProfile = profileMap.get(p.user_id);
    const authorDomains = domainMap.get(p.user_id) ?? new Set<string>();

    // Goal overlap (Jaccard) — 30%
    let goalOverlap = 0;
    if (myDomains.size > 0 && authorDomains.size > 0) {
      let overlap = 0;
      for (const d of Array.from(myDomains)) {
        if (authorDomains.has(d)) overlap++;
      }
      const union = new Set([...Array.from(myDomains), ...Array.from(authorDomains)]).size;
      goalOverlap = overlap / union;
    }

    // Proximity — 25% (0 if either party has no location)
    let proximity = 0;
    if (userLat !== null && userLng !== null && authorProfile?.latitude && authorProfile?.longitude) {
      const dist = haversineKm(userLat, userLng, authorProfile.latitude, authorProfile.longitude);
      proximity = dist < 10 ? 1.0 : dist < 50 ? 0.8 : dist < 100 ? 0.5 : dist < 500 ? 0.2 : 0.05;
    }

    // Honor — 20%
    const honor = (authorProfile?.honor_score ?? 0) / maxHonor;

    // Reliability — 15%
    const reliability = (authorProfile?.reliability_score ?? 0) / maxReliability;

    // Recency — 10%
    const ageH = (now - new Date(p.created_at).getTime()) / 3_600_000;
    const recency = ageH < 1 ? 1.0 : ageH < 24 ? 0.8 : ageH < 168 ? 0.5 : ageH < 720 ? 0.2 : 0.05;

    const rawScore = goalOverlap * 0.30 + proximity * 0.25 + honor * 0.20 + reliability * 0.15 + recency * 0.10;

    // Board membership bonus
    const isInBoard = myBoardIds.has(p.context);
    const finalScore = rawScore * (isInBoard ? 1.3 : 1.0);

    return {
      ...p,
      like_count: p.post_likes?.[0]?.count ?? 0,
      comment_count: p.post_comments?.[0]?.count ?? 0,
      user_liked: false,
      _score: finalScore,
    };
  });

  // 6. Sort, take top 30
  scored.sort((a: any, b: any) => b._score - a._score);
  const top30 = scored.slice(0, 30);

  // 7. Attach user_liked
  if (top30.length > 0) {
    const postIds = top30.map((p: any) => p.id);
    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);
    const likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
    for (const p of top30) {
      p.user_liked = likedSet.has(p.id);
    }
  }

  const result = top30.map(({ _score: _s, ...rest }: any) => rest);
  return res.status(200).json(result);
});

// ---------------------------------------------------------------------------
// GET /posts?context=general&userId=<uuid>
// ---------------------------------------------------------------------------
export const getPosts = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const context = (req.query.context as string) || 'general';
  const userId = req.query.userId as string | undefined;

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, user_id, user_name, user_avatar_url, title, content, media_url, media_type, context, reference, created_at, post_likes(count), post_comments(count)')
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
// GET /posts/by-user/:userId  — all posts by a specific user across all contexts
// ---------------------------------------------------------------------------
export const getUserPosts = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId } = req.params;
  if (!userId) throw new BadRequestError('userId required.');

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, user_id, user_name, user_avatar_url, title, content, media_url, media_type, context, reference, created_at, post_likes(count), post_comments(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (SCHEMA_MISSING(error.message)) return res.status(200).json([]);
    handleSupabaseError(error);
  }

  const postList = (posts ?? []).map((p: any) => ({
    ...p,
    like_count: p.post_likes?.[0]?.count ?? 0,
    comment_count: p.post_comments?.[0]?.count ?? 0,
    user_liked: false,
  }));

  return res.status(200).json(postList);
});

// ---------------------------------------------------------------------------
// POST /posts
// Body: { userId, userName, userAvatarUrl?, content, mediaUrl?, mediaType?, context }
// ---------------------------------------------------------------------------
export const createPost = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userId, userName, userAvatarUrl, title, content, mediaUrl, mediaType, context, reference } = req.body;

  if (!userId) throw new BadRequestError('userId is required.');
  if (!userName) throw new BadRequestError('userName is required.');
  if (!content || !content.trim()) throw new BadRequestError('content is required.');

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      user_name: userName,
      user_avatar_url: userAvatarUrl ?? null,
      title: title?.trim() || null,
      content: content.trim(),
      media_url: mediaUrl ?? null,
      media_type: mediaType ?? null,
      context: context || 'general',
      reference: reference ?? null,
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
