import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import logger from '../utils/logger'; // Import the logger
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync
import { pushNotification } from './notificationController';
// import { Message } from '../models/Message'; // Message model type is not directly used after Supabase integration

export const getMessages = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { user1Id, user2Id } = req.params as { user1Id: string; user2Id: string };
  const requesterId = (req as any).user?.id;

  if (!user1Id || !user2Id) {
    throw new BadRequestError('Both user IDs are required.');
  }

  // Only allow reading conversations the requester is part of
  if (requesterId && requesterId !== user1Id && requesterId !== user2Id) {
    return res.status(403).json({ error: 'You can only read your own conversations.' });
  }

  // Log Supabase client configuration (for debugging)
  const supabaseUrl = process.env.SUPABASE_URL || 'NOT_SET';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'NOT_SET';
  logger.info(`[getMessages] Supabase URL set: ${supabaseUrl !== 'NOT_SET'}, Key set: ${supabaseKey !== 'NOT_SET'}, Key starts with: ${supabaseKey.slice(0, 10)}...`);

  // Fetch messages between two users (bidirectional)
  // Split into two queries and combine results (more reliable than .or() with and())
  const [result1, result2] = await Promise.all([
    // Messages from user1 to user2
    supabase
      .from('messages')
      .select('id, sender_id, receiver_id, room_id, content, media_url, media_type, metadata, timestamp, created_at')
      .eq('sender_id', user1Id)
      .eq('receiver_id', user2Id)
      .order('timestamp', { ascending: true }),
    // Messages from user2 to user1
    supabase
      .from('messages')
      .select('id, sender_id, receiver_id, room_id, content, media_url, media_type, metadata, timestamp, created_at')
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
  const senderId = (req as any).user?.id;
  if (!senderId) {
    throw new BadRequestError('Authentication required.');
  }

  if (!receiverId || !content) {
    throw new BadRequestError('Receiver ID and content are required.');
  }

  // Build the insert payload; all extra fields are optional
  const insertPayload: Record<string, any> = {
    sender_id: senderId,
    receiver_id: receiverId,
    content,
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
