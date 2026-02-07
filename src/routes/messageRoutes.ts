import { Router } from 'express';
import { getMessages, sendMessage } from '../controllers/messageController';

const router = Router();

router.get('/:user1Id/:user2Id', getMessages);
router.post('/', sendMessage);

export default router;
