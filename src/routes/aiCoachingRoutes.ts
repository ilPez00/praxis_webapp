import { Router } from 'express';
import { requestReport, requestCoaching, getBrief, triggerBriefUpdate } from '../controllers/aiCoachingController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

// Returns cached brief immediately (no generation)
router.get('/brief', authenticateToken, getBrief);

// Kicks off a background brief update (rate-limited to 30 min per user)
router.post('/trigger', authenticateToken, triggerBriefUpdate);

// Auto-generates full coaching report on demand
router.post('/report', authenticateToken, requestReport);

// Conversational follow-up question
router.post('/request', authenticateToken, requestCoaching);

export default router;
