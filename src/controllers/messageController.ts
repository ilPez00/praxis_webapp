import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient'; // Import the Supabase client
// import { Message } from '../models/Message'; // Message model type is not directly used after Supabase integration

export const getMessages = async (req: Request, res: Response) => {
  const { user1Id, user2Id } = req.params as { user1Id: string; user2Id: string };

  if (!user1Id || !user2Id) {
    return res.status(400).json({ message: 'Both user IDs are required.' });
  }

  // Fetch messages where sender is user1 and receiver is user2 OR sender is user2 and receiver is user1
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(senderId.eq.${user1Id},receiverId.eq.${user2Id}),and(senderId.eq.${user2Id},receiverId.eq.${user1Id})`)
    .order('timestamp', { ascending: true });

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  res.status(200).json(data);
};

export const sendMessage = async (req: Request, res: Response) => {
  const { senderId, receiverId, content } = req.body;

  if (!senderId || !receiverId || !content) {
    return res.status(400).json({ message: 'Sender ID, receiver ID, and content are required.' });
  }

  // Insert the new message into the Supabase 'messages' table
  const { data, error } = await supabase
    .from('messages')
    .insert({ senderId, receiverId, content })
    .select() // Select the newly inserted row
    .single();

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  res.status(201).json({ message: 'Message sent successfully.', sentMessage: data });
};
