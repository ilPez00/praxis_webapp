import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
import logger from '../utils/logger'; // Import the logger
import { catchAsync, BadRequestError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync
// import { Message } from '../models/Message'; // Message model type is not directly used after Supabase integration

export const getMessages = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { user1Id, user2Id } = req.params as { user1Id: string; user2Id: string };

  if (!user1Id || !user2Id) {
    throw new BadRequestError('Both user IDs are required.');
  }

  // Fetch messages where sender is user1 and receiver is user2 OR sender is user2 and receiver is user1
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${user1Id},receiver_id.eq.${user2Id}),and(sender_id.eq.${user2Id},receiver_id.eq.${user1Id})`)
    .order('timestamp', { ascending: true });

  if (error) {
    logger.error('Supabase error fetching messages:', error.message);
    throw new InternalServerError('Failed to fetch messages.');
  }

  res.status(200).json(data);
});

export const sendMessage = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { senderId, receiverId, content } = req.body;

  if (!senderId || !receiverId || !content) {
    throw new BadRequestError('Sender ID, receiver ID, and content are required.');
  }

  // Insert the new message into the Supabase 'messages' table
  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select() // Select the newly inserted row
    .single();

  if (error) {
    logger.error('Supabase error sending message:', error.message);
    throw new InternalServerError('Failed to send message.');
  }

  res.status(201).json({ message: 'Message sent successfully.', sentMessage: data });
});
