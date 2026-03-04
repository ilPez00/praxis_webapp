import { Request, Response, NextFunction, RequestHandler } from 'express';
import { authenticateToken } from './authenticateToken';
import { supabase } from '../lib/supabaseClient';

/**
 * Middleware that checks whether the authenticated user has a Pro (premium) subscription.
 * Must be composed after authenticateToken (which attaches req.user.id).
 * On failure: 403 with PRO_REQUIRED error code — frontend uses this to open the upgrade modal.
 */
const checkPro: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Authentication required.' });
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_premium, is_admin')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return res.status(403).json({ error: 'PRO_REQUIRED', message: 'Could not verify subscription status.', upgradeUrl: '/upgrade' });
  }

  if (!profile.is_premium && !profile.is_admin) {
    return res.status(403).json({
      error: 'PRO_REQUIRED',
      message: 'This feature requires a Pro subscription.',
      upgradeUrl: '/upgrade',
    });
  }

  next();
};

/**
 * Drop-in replacement for [authenticateToken] on routes that require Pro.
 * Usage: router.post('/report', ...requirePro, handler)
 */
export const requirePro: RequestHandler[] = [authenticateToken, checkPro];
