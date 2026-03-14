import { Router } from 'express';
import { createBet, getUserBets, cancelBet, resolveExpiredBets, getBetById } from '../controllers/bettingController';

const router = Router();

// Webhook must be defined before /:betId to avoid route collision
router.post('/resolve-webhook', resolveExpiredBets);
router.post('/', createBet);
router.get('/:userId', getUserBets);
router.get('/bet/:betId', getBetById);
router.delete('/:betId', cancelBet);

export default router;
