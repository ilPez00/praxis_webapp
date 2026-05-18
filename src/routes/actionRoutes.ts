import { Router } from 'express';
import { createAction, listActions, actionStats, goalMaturity } from '../controllers/actionController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.use(authenticateToken);

router.post('/',       createAction);
router.get('/',        listActions);
router.get('/stats',    actionStats);
router.get('/maturity', goalMaturity);

export default router;
