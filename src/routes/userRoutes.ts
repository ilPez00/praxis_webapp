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
  getPublicStats,
} from '../controllers/userController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/stats/public', getPublicStats);
router.post('/complete-onboarding', completeOnboarding);
router.get('/leaderboard', getLeaderboard);
router.get('/nearby', getNearbyUsers);
router.delete('/me', authenticateToken, deleteMyAccount);
router.post('/me/reset-goals', authenticateToken, resetMyGoals);
router.get('/:userId/percentile', getUserPercentile);
router.get('/:id', getUserProfile);
router.put('/:id', authenticateToken, updateUserProfile);
router.post('/:id/verify', authenticateToken, verifyIdentity);

export default router;

