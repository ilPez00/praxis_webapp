import { Router, Request, Response } from 'express';
import { YouTubeService } from '../services/YouTubeService';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();
const svc = new YouTubeService();

// YouTube reuses the Google OAuth token stored by GoogleCalendarService.
// No separate callback needed — user connects via /api/calendar/auth-url which now
// includes youtube.readonly scope.

router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });
  if (!await svc.isLinked(userId)) {
    return res.status(403).json({ error: 'Google not connected. Use /api/calendar/auth-url to connect (includes YouTube scope).' });
  }
  const maxResults = Math.min(Number(req.query.limit) || 20, 50);
  const summary = await svc.getLikedVideos(userId, maxResults);
  res.json(summary);
});

export default router;
