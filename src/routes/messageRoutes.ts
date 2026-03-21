import { Router } from 'express';
import { getMessages, sendMessage } from '../controllers/messageController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/:user1Id/:user2Id', authenticateToken, getMessages);
router.post('/', authenticateToken, sendMessage);
router.post('/send', authenticateToken, sendMessage); // alias used by frontend

export default router;
