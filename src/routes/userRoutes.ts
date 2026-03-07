import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  completeOnboarding,
  verifyIdentity,
  getLeaderboard,
  getNearbyUsers,
  getUserPercentile,
  deleteMyAccount,
  resetMyGoals,
} from '../controllers/userController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.post('/complete-onboarding', completeOnboarding);
router.get('/leaderboard', getLeaderboard);
router.get('/nearby', getNearbyUsers);
router.delete('/me', authenticateToken, deleteMyAccount);
router.post('/me/reset-goals', authenticateToken, resetMyGoals);
router.get('/:userId/percentile', getUserPercentile);
router.get('/:id', getUserProfile);
router.put('/:id', updateUserProfile);
router.post('/:id/verify', verifyIdentity);

export default router;

