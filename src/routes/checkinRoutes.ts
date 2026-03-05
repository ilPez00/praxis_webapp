import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { checkIn, getTodayCheckin, getMutualStreak } from '../controllers/checkinController';

const router = Router();

router.get('/today', authenticateToken, getTodayCheckin);
router.get('/mutual', authenticateToken, getMutualStreak);
router.post('/', authenticateToken, checkIn);

export default router;
