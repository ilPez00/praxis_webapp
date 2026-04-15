/**
 * Tracker Validation Schemas
 */

import { z } from 'zod';

/**
 * Tracker entry validation
 */
export const trackerEntrySchema = z.object({
  tracker_id: z
    .string()
    .uuid('Invalid tracker ID format'),
  
  data: z
    .object({})
    .catchall(z.any())
    .refine(
      (data) => Object.keys(data).length > 0,
      'Data object cannot be empty'
    ),
  
  logged_at: z
    .string()
    .datetime()
    .optional(),
});

export type TrackerEntryInput = z.infer<typeof trackerEntrySchema>;

/**
 * Tracker log validation (POST /trackers/log)
 * Matches what the frontend sends: { type: string, data: object, logged_at?: string }
 */
export const trackerLogSchema = z.object({
  type: z
    .string()
    .min(1, 'type is required'),
  
  data: z.record(z.string(), z.any()),
  
  logged_at: z
    .string()
    .datetime()
    .optional(),
});

export type TrackerLogInput = z.infer<typeof trackerLogSchema>;

/**
 * Tracker creation validation
 */
export const createTrackerSchema = z.object({
  type: z
    .string()
    .min(1, 'Tracker type is required')
    .max(50, 'Tracker type too long'),
  
  name: z
    .string()
    .min(1, 'Tracker name is required')
    .max(100, 'Tracker name too long'),
  
  goal: z
    .object({
      template_rows: z.array(z.object({
        label: z.string(),
        unit: z.string().optional(),
        category: z.string().optional(),
      })).optional(),
    })
    .optional(),
});

export type CreateTrackerInput = z.infer<typeof createTrackerSchema>;
