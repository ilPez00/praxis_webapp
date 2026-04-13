import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { getVapidKey, subscribe, unsubscribe } from '../controllers/pushController';

const router = Router();

router.get('/vapid-key',    getVapidKey);                        // public — no auth needed
router.post('/subscribe',   authenticateToken, subscribe);
router.post('/unsubscribe', authenticateToken, unsubscribe);

export default router;
