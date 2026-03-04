import { Router } from 'express';
import { requirePro } from '../middleware/requireTier';
import {
  getProgressOverTime,
  getDomainPerformance,
  getFeedbackTrends,
  getAchievementRate,
  getComparisonData,
} from '../controllers/analyticsController';

const router = Router();

router.get('/progress-over-time/:userId', ...requirePro, getProgressOverTime);
router.get('/domain-performance/:userId', ...requirePro, getDomainPerformance);
router.get('/feedback-trends/:userId', ...requirePro, getFeedbackTrends);
router.get('/achievement-rate/:userId', ...requirePro, getAchievementRate);
router.get('/comparison-data/:userId', ...requirePro, getComparisonData);

export default router;
