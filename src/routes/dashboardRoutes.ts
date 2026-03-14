import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { getDashboardSummary } from '../controllers/dashboardController';

const router = Router();

router.get('/summary', authenticateToken, getDashboardSummary);

export default router;
