import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors';
import { pushNotification } from './notificationController';

function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const getMessages = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { user1Id, user2Id } = req.params as { user1Id: string; user2Id: string };
  const requesterId = req.user?.id;

  if (!user1Id || !user2Id) {
    throw new BadRequestError('Both user IDs are required.');
  }

  // Only allow reading conversations the requester is part of
  if (requesterId && requesterId !== user1Id && requesterId !== user2Id) {
    return res.status(403).json({ error: 'You can only read your own conversations.' });
  }

  // Log for debugging (without sensitive data)
  logger.info('[getMessages] Fetching messages between users');

  // Fetch messages between two users (bidirectional)
  // Split into two queries and combine results (more reliable than .or() with and())
  const [result1, result2] = await Promise.all([
    // Messages from user1 to user2
    // NOTE: `messages` table has `media_url` + `message_type` but NOT `media_type`.
    // (media_type lives on `posts`, not messages — don't re-add it here.)
    supabase
      .from('messages')
      .select('id, sender_id, receiver_id, room_id, content, media_url, message_type, metadata, timestamp')
      .eq('sender_id', user1Id)
      .eq('receiver_id', user2Id)
      .order('timestamp', { ascending: true }),
    // Messages from user2 to user1
    supabase
      .from('messages')
      .select('id, sender_id, receiver_id, room_id, content, media_url, message_type, metadata, timestamp')
      .eq('sender_id', user2Id)
      .eq('receiver_id', user1Id)
      .order('timestamp', { ascending: true }),
  ]);

  if (result1.error) {
    if (result1.error.message?.includes('schema cache') || result1.error.message?.includes('not found')) {
      logger.warn('messages table not found — returning empty list. Run migrations/setup.sql.');
      return res.status(200).json([]);
    }
    logger.error('Supabase error fetching messages (direction 1):', JSON.stringify({
      message: result1.error.message,
      details: result1.error.details,
      hint: result1.error.hint,
      code: result1.error.code,
    }));
    throw new InternalServerError('Failed to fetch messages.');
  }

  if (result2.error) {
    logger.error('Supabase error fetching messages (direction 2):', JSON.stringify({
      message: result2.error.message,
      details: result2.error.details,
      hint: result2.error.hint,
      code: result2.error.code,
    }));
    throw new InternalServerError('Failed to fetch messages.');
  }

  // Combine and sort all messages by timestamp
  const allMessages = [...(result1.data ?? []), ...(result2.data ?? [])]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.status(200).json(allMessages);
});

export const sendMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { receiverId, content, goalNodeId, messageType, mediaUrl, metadata } = req.body;
  // Use authenticated user's ID as sender — prevents impersonation
  const senderId = req.user?.id;
  if (!senderId) {
    throw new BadRequestError('Authentication required.');
  }

  if (!receiverId || !content) {
    throw new BadRequestError('Receiver ID and content are required.');
  }

  // Build the insert payload; all extra fields are optional
  // Sanitize content to prevent XSS
  const insertPayload: Record<string, any> = {
    sender_id: senderId,
    receiver_id: receiverId,
    content: sanitizeHtml(content),
  };

  if (goalNodeId !== undefined) insertPayload.goal_node_id = goalNodeId;
  if (messageType !== undefined) insertPayload.message_type = messageType;
  if (mediaUrl !== undefined) insertPayload.media_url = mediaUrl;
  if (metadata !== undefined) insertPayload.metadata = metadata;

  // Insert the new message into the Supabase 'messages' table
  const { data, error } = await supabase
    .from('messages')
    .insert(insertPayload)
    .select() // Select the newly inserted row
    .single();

  if (error) {
    logger.error('Supabase error sending message:', error.message);
    throw new InternalServerError('Failed to send message.');
  }

  // Notify receiver (fire-and-forget, mute-checked inside pushNotification)
  const senderProfile = await supabase.from('profiles').select('name').eq('id', senderId).single();
  const senderName: string = senderProfile.data?.name || 'Someone';
  pushNotification({
    userId: receiverId,
    type: 'message',
    title: senderName,
    body: content.length > 80 ? content.slice(0, 80) + '…' : content,
    link: `/communication`,
    actorId: senderId,
  }).catch(err => logger.warn('Fire-and-forget failed:', err?.message));

  res.status(201).json({ message: 'Message sent successfully.', sentMessage: data });
});
