import { Request, Response } from 'express';
import { mockDatabase } from '../services/MockDatabase';
import { Message } from '../models/Message';
import { v4 as uuidv4 } from 'uuid';

export const getMessages = (req: Request, res: Response) => {
  const { user1Id, user2Id } = req.params;

  if (!user1Id || !user2Id) {
    return res.status(400).json({ message: 'Both user IDs are required.' });
  }

  const messages = mockDatabase.getMessagesBetweenUsers(user1Id, user2Id);
  res.status(200).json(messages);
};

export const sendMessage = (req: Request, res: Response) => {
  const { senderId, receiverId, content } = req.body;

  if (!senderId || !receiverId || !content) {
    return res.status(400).json({ message: 'Sender ID, receiver ID, and content are required.' });
  }

  // Optional: Check if senderId and receiverId exist as users in mockDatabase
  const sender = mockDatabase.getUserById(senderId);
  const receiver = mockDatabase.getUserById(receiverId);

  if (!sender || !receiver) {
    return res.status(404).json({ message: 'Sender or receiver user not found.' });
  }

  const newMessage: Message = {
    id: uuidv4(),
    senderId,
    receiverId,
    content,
    timestamp: new Date(),
  };

  mockDatabase.saveMessage(newMessage);
  res.status(201).json({ message: 'Message sent successfully.', message: newMessage });
};
