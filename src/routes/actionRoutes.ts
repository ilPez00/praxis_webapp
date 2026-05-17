import { Router } from 'express';
import { createAction, listActions, actionStats, goalMaturity } from '../controllers/actionController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/',       createAction);
router.get('/',        listActions);
router.get('/stats',    actionStats);
router.get('/maturity', goalMaturity);

export default router;
