import { Router } from 'express';
import { getItems, purchase } from '../controllers/marketplaceController';

const router = Router();

router.get('/items', getItems);
router.post('/purchase', purchase);

export default router;
