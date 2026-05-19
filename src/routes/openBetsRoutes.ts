import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  listOpenBets,
  myOpenBets,
  createOpenBet,
  joinOpenBet,
  leaveOpenBet,
  resolveOpenBet,
  cancelOpenBet,
  getParticipants,
} from '../controllers/openBetsController';

const router = Router();

router.get('/', authenticateToken, listOpenBets);
router.get('/mine', authenticateToken, myOpenBets);
router.post('/', authenticateToken, createOpenBet);
router.get('/:id/participants', authenticateToken, getParticipants);
router.post('/:id/join', authenticateToken, joinOpenBet);
router.delete('/:id/leave', authenticateToken, leaveOpenBet);
router.patch('/:id/resolve', authenticateToken, resolveOpenBet);
router.delete('/:id', authenticateToken, cancelOpenBet);

export default router;
