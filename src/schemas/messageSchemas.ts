/**
 * Message & Communication Validation Schemas
 */

import { z } from 'zod';

/**
 * Send message validation
 */
// Frontend (ChatRoom.tsx) sends camelCase `receiverId` / `messageType`.
// Accept both camelCase and snake_case so either contract works, and normalize
// after parsing so the controller can keep reading camelCase.
export const sendMessageSchema = z
  .object({
    receiverId: z.string().uuid('Invalid receiver ID format').optional(),
    receiver_id: z.string().uuid('Invalid receiver ID format').optional(),
    content: z
      .string()
      .min(1, 'Message content is required')
      .max(5000, 'Message too long (max 5000 characters)'),
    messageType: z.enum(['text', 'image', 'voice']).optional(),
    message_type: z.enum(['text', 'image', 'voice']).optional(),
    goalNodeId: z.string().optional(),
    mediaUrl: z.string().optional(),
    metadata: z.any().optional(),
  })
  .refine((v) => v.receiverId || v.receiver_id, {
    message: 'receiverId is required',
    path: ['receiverId'],
  })
  .transform((v) => ({
    ...v,
    receiverId: v.receiverId ?? v.receiver_id!,
    messageType: v.messageType ?? v.message_type ?? 'text',
  }));

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
