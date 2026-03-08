import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { getMyTrackers, logTracker, updateObjective } from '../controllers/trackerController';

const router = Router();

router.get('/my', authenticateToken, getMyTrackers);
router.post('/log', authenticateToken, logTracker);
router.patch('/:type/objective', authenticateToken, updateObjective);

export default router;
