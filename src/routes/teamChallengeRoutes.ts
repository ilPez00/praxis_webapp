import { Router } from 'express';
import {
  listTeamChallenges,
  createTeamChallenge,
  joinTeamChallenge,
  leaveTeamChallenge,
  getTeamLeaderboard,
  contributeToTeam,
  getMyTeamChallenge,
} from '../controllers/teamChallengeController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/', listTeamChallenges);
router.post('/', authenticateToken, createTeamChallenge);
router.get('/my-team', authenticateToken, getMyTeamChallenge);
router.get('/:challengeId/leaderboard', getTeamLeaderboard);
router.post('/:challengeId/join', authenticateToken, joinTeamChallenge);
router.delete('/:challengeId/leave', authenticateToken, leaveTeamChallenge);
router.post('/:challengeId/contribute', authenticateToken, contributeToTeam);

export default router;
