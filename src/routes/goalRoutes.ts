import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { validateBody } from '../middleware/validateRequest';
import { createGoalSchema } from '../schemas/goalSchemas';
import {
  getGoalTree,
  createOrUpdateGoalTree,
  updateNodeProgress,
  createGoalNode,
  updateGoalNode,
  deleteGoalNode,
  getGoalSharing,
  updateGoalSharing,
} from '../controllers/goalController';

const router = Router();

router.get('/:userId', getGoalTree);
router.post('/', authenticateToken, createOrUpdateGoalTree);
router.patch('/:userId/node/:nodeId/progress', authenticateToken, updateNodeProgress);

// Per-node CRUD (25 PP gate on create/edit; free delete)
router.post('/:userId/node', authenticateToken, validateBody(createGoalSchema), createGoalNode);
router.patch('/:userId/node/:nodeId', authenticateToken, updateGoalNode);
router.delete('/:userId/node/:nodeId', authenticateToken, deleteGoalNode);
router.get('/:userId/node/:nodeId/sharing', authenticateToken, getGoalSharing);
router.patch('/:userId/node/:nodeId/sharing', authenticateToken, updateGoalSharing);

export default router;
