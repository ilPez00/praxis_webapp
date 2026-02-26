import { Router } from 'express';
import {
  listCoaches,
  getCoachByUserId,
  upsertCoachProfile,
  updateCoachProfile,
  deleteCoachProfile,
} from '../controllers/coachController';

const router = Router();

router.get('/', listCoaches);
router.post('/', upsertCoachProfile);
router.get('/:userId', getCoachByUserId);
router.patch('/:userId', updateCoachProfile);
router.delete('/:userId', deleteCoachProfile);

export default router;
