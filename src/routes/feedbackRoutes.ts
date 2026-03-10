import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { submitFeedback } from '../controllers/feedbackController';

const router = Router();

router.post('/', authenticateToken, submitFeedback);

export default router;
