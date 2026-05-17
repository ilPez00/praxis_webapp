import { Router } from 'express';
import { requirePro } from '../middleware/requireTier';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  getProgressOverTime,
  getDomainPerformance,
  getFeedbackTrends,
  getAchievementRate,
  getComparisonData,
  getAuraSummary,
} from '../controllers/analyticsController';

const router = Router();

router.get('/progress-over-time/:userId', ...requirePro, getProgressOverTime);
router.get('/domain-performance/:userId', ...requirePro, getDomainPerformance);
router.get('/feedback-trends/:userId', ...requirePro, getFeedbackTrends);
router.get('/achievement-rate/:userId', ...requirePro, getAchievementRate);
router.get('/comparison-data/:userId', ...requirePro, getComparisonData);

// Compact ontology summary for Aura — no pro gate, own data only
router.get('/aura-summary/:userId', authenticateToken, getAuraSummary);

export default router;
