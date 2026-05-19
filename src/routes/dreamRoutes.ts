import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { dreamEngine } from '../services/DreamEngine';
import { catchAsync } from '../utils/appErrors';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/dreams
 * ?tags=running,fitness  — context-match filter
 * ?sector=HEAL           — filter by ayuDomain sector
 */
router.get('/', catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const tags = req.query.tags
    ? String(req.query.tags).split(',').map(t => t.trim()).filter(Boolean)
    : undefined;
  const sector = req.query.sector ? String(req.query.sector) : undefined;

  let dreams = await dreamEngine.getDreams(userId, tags);
  if (sector) dreams = dreams.filter(d => d.sector === sector);

  res.json({ dreams });
}));

/**
 * GET /api/dreams/schedule
 * Returns the current per-sector dream schedule for the user.
 */
router.get('/schedule', catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const schedule = await dreamEngine.getSchedule(userId);
  res.json({ schedule });
}));

/**
 * POST /api/dreams/generate
 * Manually trigger dream generation.
 * Body: { sector?: string } — optional, e.g. "HEAL". Omit for all stalled sectors.
 */
router.post('/generate', catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const sector: string | undefined = req.body?.sector || undefined;
  const dreams = await dreamEngine.generateDreams(userId, sector);
  res.json({ dreams, generated: dreams.length, sector: sector ?? 'all' });
}));

/**
 * DELETE /api/dreams/:id
 * Dismiss a dream permanently.
 */
router.delete('/:id', catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await dreamEngine.dismissDream(userId, String(req.params.id));
  res.json({ ok: true });
}));

export default router;
