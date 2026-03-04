import { Router } from 'express';
import { getCatalogue, getBalance, spendPoints } from '../controllers/pointsController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/catalogue', getCatalogue);
router.get('/balance', authenticateToken, getBalance);
router.post('/spend', authenticateToken, spendPoints);

export default router;
