import { Router } from 'express';
import { search } from '../controllers/searchController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/', authenticateToken, search);

export default router;
