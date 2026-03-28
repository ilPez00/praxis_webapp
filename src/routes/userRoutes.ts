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
  anonymizeMyAccount,
  exportMyData,
  resetMyGoals,
  getPublicStats,
} from '../controllers/userController';
import { authenticateToken } from '../middleware/authenticateToken';
import { validateBody } from '../middleware/validateRequest';
import { updateProfileSchema, deleteAccountSchema, anonymizeAccountSchema } from '../schemas/userSchemas';

const router = Router();

router.get('/stats/public', getPublicStats);
router.post('/complete-onboarding', authenticateToken, completeOnboarding);
router.get('/leaderboard', getLeaderboard);
router.get('/nearby', authenticateToken, getNearbyUsers);

// GDPR endpoints
router.delete('/me', authenticateToken, validateBody(deleteAccountSchema), deleteMyAccount);
router.post('/me/anonymize', authenticateToken, validateBody(anonymizeAccountSchema), anonymizeMyAccount);
router.get('/me/export', authenticateToken, exportMyData);

router.post('/me/reset-goals', authenticateToken, resetMyGoals);
router.get('/:userId/percentile', getUserPercentile);
router.get('/:id', getUserProfile);
router.put('/:id', authenticateToken, validateBody(updateProfileSchema), updateUserProfile);
router.post('/:id/verify', authenticateToken, verifyIdentity);

export default router;

