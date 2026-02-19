import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { UnauthorizedError } from '../utils/appErrors';

/**
 * @description Express middleware that authenticates requests via a Supabase JWT.
 * Extracts the Bearer token from the Authorization header, verifies it using the
 * Supabase service-role client, and attaches the user ID to req.user.
 * Returns 401 UnauthorizedError if the token is missing or invalid.
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new UnauthorizedError('Authentication token is required.'));
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return next(new UnauthorizedError('Invalid or expired authentication token.'));
  }

  req.user = { id: user.id };
  next();
};
