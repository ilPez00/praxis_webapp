import { Router } from 'express';
import {
  createCompletionRequest,
  respondToCompletionRequest,
  getPendingRequests,
} from '../controllers/completionController';

const router = Router();

router.get('/pending', getPendingRequests);
router.post('/', createCompletionRequest);
router.patch('/:id/respond', respondToCompletionRequest);

export default router;
