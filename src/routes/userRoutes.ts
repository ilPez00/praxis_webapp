import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
} from '../controllers/userController';

const router = Router();

router.get('/:id', getUserProfile);
router.put('/:id', updateUserProfile);

export default router;

