import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';

// Custom key generator for rate limiting
const keyGenerator = (req: Request): string => {
  // Use user ID if authenticated, otherwise IP (with IPv6 support)
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  return `ip:${ipKeyGenerator(req.ip || '0.0.0.0')}`;
};

// ============================================================================
// Auth Rate Limiter (strict - prevents brute force)
// ============================================================================

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  keyGenerator,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many attempts',
      message: 'Please try again after 15 minutes',
      retryAfter: Math.ceil(((req as any).rateLimit?.resetTime?.getTime() || Date.now() + 900000) - Date.now()) / 1000,
    });
  },
});

// ============================================================================
// AI/Coaching Rate Limiter (cost control for Gemini API)
// ============================================================================

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 AI requests per minute per user
  keyGenerator,
  message: {
    error: 'Too many AI requests',
    message: 'Please wait a moment before trying again',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many AI requests. Please wait a moment.',
      retryAfter: Math.ceil(((req as any).rateLimit?.resetTime?.getTime() || Date.now() + 60000) - Date.now()) / 1000,
    });
  },
});

// ============================================================================
// Axiom Daily Brief Limiter (prevent abuse of LLM generation)
// ============================================================================

export const axiomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 regenerations per hour per user
  keyGenerator,
  message: {
    error: 'Too many brief regenerations',
    message: 'Please wait before generating another brief',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'You can regenerate your brief 3 times per hour',
      retryAfter: Math.ceil(((req as any).rateLimit?.resetTime?.getTime() || Date.now() + 3600000) - Date.now()) / 1000,
    });
  },
});

// ============================================================================
// General API Rate Limiter (fallback for other endpoints)
// ============================================================================

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator,
  message: {
    error: 'Too many requests',
    message: 'Please slow down',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil(((req as any).rateLimit?.resetTime?.getTime() || Date.now() + 60000) - Date.now()) / 1000,
    });
  },
});

// ============================================================================
// Strict Limiter for sensitive operations (payments, deletions)
// ============================================================================

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 operations per 15 minutes
  keyGenerator,
  message: {
    error: 'Too many operations',
    message: 'Please wait before trying again',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many sensitive operations. Please wait.',
      retryAfter: Math.ceil(((req as any).rateLimit?.resetTime?.getTime() || Date.now() + 900000) - Date.now()) / 1000,
    });
  },
});
