import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { UnauthorizedError } from '../utils/appErrors';
import { authenticateApiKey } from '../controllers/agentController';

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (apiKey) {
    const userId = await authenticateApiKey(apiKey);
    if (userId) {
      req.user = { id: userId };
      return next();
    }
  }

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