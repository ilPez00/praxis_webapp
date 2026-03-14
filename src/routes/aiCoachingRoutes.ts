import { Router } from 'express';
import { requestReport, requestCoaching, getBrief, getDailyBrief, triggerBriefUpdate, getWeeklyNarrative, generateAxiomBrief } from '../controllers/aiCoachingController';
import { requirePro } from '../middleware/requireTier';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

// Returns cached brief immediately — free users can see their weekly brief
router.get('/brief', authenticateToken, getBrief);

// Returns the midnight automated scan result — free users see their weekly brief
router.get('/daily-brief', authenticateToken, getDailyBrief);

// Short Axiom weekly narrative (open to all authenticated users)
router.post('/weekly-narrative', authenticateToken, getWeeklyNarrative);

// Trigger extra brief — free users pay PP, Pro users free (rate-limited 30 min)
router.post('/trigger', authenticateToken, triggerBriefUpdate);

// On-demand Axiom brief — free, generates today's brief if not yet available
router.post('/generate-axiom-brief', authenticateToken, generateAxiomBrief);

// Full coaching report (Pro only)
router.post('/report', ...requirePro, requestReport);

// Conversational chat — free users pay 50 PP/message, Pro users free
router.post('/request', authenticateToken, requestCoaching);

export default router;
