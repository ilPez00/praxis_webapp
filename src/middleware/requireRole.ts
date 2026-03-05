import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';

/**
 * Role hierarchy: user < staff < moderator < admin
 *
 * Staff   — can moderate content in groups/boards/events
 * Moderator — can remove members, pin posts, manage events
 * Admin   — full system access (is_admin=true on profiles)
 */
const ROLE_LEVELS: Record<string, number> = { user: 0, staff: 1, moderator: 2, admin: 3 };

export const requireRole = (minRole: 'staff' | 'moderator' | 'admin') =>
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .single();

    if (!data) return res.status(403).json({ error: 'Forbidden' });

    // is_admin=true always grants maximum level regardless of role column
    const userLevel = data.is_admin ? 3 : (ROLE_LEVELS[data.role || 'user'] ?? 0);
    const required = ROLE_LEVELS[minRole];

    if (userLevel < required) {
      return res.status(403).json({ error: `Requires ${minRole} role or higher.` });
    }

    next();
  };

export const requireStaff = requireRole('staff');
export const requireModerator = requireRole('moderator');
