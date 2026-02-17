import { Router } from 'express';
import { getGoalTree, createOrUpdateGoalTree } from '../controllers/goalController';

const router = Router();

router.get('/:userId', getGoalTree);
router.post('/', createOrUpdateGoalTree);

export default router;
