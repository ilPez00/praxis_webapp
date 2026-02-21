import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  completeOnboarding,
  verifyIdentity,
} from '../controllers/userController';

const router = Router();

router.post('/complete-onboarding', completeOnboarding);
router.get('/:id', getUserProfile);
router.put('/:id', updateUserProfile);
router.post('/:id/verify', verifyIdentity);

export default router;

