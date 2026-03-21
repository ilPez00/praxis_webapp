import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors';
import { pushNotification } from './notificationController';

/**
 * GET /groups — list all public chat rooms, optionally filtered by domain.
 * Returns each room with a nested member count.
 */
export const listRooms = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let query = supabase
    .from('chat_rooms')
    .select('*, chat_room_members(count)')
    .order('created_at', { ascending: false });

  if (req.query.domain) {
    query = query.eq('domain', req.query.domain as string);
  }

  if (req.query.type) {
    query = query.eq('type', req.query.type as string);
  }

  const { data, error } = await query;
  if (error) {
    // Gracefully handle missing tables (schema cache / relation not found errors)
    if (
      error.message?.includes('schema cache') ||
      error.message?.includes('not found') ||
      error.message?.includes('does not exist') ||
      error.code === '42P01'
    ) {
      logger.warn('chat_rooms table not found — returning empty list. Run migrations/setup.sql.');
      return res.json([]);
    }
    logger.error('Error fetching chat rooms:', error.message);
    throw new InternalServerError('Failed to fetch chat rooms.');
  }
  res.json(data || []);
});

/**
 * POST /groups — create a new chat room; creator is auto-joined.
 */
export const createRoom = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name, description, domain, type, creatorId } = req.body;
  if (!name || !creatorId) throw new BadRequestError('name and creatorId are required.');

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .insert({ name, description: description || null, domain: domain || null, type: type || 'board', creator_id: creatorId })
    .select()
    .single();

  if (error) {
    logger.error('Error creating chat room:', error.message);
    throw new InternalServerError('Failed to create chat room.');
  }

  // Auto-join the creator
  await supabase
    .from('chat_room_members')
    .upsert({ room_id: room.id, user_id: creatorId }, { onConflict: 'room_id,user_id' });

  res.status(201).json(room);
});

/**
 * POST /groups/:roomId/join — join a chat room.
 */
export const joinRoom = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  if (!userId) throw new BadRequestError('userId is required.');

  const { error } = await supabase
    .from('chat_room_members')
    .upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id' });

  if (error) {
    logger.error('Error joining chat room:', error.message);
    throw new InternalServerError('Failed to join chat room.');
  }
  res.json({ joined: true, roomId });
});

/**
 * DELETE /groups/:roomId/leave — leave a chat room.
 */
export const leaveRoom = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  if (!userId) throw new BadRequestError('userId is required.');

  await supabase
    .from('chat_room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  res.json({ left: true, roomId });
});

/**
 * GET /groups/:roomId/messages — fetch all messages in a group room.
 */
export const getRoomMessages = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;
  const requesterId = (req as any).user?.id;

  // Verify requester is a member of this room
  if (requesterId) {
    const { data: membership } = await supabase
      .from('chat_room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', requesterId)
      .maybeSingle();
    if (!membership) {
      return res.status(403).json({ error: 'You must be a member of this room to read messages.' });
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, room_id, content, media_url, media_type, metadata, timestamp, created_at')
    .eq('room_id', roomId)
    .order('timestamp', { ascending: true });

  if (error) {
    if (
      error.message?.includes('schema cache') ||
      error.message?.includes('does not exist') ||
      error.code === '42P01'
    ) {
      logger.warn('messages table not found — returning empty list. Run migrations/setup.sql.');
      return res.json([]);
    }
    logger.error('Error fetching room messages:', error.message);
    throw new InternalServerError('Failed to fetch room messages.');
  }
  res.json(data || []);
});

/**
 * POST /groups/:roomId/messages — send a message to a group room.
 */
