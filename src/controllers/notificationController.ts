import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('does not exist') || msg?.includes('42P01');

// ---------------------------------------------------------------------------
// Internal helper — call this from other controllers to push a notification
// ---------------------------------------------------------------------------

export async function pushNotification(opts: {
  userId: string;   // recipient
  type: string;     // 'message' | 'group_message' | 'verification' | 'honor' | 'bet_result' | 'match'
  title: string;
  body?: string;
  link?: string;    // frontend route, e.g. '/chat/uuid/uuid'
  actorId?: string; // who triggered it (used for mute checks)
  roomId?: string;  // group room id (used for mute checks)
}): Promise<void> {
  const { userId, type, title, body, link, actorId, roomId } = opts;
  try {
    // Check mutes — skip notification if target has muted the actor or room
    if (actorId || roomId) {
      let muteQuery = supabase
        .from('mutes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (actorId)  muteQuery = muteQuery.eq('muted_user_id', actorId);
      else if (roomId) muteQuery = muteQuery.eq('muted_room_id', roomId);
      const { count } = await muteQuery;
      if ((count ?? 0) > 0) return;
    }

    const { error } = await supabase.from('notifications').insert({
      user_id:  userId,
      type,
      title,
      body:     body    ?? null,
      link:     link    ?? null,
      actor_id: actorId ?? null,
    });

    if (error && !SCHEMA_MISSING(error.message)) {
      logger.warn(`[Notification] Insert failed for ${userId}:`, error.message);
    }
  } catch (err: any) {
    if (!SCHEMA_MISSING(err?.message ?? '')) {
      logger.warn(`[Notification] pushNotification threw for ${userId}:`, err?.message);
    }
  }
}

// ---------------------------------------------------------------------------
// GET /notifications — last 50 for the current user, unread first
// ---------------------------------------------------------------------------

export const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, link, read, actor_id, created_at')
    .eq('user_id', userId)
    .order('read', { ascending: true })        // unread first
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (SCHEMA_MISSING(error.message)) return res.json([]);
    throw error;
  }
  res.json(data ?? []);
});

// ---------------------------------------------------------------------------
// GET /notifications/unread-count
// ---------------------------------------------------------------------------

export const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error && SCHEMA_MISSING(error.message)) return res.json({ count: 0 });
  res.json({ count: count ?? 0 });
});

// ---------------------------------------------------------------------------
// POST /notifications/read — mark specific ids as read
// Body: { ids: string[] }
// ---------------------------------------------------------------------------

export const markRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) return res.json({ ok: true });

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .in('id', ids);

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /notifications/read-all
// ---------------------------------------------------------------------------

export const markAllRead = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// DELETE /notifications/:id
// ---------------------------------------------------------------------------

export const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  await supabase
    .from('notifications')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', userId); // ensure ownership

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /notifications/nudge/:targetId
// Send a "nudge" to a chat partner who hasn't checked in today
// Rate-limited: one nudge per sender→target per calendar day (best-effort)
// ---------------------------------------------------------------------------

export const nudgePartner = catchAsync(async (req: Request, res: Response) => {
  const senderId = req.user?.id;
  if (!senderId) throw new UnauthorizedError('Not authenticated.');
  const { targetId } = req.params;
  if (!targetId || targetId === senderId) {
    return res.status(400).json({ message: 'Invalid target.' });
  }

  // Best-effort rate limit: one nudge per day per pair
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', targetId)
    .eq('actor_id', senderId)
    .eq('type', 'nudge')
    .gte('created_at', `${todayStr}T00:00:00Z`)
    .maybeSingle();

  if (existing) {
    return res.status(429).json({ message: 'Already nudged today.' });
  }

  // Get sender's name for the notification
  const { data: sender } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', senderId)
    .single();

  await pushNotification({
    userId: String(targetId),
    type: 'nudge',
    title: `${sender?.name ?? 'Your partner'} is nudging you!`,
    body: "They noticed you haven't checked in today. Don't break the streak!",
    link: `/chat`,
    actorId: senderId,
  });

  res.json({ ok: true });
});
