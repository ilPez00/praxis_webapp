import { Router } from 'express';
import {
  createCompletionRequest,
  respondToCompletionRequest,
  getPendingRequests,
} from '../controllers/completionController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/pending', authenticateToken, getPendingRequests);
router.post('/', authenticateToken, createCompletionRequest);
router.patch('/:id/respond', authenticateToken, respondToCompletionRequest);

export default router;
