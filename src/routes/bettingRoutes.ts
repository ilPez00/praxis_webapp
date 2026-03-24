import { Router } from 'express';
import { createBet, getUserBets, cancelBet, resolveExpiredBets, getBetById } from '../controllers/bettingController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

// Webhook/cron — no JWT (uses admin-secret or is idempotent)
router.post('/resolve-webhook', resolveExpiredBets);

// Authenticated routes
router.post('/', authenticateToken, createBet);
router.get('/:userId', authenticateToken, getUserBets);
router.get('/bet/:betId', authenticateToken, getBetById);
router.delete('/:betId', authenticateToken, cancelBet);

export default router;
