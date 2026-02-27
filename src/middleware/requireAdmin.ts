import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { UnauthorizedError } from '../utils/appErrors';

/**
 * Middleware that checks if the authenticated user has is_admin = true.
 * Must run after authenticateToken (requires req.user.id to be set).
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.id) return next(new UnauthorizedError('Authentication required.'));

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', req.user.id)
    .single();

  if (!profile?.is_admin) return next(new UnauthorizedError('Admin access required.'));
  next();
};
