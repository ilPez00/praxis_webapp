import { Router, Request, Response } from 'express';
import { GitHubService } from '../services/GitHubService';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();
const github = new GitHubService();

router.get('/activity', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const days = Math.min(Number(req.query.days) || 7, 30);
  const summary = await github.getRecentActivity(userId, days);

  if (!summary.date) {
    const linked = await github.isLinked(userId);
    if (!linked) return res.status(403).json({ error: 'GitHub not connected. POST /api/github/connect with { pat }.' });
  }

  res.json(summary);
});

router.post('/connect', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const { pat } = req.body as { pat?: string };
  if (!pat || typeof pat !== 'string' || pat.trim().length < 10) {
    return res.status(400).json({ error: 'pat required (GitHub Personal Access Token).' });
  }

  // Validate token before storing
  const testRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${pat.trim()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Praxis-Ayu/1.0',
    },
  });
  if (!testRes.ok) return res.status(401).json({ error: 'Invalid GitHub PAT.' });

  const user = await testRes.json();
  await github.savePat(userId, pat.trim());

  res.json({ linked: true, login: user.login });
});

router.delete('/connect', authenticateToken, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });
  await github.removePat(userId);
  res.json({ linked: false });
});

export default router;
