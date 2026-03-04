import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { checkIn, getTodayCheckin } from '../controllers/checkinController';

const router = Router();

router.get('/today', authenticateToken, getTodayCheckin);
router.post('/', authenticateToken, checkIn);

export default router;
