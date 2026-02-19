import { Router } from 'express';
import { requestCoaching } from '../controllers/aiCoachingController';
import { authenticateToken } from '../middleware/authenticateToken'; // Assuming this middleware exists

const router = Router();

/**
 * @swagger
 * /ai-coaching/request:
 *   post:
 *     summary: Request AI coaching for personalized insights and guidance.
 *     tags: [AI Coaching]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userPrompt
 *             properties:
 *               userPrompt:
 *                 type: string
 *                 description: The user's specific question or request for the AI coach.
 *                 example: "What should I focus on next in my career goals?"
 *     responses:
 *       200:
 *         description: AI coaching response successfully generated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                   description: The AI-generated coaching response.
 *       401:
 *         description: Unauthorized. User ID not found or invalid token.
 *       403:
 *         description: Forbidden. AI Coaching is a premium feature.
 *       500:
 *         description: Server error.
 */
router.post('/request', authenticateToken, requestCoaching);

export default router;