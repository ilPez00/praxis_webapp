import { Router } from 'express';
import {
  listDuels, myDuels, createDuel,
  acceptDuel, declineDuel, cancelDuel,
  claimDuel, concedeDuel,
} from '../controllers/duelController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/', authenticateToken, listDuels);
router.get('/mine', authenticateToken, myDuels);
router.post('/', authenticateToken, createDuel);
router.post('/:id/accept', authenticateToken, acceptDuel);
router.post('/:id/decline', authenticateToken, declineDuel);
router.post('/:id/cancel', authenticateToken, cancelDuel);
router.post('/:id/claim', authenticateToken, claimDuel);
router.post('/:id/concede', authenticateToken, concedeDuel);

export default router;
