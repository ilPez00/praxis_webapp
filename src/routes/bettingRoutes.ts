import { Router } from 'express';
import { 
  createBet, getUserBets, cancelBet, resolveExpiredBets, getBetById,
  createDuel, acceptDuel, declineDuel, getDuel, getDuelByInvite 
} from '../controllers/bettingController';
import { authenticateToken } from '../middleware/authenticateToken';
import { validateBody } from '../middleware/validateRequest';
import { createBetSchema, cancelBetSchema } from '../schemas/bettingSchemas';

const router = Router();

// Webhook/cron — no JWT (uses admin-secret or is idempotent)
router.post('/resolve-webhook', resolveExpiredBets);

// Authenticated routes
router.post('/', authenticateToken, validateBody(createBetSchema), createBet);
router.get('/:userId', authenticateToken, getUserBets);
router.get('/bet/:betId', authenticateToken, getBetById);
router.delete('/:betId', authenticateToken, validateBody(cancelBetSchema), cancelBet);

// Duel routes
router.post('/challenge', authenticateToken, createDuel);
router.post('/duel/:id/accept', authenticateToken, acceptDuel);
router.post('/duel/:id/decline', authenticateToken, declineDuel);
router.get('/duel/:id', authenticateToken, getDuel);
router.get('/duel/invite/:code', authenticateToken, getDuelByInvite);

export default router;
