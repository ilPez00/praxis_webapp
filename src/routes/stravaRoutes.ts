import { Router, Request, Response } from 'express';
import { StravaService } from '../services/StravaService';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();
const svc = new StravaService();

const redirectUri = () =>
  `${process.env.API_BASE_URL || 'https://web-production-646a4.up.railway.app'}/api/strava/callback`;

router.get('/auth-url', authenticateToken, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    res.json({ url: svc.getAuthUrl(userId, redirectUri()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/callback', async (req: Request, res: Response) => {
  const { code, state: userId, error } = req.query as Record<string, string>;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  if (error || !code || !userId) {
    return res.redirect(`${clientUrl}/settings?strava_error=${error ?? 'missing_params'}`);
  }
  try {
    await svc.handleCallback(code, userId);
    res.redirect(`${clientUrl}/settings?connected=strava`);
  } catch (err: any) {
    res.redirect(`${clientUrl}/settings?strava_error=token_exchange_failed`);
  }
});

router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });
  if (!await svc.isLinked(userId)) {
    return res.status(403).json({ error: 'Strava not connected. GET /api/strava/auth-url to connect.' });
  }
  const days = Math.min(Number(req.query.days) || 14, 60);
  const summary = await svc.getRecentActivities(userId, days);
  res.json(summary);
});

router.delete('/connect', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });
  await svc.disconnect(userId);
  res.json({ linked: false });
});

export default router;
