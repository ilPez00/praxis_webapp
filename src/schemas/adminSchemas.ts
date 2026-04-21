/**
 * Admin Validation Schemas
 * Zod schemas for validating admin input
 */

import { z } from 'zod';

/**
 * Grant points validation
 */
// Controller accepts either `delta` (signed) or `points` (absolute) — mirror
// that here. Previous schema required `{amount, reason}` which the Users tab
// never sent, so every admin PP adjustment was rejected before reaching the
// handler.
export const grantPointsBodySchema = z.object({
  delta: z.number().int().optional(),
  points: z.number().int().nonnegative().optional(),
  reason: z.string().max(200).optional(),
}).refine(b => b.delta !== undefined || b.points !== undefined, {
  message: 'Provide either delta or points.',
});

/**
 * Ban user validation
 */
export const banUserBodySchema = z.object({
  reason: z.string().max(500, 'Reason must be less than 500 characters'),
  duration: z.number().int().positive('Duration must be positive').optional(),
});

/**
 * Toggle premium validation
 */
export const togglePremiumBodySchema = z.object({
  isPremium: z.boolean(),
});

/**
 * Promote user validation
 */
export const promoteUserBodySchema = z.object({
  role: z.enum(['user', 'moderator', 'admin', 'staff']),
});

/**
 * Update system config validation
 */
export const updateSystemConfigBodySchema = z.object({
  value: z.any(),
});

/**
 * Import OSM places validation
 */
export const importOSMPlacesBodySchema = z.object({
  city: z.string().min(1, 'City name required').max(200),
  dryRun: z.boolean().optional(),
});

/**
 * Create challenge validation
 */
export const createChallengeBodySchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().max(1000, 'Description too long').optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  goal_type: z.string().max(100).optional(),
});
