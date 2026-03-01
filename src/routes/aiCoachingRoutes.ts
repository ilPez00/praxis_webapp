import { Router } from 'express';
import { requestReport, requestCoaching } from '../controllers/aiCoachingController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

// Auto-generates full coaching report (motivation + strategy + network leverage)
router.post('/report', authenticateToken, requestReport);

// Conversational follow-up question
router.post('/request', authenticateToken, requestCoaching);

export default router;
