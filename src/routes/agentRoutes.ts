import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import * as controller from '../controllers/agentController';

const router = Router();

router.get('/agents', controller.listAgents);

router.get('/connect/:slug', authenticateToken, controller.connectAgent);

router.post('/keys/exchange', controller.exchangeCode);

router.use(authenticateToken);

router.get('/keys', controller.listKeys);
router.delete('/keys/:id', controller.revokeKey);

export default router;