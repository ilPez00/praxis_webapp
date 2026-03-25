/**
 * Message & Communication Validation Schemas
 */

import { z } from 'zod';

/**
 * Send message validation
 */
export const sendMessageSchema = z.object({
  receiver_id: z
    .string()
    .uuid('Invalid receiver ID format'),
  
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(5000, 'Message too long (max 5000 characters)'),
  
  message_type: z
    .enum(['text', 'image', 'voice'])
    .optional()
    .default('text'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * Create chat room validation
 */
export const createChatRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(100, 'Room name too long'),
  
  domain: z
    .string()
    .max(50, 'Domain too long')
    .optional(),
  
  member_ids: z
    .array(z.string().uuid())
    .min(1, 'At least one member required')
    .max(50, 'Too many members (max 50)'),
});

export type CreateChatRoomInput = z.infer<typeof createChatRoomSchema>;
