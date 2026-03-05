import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { getMutes, muteUser, unmuteUser, muteRoom, unmuteRoom } from '../controllers/muteController';

const router = Router();

router.get('/',                  authenticateToken, getMutes);
router.post('/user/:targetId',   authenticateToken, muteUser);
router.delete('/user/:targetId', authenticateToken, unmuteUser);
router.post('/room/:roomId',     authenticateToken, muteRoom);
router.delete('/room/:roomId',   authenticateToken, unmuteRoom);

export default router;
