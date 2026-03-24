import { Router } from 'express';
import { getItems, purchase } from '../controllers/marketplaceController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/items', getItems);
router.post('/purchase', authenticateToken, purchase);

export default router;
