import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { validateBody } from '../middleware/validateRequest';
import { sendMessageSchema } from '../schemas/messageSchemas';
import { getMessages, sendMessage } from '../controllers/messageController';

const router = Router();

router.get('/:user1Id/:user2Id', authenticateToken, getMessages);
router.post('/', authenticateToken, validateBody(sendMessageSchema), sendMessage);
router.post('/send', authenticateToken, validateBody(sendMessageSchema), sendMessage); // alias used by frontend

export default router;
