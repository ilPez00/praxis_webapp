import { Router } from 'express';
import {
  getGoalTree,
  createOrUpdateGoalTree,
  updateNodeProgress,
  createGoalNode,
  updateGoalNode,
  deleteGoalNode,
} from '../controllers/goalController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/:userId', getGoalTree);
router.post('/', createOrUpdateGoalTree);
router.patch('/:userId/node/:nodeId/progress', authenticateToken, updateNodeProgress);

// Per-node CRUD (25 PP gate on create/edit; free delete)
router.post('/:userId/node', authenticateToken, createGoalNode);
router.patch('/:userId/node/:nodeId', authenticateToken, updateGoalNode);
router.delete('/:userId/node/:nodeId', authenticateToken, deleteGoalNode);

export default router;
