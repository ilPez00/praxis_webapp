import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { getMyTrackers, logTracker } from '../controllers/trackerController';

const router = Router();

router.get('/my', authenticateToken, getMyTrackers);
router.post('/log', authenticateToken, logTracker);

export default router;
