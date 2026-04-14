/**
 * Post Validation Schemas
 * Zod schemas for validating post input
 */

import { z } from 'zod';

/**
 * Create post validation
 */
// Zod's default `.strip()` silently removes unknown keys. The controller
// reads userName/userAvatarUrl/title/mediaUrl/mediaType/context/reference
// off req.body — if we strip them, controller throws "userName is required."
// `.passthrough()` preserves them after validation.
export const createPostBodySchema = z
  .object({
    content: z
      .string()
      .min(1, 'Content is required')
      .max(10000, 'Content must be less than 10000 characters'),
    tags: z.array(z.string().max(50)).optional(),
  })
  .passthrough();

export type CreatePostInput = z.infer<typeof createPostBodySchema>;

/**
 * Add comment validation
 */
// Same issue as createPostBodySchema — controller reads userName/userAvatarUrl
// off req.body, so `.passthrough()` keeps them after validation.
export const addCommentBodySchema = z
  .object({
    content: z
      .string()
      .min(1, 'Content is required')
      .max(10000, 'Content must be less than 10000 characters'),
  })
  .passthrough();

/**
 * Vote post validation
 */
export const votePostBodySchema = z.object({
  vote: z.number().int().min(-1).max(1, 'Vote must be -1, 0, or 1'),
});
