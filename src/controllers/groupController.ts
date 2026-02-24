import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors';

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
  const { name, description, domain, creatorId } = req.body;
  if (!name || !creatorId) throw new BadRequestError('name and creatorId are required.');

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .insert({ name, description: description || null, domain: domain || null, creator_id: creatorId })
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

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('timestamp', { ascending: true });

  if (error) {
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
  const { senderId, content, messageType = 'text', mediaUrl } = req.body;

  if (!senderId || !content) throw new BadRequestError('senderId and content are required.');

  const payload: Record<string, any> = {
    sender_id: senderId,
    room_id: roomId,
    content,
    message_type: messageType,
  };
  if (mediaUrl) payload.media_url = mediaUrl;

  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select()
    .single();

  if (error) {
    logger.error('Error sending group message:', error.message);
    throw new InternalServerError('Failed to send group message.');
  }
  res.status(201).json(data);
});

/**
 * GET /groups/:roomId/members — list room members with profile info.
 */
export const getRoomMembers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { roomId } = req.params;

  const { data, error } = await supabase
    .from('chat_room_members')
    .select('user_id, joined_at, profiles(name, avatar_url)')
    .eq('room_id', roomId);

  if (error) {
    logger.error('Error fetching room members:', error.message);
    throw new InternalServerError('Failed to fetch room members.');
  }
  res.json(data || []);
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
