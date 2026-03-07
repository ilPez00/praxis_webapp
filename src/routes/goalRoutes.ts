import { Router } from 'express';
import { getGoalTree, createOrUpdateGoalTree, updateNodeProgress } from '../controllers/goalController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/:userId', getGoalTree);
router.post('/', createOrUpdateGoalTree);
router.patch('/:userId/node/:nodeId/progress', authenticateToken, updateNodeProgress);

export default router;
