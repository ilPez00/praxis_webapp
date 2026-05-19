import { Router, Request, Response } from 'express';
import { GmailService } from '../services/GmailService';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();
const gmailService = new GmailService();

/**
 * GET /api/gmail/summary
 * Returns up to 10 recent unread inbox messages with action-item detection.
 * Requires linked Google account (same flow as Calendar connect).
 */
router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const linked = await gmailService.isLinked(userId);
  if (!linked) return res.status(403).json({ error: 'Google account not connected. Connect via Calendar settings.' });

  const messages = await gmailService.getInboxSummary(userId, 10);
  const actionable = messages.filter(m => m.isActionable);

  res.json({
    total: messages.length,
    actionable: actionable.length,
    messages,
  });
});

export default router;
