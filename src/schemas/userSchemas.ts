/**
 * User Validation Schemas
 * Zod schemas for validating user input
 */

import { z } from 'zod';

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password requirements: min 8 chars, at least 1 letter + 1 number
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

/**
 * Registration validation
 */
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email too long'),
  
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(
      passwordRegex,
      'Password must contain at least one letter and one number'
    )
    .max(128, 'Password too long'),
  
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login validation
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  
  password: z
    .string()
    .min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Profile update validation
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .optional(),
  
  bio: z
    .string()
    .max(500, 'Bio too long (max 500 characters)')
    .optional(),
  
  city: z
    .string()
    .max(100, 'City name too long')
    .optional(),
  
  avatar_url: z
    .string()
    .url('Invalid URL format')
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
