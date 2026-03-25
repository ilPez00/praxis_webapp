/**
 * Goal Validation Schemas
 */

import { z } from 'zod';

// Valid domains from the application
export const validDomains = z.enum([
  'Fitness',
  'Career',
  'Learning',
  'Relationships',
  'Finance',
  'Creative',
  'Health',
  'Spiritual',
  'Business',
  'Personal',
]);

export type Domain = z.infer<typeof validDomains>;

/**
 * Create goal validation
 */
export const createGoalSchema = z.object({
  name: z
    .string()
    .min(1, 'Goal name is required')
    .min(3, 'Goal name must be at least 3 characters')
    .max(200, 'Goal name too long'),
  
  domain: validDomains,
  
  description: z
    .string()
    .max(1000, 'Description too long (max 1000 characters)')
    .optional(),
  
  completion_metric: z
    .string()
    .max(500, 'Completion metric too long')
    .optional(),
  
  target_date: z
    .string()
    .datetime()
    .optional()
    .refine(
      (date) => !date || new Date(date) > new Date(),
      'Target date must be in the future'
    ),
  
  parent_id: z
    .string()
    .uuid('Invalid parent goal ID')
    .optional(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

/**
 * Update goal progress validation
 */
export const updateProgressSchema = z.object({
  progress: z
    .number()
    .min(0, 'Progress cannot be negative')
    .max(100, 'Progress cannot exceed 100%'),
});

export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
