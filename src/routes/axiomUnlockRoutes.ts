import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import * as controller from '../controllers/axiomUnlockController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/axiom/unlock-daily
 * @desc    Unlock today's Axiom daily brief for 500 PP
 * @access  Private
 */
router.post('/unlock-daily', controller.unlockDailyBrief);

export default router;
