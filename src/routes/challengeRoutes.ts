import { Router } from 'express';
import { listChallenges, joinChallenge, leaveChallenge } from '../controllers/challengeController';
const router = Router();
router.get('/', listChallenges);
router.post('/:challengeId/join', joinChallenge);
router.delete('/:challengeId/leave', leaveChallenge);
export default router;
