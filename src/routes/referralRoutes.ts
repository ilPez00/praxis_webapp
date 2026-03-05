import { Router } from 'express';
import { getMyCode, claimCode } from '../controllers/referralController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/my-code', authenticateToken, getMyCode);
router.post('/claim', authenticateToken, claimCode);

export default router;
