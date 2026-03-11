import { Router } from 'express';
import { requestReport, requestCoaching, getBrief, triggerBriefUpdate, getWeeklyNarrative } from '../controllers/aiCoachingController';
import { requirePro } from '../middleware/requireTier';

const router = Router();

// Returns cached brief immediately (no generation)
router.get('/brief', ...requirePro, getBrief);

// Short Axiom weekly narrative (cached 7 days per user)
router.get('/weekly-narrative', ...requirePro, getWeeklyNarrative);

// Kicks off a background brief update (rate-limited to 30 min per user)
router.post('/trigger', ...requirePro, triggerBriefUpdate);

// Auto-generates full coaching report on demand
router.post('/report', ...requirePro, requestReport);

// Conversational follow-up question
router.post('/request', ...requirePro, requestCoaching);

export default router;
