import { Router } from 'express';
import { listChallenges, joinChallenge, leaveChallenge } from '../controllers/challengeController';
import { authenticateToken } from '../middleware/authenticateToken';
const router = Router();
router.get('/', listChallenges);
router.post('/:challengeId/join', authenticateToken, joinChallenge);
router.delete('/:challengeId/leave', authenticateToken, leaveChallenge);
export default router;
