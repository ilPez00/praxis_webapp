import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  getActiveEvents,
  getEventBySlug,
  joinEvent,
  getMyEventProgress,
  updateProgress,
  claimReward,
  getLeaderboard,
} from '../controllers/seasonalEventController';

const router = Router();

// Public routes
router.get('/active', getActiveEvents);
router.get('/slug/:slug', getEventBySlug);
router.get('/:eventId/leaderboard', getLeaderboard);

// Protected routes
router.get('/my-progress', authenticateToken, getMyEventProgress);
router.post('/:eventId/join', authenticateToken, joinEvent);
router.post('/:eventId/progress', authenticateToken, updateProgress);
router.post('/:eventId/claim', authenticateToken, claimReward);

export default router;
