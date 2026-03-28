/**
 * Betting Validation Schemas
 * Zod schemas for validating betting input
 */

import { z } from 'zod';

/**
 * Create bet validation
 */
export const createBetSchema = z.object({
  goalNodeId: z
    .string()
    .uuid('Invalid goal node ID format')
    .optional(),
  
  goalName: z
    .string()
    .min(1, 'Goal name is required')
    .max(200, 'Goal name too long'),
  
  deadline: z
    .string()
    .datetime('Invalid deadline format (ISO 8601 required)'),
  
  stakePoints: z
    .number()
    .int('Stake points must be an integer')
    .min(1, 'Stake points must be at least 1')
    .max(10000, 'Stake points cannot exceed 10000'),
  
  opponentType: z
    .enum(['self', 'duel'])
    .default('self'),
});

export type CreateBetInput = z.infer<typeof createBetSchema>;

/**
 * Cancel bet validation
 */
export const cancelBetSchema = z.object({});

export type CancelBetInput = z.infer<typeof cancelBetSchema>;
