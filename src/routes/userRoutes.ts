import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  completeOnboarding,
} from '../controllers/userController';

const router = Router();

router.post('/complete-onboarding', completeOnboarding);
router.get('/:id', getUserProfile);
router.put('/:id', updateUserProfile);

export default router;

