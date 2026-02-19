import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  getProgressOverTime,
  getDomainPerformance,
  getFeedbackTrends,
  getAchievementRate,
  getComparisonData,
} from '../controllers/analyticsController';

const router = Router();

// Apply authentication middleware to all analytics routes
router.use(authenticateToken);

/**
 * @swagger
 * /analytics/progress-over-time/{userId}:
 *   get:
 *     summary: Get user's goal progress over time (premium feature).
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user.
 *     responses:
 *       200:
 *         description: Goal progress data.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden, not a premium user.
 *       500:
 *         description: Server error.
 */
router.get('/progress-over-time/:userId', getProgressOverTime);

/**
 * @swagger
 * /analytics/domain-performance/{userId}:
 *   get:
 *     summary: Get user's domain performance breakdown (premium feature).
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user.
 *     responses:
 *       200:
 *         description: Domain performance data.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden, not a premium user.
 *       500:
 *         description: Server error.
 */
router.get('/domain-performance/:userId', getDomainPerformance);

/**
 * @swagger
 * /analytics/feedback-trends/{userId}:
 *   get:
 *     summary: Get user's feedback trends (premium feature).
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user.
 *     responses:
 *       200:
 *         description: Feedback trends data.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden, not a premium user.
 *       500:
 *         description: Server error.
 */
router.get('/feedback-trends/:userId', getFeedbackTrends);

/**
 * @swagger
 * /analytics/achievement-rate/{userId}:
 *   get:
 *     summary: Get user's achievement rate (premium feature).
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user.
 *     responses:
 *       200:
 *         description: Achievement rate data.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden, not a premium user.
 *       500:
 *         description: Server error.
 */
router.get('/achievement-rate/:userId', getAchievementRate);

/**
 * @swagger
 * /analytics/comparison-data/{userId}:
 *   get:
 *     summary: Get user's comparison data with anonymized similar users (premium feature).
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user.
 *     responses:
 *       200:
 *         description: Comparison data.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden, not a premium user.
 *       500:
 *         description: Server error.
 */
router.get('/comparison-data/:userId', getComparisonData);

export default router;