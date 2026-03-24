import { Router } from 'express';
import {
  listCoaches,
  getCoachByUserId,
  upsertCoachProfile,
  updateCoachProfile,
  deleteCoachProfile,
} from '../controllers/coachController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/', listCoaches);
router.post('/', authenticateToken, upsertCoachProfile);
router.get('/:userId', getCoachByUserId);
router.patch('/:userId', authenticateToken, updateCoachProfile);
router.delete('/:userId', authenticateToken, deleteCoachProfile);

export default router;
