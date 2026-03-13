import { Router } from 'express';
import { requestReport, requestCoaching, getBrief, getDailyBrief, triggerBriefUpdate, getWeeklyNarrative } from '../controllers/aiCoachingController';
import { requirePro } from '../middleware/requireTier';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

// Returns cached brief immediately — free users can see their weekly brief
router.get('/brief', authenticateToken, getBrief);

// Returns the midnight automated scan result — free users see their weekly brief
router.get('/daily-brief', authenticateToken, getDailyBrief);

// Short Axiom weekly narrative (Pro only)
router.get('/weekly-narrative', ...requirePro, getWeeklyNarrative);

// Trigger extra brief — free users pay PP, Pro users free (rate-limited 30 min)
router.post('/trigger', authenticateToken, triggerBriefUpdate);

// Full coaching report (Pro only)
router.post('/report', ...requirePro, requestReport);

// Conversational chat — free users pay 50 PP/message, Pro users free
router.post('/request', authenticateToken, requestCoaching);

export default router;
