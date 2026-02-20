import { Router } from 'express';
import { createBet, getUserBets, cancelBet, resolveExpiredBets } from '../controllers/bettingController';

const router = Router();

// Webhook must be defined before /:betId to avoid route collision
router.post('/resolve-webhook', resolveExpiredBets);
router.post('/', createBet);
router.get('/:userId', getUserBets);
router.delete('/:betId', cancelBet);

export default router;
