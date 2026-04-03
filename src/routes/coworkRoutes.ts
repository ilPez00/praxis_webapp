import { Router } from 'express';
import {
  listCoworkRooms,
  createCoworkRoom,
  joinCoworkRoom,
  leaveCoworkRoom,
  startCoworkSession,
  endCoworkSession,
  getCoworkStats,
  getActiveCoworkers,
  getMyCoworkRoom,
} from '../controllers/coworkController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/', listCoworkRooms);
router.post('/', authenticateToken, createCoworkRoom);
router.get('/my-room', authenticateToken, getMyCoworkRoom);
router.get('/stats', authenticateToken, getCoworkStats);
router.get('/:roomId/coworkers', getActiveCoworkers);
router.post('/:roomId/join', authenticateToken, joinCoworkRoom);
router.delete('/:roomId/leave', authenticateToken, leaveCoworkRoom);
router.post('/:roomId/session', authenticateToken, startCoworkSession);
router.delete('/sessions/:sessionId', authenticateToken, endCoworkSession);

export default router;
