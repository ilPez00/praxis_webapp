import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, NotFoundError, BadRequestError, ForbiddenError, InternalServerError } from '../utils/appErrors';
import { classifyPostDomain, bumpDomainProficiency } from '../utils/proficiency';
import { recordActivity } from '../utils/recordActivity';

const handleSupabaseError = (error: any) => {
  logger.error('Supabase error (posts):', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
  
  // Check for specific errors
  if (error.message?.includes('reference')) {
    logger.error('Posts table missing "reference" column - run migrations/fix_posts_table.sql');
  }
  
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
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
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

  // 2. Fetch recent posts to score — 60 is enough for a meaningful ranked feed
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, user_id, user_name, user_avatar_url, title, content, media_url, media_type, context, reference, created_at, post_likes(count), post_comments(count)')
    .order('created_at', { ascending: false })
    .limit(60);

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
      ? supabase.from('profiles').select('id, honor_score, karma_score, reliability_score, latitude, longitude, level').in('id', authorIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    authorIds.length > 0
      ? supabase.from('goal_trees').select('user_id, nodes').in('user_id', authorIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const authorProfiles: any[] = authorProfilesRes.status === 'fulfilled' ? (authorProfilesRes.value.data ?? []) : [];
  const authorTrees: any[] = authorTreesRes.status === 'fulfilled' ? (authorTreesRes.value.data ?? []) : [];

  const profileMap = new Map<string, any>();
  for (const p of authorProfiles) profileMap.set(p.id, p);

  const domainMap = new Map<string, Set<string>>();
  for (const tree of authorTrees) {
    const domains = new Set<string>((tree.nodes ?? []).map((n: any) => n.domain).filter(Boolean));
    domainMap.set(tree.user_id, domains);
  }

  // Combined rep = honor_score + log(1 + max(karma_score, 0))
  const combinedReps = authorProfiles.map((p) => (p.honor_score ?? 0) + Math.log1p(Math.max(p.karma_score ?? 0, 0)));
  const maxCombinedRep = Math.max(1, ...combinedReps);
  const combinedRepMap = new Map<string, number>();
  authorProfiles.forEach((p, i) => combinedRepMap.set(p.id, combinedReps[i]));

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

    // Combined rep (honor + karma) — 20%
    const honor = (combinedRepMap.get(p.user_id) ?? 0) / maxCombinedRep;

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
      user_level: authorProfile?.level ?? 1,
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
// GET /posts/:id  — single post
// ---------------------------------------------------------------------------
export const getPost = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const userId = req.query.userId as string | undefined;

  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, user_name, user_avatar_url, title, content, media_url, media_type, context, reference, created_at, post_likes(count), post_comments(count)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError('Post not found.');
    handleSupabaseError(error);
  }
  if (!data) throw new NotFoundError('Post not found.');

  const post: any = {
    ...data,
    like_count: data.post_likes?.[0]?.count ?? 0,
    comment_count: data.post_comments?.[0]?.count ?? 0,
    user_liked: false,
  };

  if (userId) {
    const { data: like } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', userId)
      .maybeSingle();
    post.user_liked = !!like;
  }

  return res.status(200).json(post);
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
    .limit(25);

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
    .limit(30);

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
  const userId = req.user?.id;
  const { userName, userAvatarUrl, title, content, mediaUrl, mediaType, context, reference } = req.body;

  logger.info('[createPost] Received request:', {
    userId,
    userName,
    contentLength: content?.length,
    context,
    hasReference: !!reference,
  });

  if (!userId) throw new BadRequestError('Authentication required.');
  if (!userName) throw new BadRequestError('userName is required.');
  if (!content || !content.trim()) throw new BadRequestError('content is required.');
  if (content.length > 10000) throw new BadRequestError('Content exceeds maximum length of 10,000 characters.');

  logger.info('[createPost] Validation passed, attempting insert...');

  try {
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

    if (error) {
      logger.error('[createPost] Supabase insert failed:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      
      // Check for specific errors
      if (error.message?.includes('reference')) {
        logger.error('[createPost] Missing reference column - run migrations!');
      }
      if (error.message?.includes('policy')) {
        logger.error('[createPost] RLS policy violation - check user_id matches auth.uid()');
      }
      
      throw new InternalServerError(error.message);
    }
    
    if (!data) {
      logger.error('[createPost] Insert returned no data');
      throw new InternalServerError('Insert returned no data.');
    }

    logger.info('[createPost] Post created successfully:', { postId: data.id });
    
    // Record activity for streak (fire-and-forget)
    recordActivity(userId).catch(() => {});
    
    // Track social reward for post creation
    try {
      await supabase.rpc('progress_user_quest', {
        p_user_id: userId,
        p_quest_type: 'create_post',
        p_amount: 1,
      });
    } catch (questErr) {
      logger.warn('[createPost] Quest progress failed:', questErr);
    }
    
    res.status(201).json({ ...data, like_count: 0, comment_count: 0, user_liked: false });
  } catch (err: any) {
    // Re-throw if it's already an app error
    if (err.constructor.name !== 'InternalServerError') {
      logger.error('[createPost] Unexpected error:', err);
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------
// DELETE /posts/:id
// Body: { userId }
// ---------------------------------------------------------------------------
export const deletePost = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

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
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

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

  // Award +0.01% domain proficiency to the post author (fire-and-forget)
  (async () => {
    try {
      const { data: post } = await supabase
        .from('posts')
        .select('user_id, content, title')
        .eq('id', postId)
        .single();
      if (!post || post.user_id === userId) return; // don't self-award
      const text = [post.title, post.content].filter(Boolean).join(' ');
      const domain = classifyPostDomain(text);
      if (domain) await bumpDomainProficiency(post.user_id, domain, 0.01);
    } catch {
      // non-fatal
    }
  })();

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
  const userId = req.user?.id;
  const { userName, userAvatarUrl, content } = req.body;

  if (!userId) throw new BadRequestError('Authentication required.');
  if (!userName) throw new BadRequestError('userName is required.');
  if (!content || !content.trim()) throw new BadRequestError('content is required.');
  if (content.length > 10000) throw new BadRequestError('Content exceeds maximum length of 10,000 characters.');

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
  
  // Track social reward / quest progress for comment
  try {
    await supabase.rpc('progress_user_quest', {
      p_user_id: userId,
      p_quest_type: 'comment_post',
      p_amount: 1,
    });
  } catch (questErr) {
    logger.warn('[addComment] Quest progress failed:', questErr);
  }

  res.status(201).json(data);
});

// ---------------------------------------------------------------------------
// DELETE /posts/:postId/comments/:commentId
// Body: { userId }
// ---------------------------------------------------------------------------
export const deleteComment = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { commentId } = req.params;
  const userId = req.user?.id;

  if (!userId) throw new BadRequestError('Authentication required.');

  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) handleSupabaseError(error);

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// POST /posts/:id/vote
// Body: { value: 1 | -1 }
// Awards/deducts PP and karma from the post author based on vote direction.
// ---------------------------------------------------------------------------
export const votePost = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const voterId = req.user?.id;
  if (!voterId) throw new ForbiddenError('Authentication required.');

  const postId = req.params.id;
  const { value } = req.body;

  if (value !== 1 && value !== -1) throw new BadRequestError('value must be 1 or -1.');

  // Fetch post to get author
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .maybeSingle();

  if (postError) handleSupabaseError(postError);
  if (!post) throw new NotFoundError('Post not found.');

  const authorId: string = post.user_id;

  // Fetch existing vote
  const { data: existing, error: voteError } = await supabase
    .from('post_votes')
    .select('value')
    .eq('post_id', postId)
    .eq('user_id', voterId)
    .maybeSingle();

  if (voteError) handleSupabaseError(voteError);

  let delta = 0;
  let netVote: number = value;

  if (!existing) {
    // No existing vote — insert
    const { error: insertError } = await supabase
      .from('post_votes')
      .insert({ post_id: postId, user_id: voterId, value });
    if (insertError) handleSupabaseError(insertError);
    delta = value === 1 ? 3 : -1;
  } else if (existing.value === value) {
    // Same direction — toggle off (delete)
    const { error: deleteError } = await supabase
      .from('post_votes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', voterId);
    if (deleteError) handleSupabaseError(deleteError);
    delta = value === 1 ? -3 : 1;
    netVote = 0;
  } else {
    // Opposite direction — flip
    const { error: updateError } = await supabase
      .from('post_votes')
      .update({ value })
      .eq('post_id', postId)
      .eq('user_id', voterId);
    if (updateError) handleSupabaseError(updateError);
    delta = value === 1 ? 4 : -4;
  }

  // Award/deduct PP and karma to author (skip self-votes)
  if (delta !== 0 && authorId !== voterId) {
    const { data: authorProfile, error: profileError } = await supabase
      .from('profiles')
      .select('praxis_points, karma_score')
      .eq('id', authorId)
      .single();

    if (!profileError && authorProfile) {
      const newPoints = Math.max(0, (authorProfile.praxis_points ?? 0) + delta);
      const newKarma = (authorProfile.karma_score ?? 0) + delta;
      await supabase
        .from('profiles')
        .update({ praxis_points: newPoints, karma_score: newKarma })
        .eq('id', authorId);
    }
  }

  // Compute current score from all votes
  const { data: allVotes, error: allVotesError } = await supabase
    .from('post_votes')
    .select('value')
    .eq('post_id', postId);

  if (allVotesError) handleSupabaseError(allVotesError);

  const score = (allVotes ?? []).reduce((sum: number, v: any) => sum + (v.value ?? 0), 0);

  return res.status(200).json({ score, userVote: netVote });
});

// ---------------------------------------------------------------------------
// GET /posts/:id/vote
// Returns the current vote score and the requesting user's vote (0 if none).
// ---------------------------------------------------------------------------
export const getPostVote = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const postId = req.params.id;
  const userId = req.user?.id;

  const [userVoteResult, allVotesResult] = await Promise.all([
    userId
      ? supabase.from('post_votes').select('value').eq('post_id', postId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('post_votes').select('value').eq('post_id', postId),
  ]);

  if (allVotesResult.error) handleSupabaseError(allVotesResult.error);

  const score = (allVotesResult.data ?? []).reduce((sum: number, v: any) => sum + (v.value ?? 0), 0);
  const userVote: number = (userVoteResult as any).data?.value ?? 0;

  return res.status(200).json({ score, userVote });
});
