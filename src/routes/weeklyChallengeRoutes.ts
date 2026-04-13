/**
 * Weekly Challenge Routes
 * 7-tier weekly progression track
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  getWeeklyProgress,
  addWeeklyXP,
  claimTierReward,
  getWeeklyHistory,
} from '../controllers/weeklyChallengeController';

const router = Router();

router.get('/', authenticateToken, getWeeklyProgress);
router.post('/add-xp', authenticateToken, addWeeklyXP);
router.post('/claim/:tier', authenticateToken, claimTierReward);
router.get('/history', authenticateToken, getWeeklyHistory);

export default router;
