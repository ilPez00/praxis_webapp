import { Router } from 'express';
import { getMessages, sendMessage } from '../controllers/messageController';

const router = Router();

router.get('/:user1Id/:user2Id', getMessages);
router.post('/', sendMessage);
router.post('/send', sendMessage); // alias used by frontend

export default router;
