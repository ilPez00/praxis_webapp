import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  completeOnboarding,
  verifyIdentity,
  getLeaderboard,
  getNearbyUsers,
  getUserPercentile,
} from '../controllers/userController';

const router = Router();

router.post('/complete-onboarding', completeOnboarding);
router.get('/leaderboard', getLeaderboard);
router.get('/nearby', getNearbyUsers);
router.get('/:userId/percentile', getUserPercentile);
router.get('/:id', getUserProfile);
router.put('/:id', updateUserProfile);
router.post('/:id/verify', verifyIdentity);

export default router;

