import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

const UBERWIKI_GANTT_DIR = '/home/gio/uber-wiki/wiki/gantt';

/**
 * GET /api/gantt/day?date=2026-05-20
 * Returns processed Gantt data for a specific day.
 * If no date given, returns today.
 */
router.get('/day', authenticateToken, async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || '') || new Date().toISOString().slice(0, 10);
    const filePath = path.join(UBERWIKI_GANTT_DIR, 'processed', `${date}.json`);

    if (!fs.existsSync(filePath)) {
      return res.json({ date, tasks: [] });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const tasks = JSON.parse(raw);
    res.json({ date, tasks });
  } catch (err: any) {
    logger.error('[Gantt] /day failed:', err.message);
    res.status(500).json({ error: 'Failed to load Gantt data.' });
  }
});

/**
 * GET /api/gantt/goals
 * Returns user goals from uberwiki.
 */
router.get('/goals', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const filePath = path.join(UBERWIKI_GANTT_DIR, 'goals.json');
    if (!fs.existsSync(filePath)) {
      return res.json({ goals: {} });
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const goals = JSON.parse(raw);
    res.json({ goals });
  } catch (err: any) {
    logger.error('[Gantt] /goals failed:', err.message);
    res.status(500).json({ error: 'Failed to load goals.' });
  }
});

/**
 * POST /api/gantt/plan
 * Saves next-day plan.
 * Body: { date: string, tasks: object[] }
 */
router.post('/plan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { date, tasks } = req.body;
    if (!date || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'date and tasks[] required.' });
    }

    const plansDir = path.join(UBERWIKI_GANTT_DIR, 'plans');
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }

    const filePath = path.join(plansDir, `${date}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ date, tasks, updatedAt: new Date().toISOString() }, null, 2));
    res.json({ ok: true, date, taskCount: tasks.length });
  } catch (err: any) {
    logger.error('[Gantt] /plan failed:', err.message);
    res.status(500).json({ error: 'Failed to save plan.' });
  }
});

/**
 * GET /api/gantt/plan?date=2026-05-21
 * Returns plan for a specific day.
 */
router.get('/plan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || '') || new Date().toISOString().slice(0, 10);
    const filePath = path.join(UBERWIKI_GANTT_DIR, 'plans', `${date}.json`);

    if (!fs.existsSync(filePath)) {
      return res.json({ date, tasks: [] });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const plan = JSON.parse(raw);
    res.json(plan);
  } catch (err: any) {
    logger.error('[Gantt] /plan GET failed:', err.message);
    res.status(500).json({ error: 'Failed to load plan.' });
  }
});

/**
 * GET /api/gantt/aura
 * Returns aura score for today based on Gantt data.
 */
router.get('/aura', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const filePath = path.join(UBERWIKI_GANTT_DIR, 'processed', `${today}.json`);

    if (!fs.existsSync(filePath)) {
      return res.json({ aura: 'neutral', score: 0, date: today, tasks: 0 });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const tasks = JSON.parse(raw);

    const goalGroups: Record<string, { count: number; totalDuration: number }> = {};
    for (const t of tasks) {
      const gid = t.goal_id || 'other';
      if (!goalGroups[gid]) goalGroups[gid] = { count: 0, totalDuration: 0 };
      goalGroups[gid].count++;
      goalGroups[gid].totalDuration += t.duration || 30;
    }

    const totalDuration = Object.values(goalGroups).reduce((s, g) => s + g.totalDuration, 0) || 1;
    const focusRatio = (goalGroups['development']?.totalDuration || 0) / totalDuration;
    const otherRatio = (goalGroups['other']?.totalDuration || 0) / totalDuration;

    let aura: string;
    let score: number;
    if (focusRatio >= 0.5) {
      aura = 'focused';
      score = focusRatio;
    } else if (otherRatio >= 0.5) {
      aura = 'scattered';
      score = -otherRatio;
    } else {
      aura = 'balanced';
      score = 0.5;
    }

    res.json({
      aura,
      score: Math.round(score * 100) / 100,
      date: today,
      tasks: tasks.length,
      breakdown: goalGroups,
    });
  } catch (err: any) {
    logger.error('[Gantt] /aura failed:', err.message);
    res.status(500).json({ error: 'Aura calculation failed.' });
  }
});

export default router;
