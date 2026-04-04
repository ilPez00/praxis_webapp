import { Router } from 'express';
import { getFails, getFailsStats } from '../controllers/failsController';

const router = Router();

router.get('/', getFails);
router.get('/stats', getFailsStats);

export default router;
