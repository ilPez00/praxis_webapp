import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { submitReflection, getPatternsByDomain } from '../controllers/reflectionTrainingController';

const router = Router();

// Submission endpoint (requires opt-in consent)
router.post('/training', authenticateToken, submitReflection);

// Public pattern feed (anonymous users can read)
router.get('/patterns', getPatternsByDomain);

export default router;