export const sendRoomMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;
  const { senderId, content, messageType = 'text', mediaUrl, replyToId, replyPreview, reference } = req.body;

  if (!senderId || !content) throw new BadRequestError('senderId and content are required.');

  // Build metadata: reply preview + optional content reference
  const metadata: Record<string, any> = {};
  if (replyPreview) metadata.reply_preview = replyPreview; // { id, senderName, content }
  if (reference)    metadata.reference    = reference;     // { type, id, title, subtitle, url }

  const payload: Record<string, any> = {
    sender_id:    senderId,
    room_id:      roomId,
    content,
    message_type: messageType,
    metadata:     Object.keys(metadata).length ? metadata : null,
  };
  if (mediaUrl)  payload.media_url   = mediaUrl;
  if (replyToId) payload.reply_to_id = replyToId;

  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select()
    .single();

  if (error) {
    logger.error('Error sending group message:', error.message);
    throw new InternalServerError('Failed to send group message.');
  }

  // Notify all room members except the sender (fire-and-forget, mute-checked inside)
  const { data: members } = await supabase
    .from('chat_room_members')
    .select('user_id')
    .eq('room_id', roomId)
    .neq('user_id', senderId)
    .limit(50);

  if (members && members.length > 0) {
    const senderProfile = await supabase.from('profiles').select('name').eq('id', senderId).single();
    const senderName: string = senderProfile.data?.name || 'Someone';
    const roomName = req.body.roomName as string | undefined;
    const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;
    for (const m of members) {
      pushNotification({
        userId: m.user_id,
        type: 'group_message',
        title: roomName ? `${senderName} in ${roomName}` : senderName,
        body: preview,
        link: `/communication`,
        actorId: senderId,
        roomId: roomId as string,
      }).catch(() => {});
    }
  }

  res.status(201).json(data);
});

/**
 * GET /groups/:roomId/members — list room members with profile info.
 */
export const getRoomMembers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;

  // Fetch member rows first (no join — chat_room_members has no direct FK to profiles)
  const { data: members, error } = await supabase
    .from('chat_room_members')
    .select('user_id, joined_at')
    .eq('room_id', roomId);

  if (error) {
    if (
      error.message?.includes('schema cache') ||
      error.message?.includes('does not exist') ||
      error.code === '42P01'
    ) {
      logger.warn('chat_room_members table not found — returning empty members list. Run migrations/setup.sql.');
      return res.json([]);
    }
    logger.error('Error fetching room members:', error.message);
    throw new InternalServerError('Failed to fetch room members.');
  }
  if (!members || members.length === 0) return res.json([]);

  // Fetch profiles for all member user IDs
  const userIds = members.map((m: any) => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const result = members.map((m: any) => ({
    ...m,
    profiles: profileMap.get(m.user_id) || null,
  }));

  res.json(result);
});

/**
 * POST /groups/:roomId/invite — invite a user to a room (friend invite flow).
 */
export const inviteMember = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId required.' });

  const { error } = await supabase
    .from('chat_room_members')
    .insert({ room_id: roomId, user_id: userId });

  if (error) {
    if (error.code === '23505') return res.json({ message: 'Already a member.' });
    return res.status(500).json({ message: error.message });
  }
  res.status(201).json({ message: 'Invited.' });
});

/**
 * GET /groups/:roomId — get a single room's details.
 */
export const getRoom = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;

  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*, chat_room_members(count)')
    .eq('id', roomId)
    .single();

  if (error) throw new InternalServerError('Failed to fetch room.');
  res.json(data);
});

/**
 * GET /groups/joined?userId=xxx — rooms the user has joined.
 */
export const getJoinedRooms = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.query;
  if (!userId) throw new BadRequestError('userId is required.');

  const { data, error } = await supabase
    .from('chat_room_members')
    .select('room_id, joined_at, chat_rooms(*)')
    .eq('user_id', userId as string);

  if (error) {
    if (
      error.message?.includes('schema cache') ||
      error.message?.includes('does not exist') ||
      error.code === '42P01'
    ) {
      logger.warn('chat_room_members table not found — returning empty joined list.');
      return res.json([]);
    }
    throw new InternalServerError('Failed to fetch joined rooms.');
  }
  res.json(data || []);
});
