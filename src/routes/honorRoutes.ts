import { Router } from 'express';
import { giveHonor, revokeHonor, getHonor } from '../controllers/honorController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/:userId', authenticateToken, getHonor);
router.post('/:targetId', authenticateToken, giveHonor);
router.delete('/:targetId', authenticateToken, revokeHonor);

export default router;
