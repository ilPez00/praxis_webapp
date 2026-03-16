import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import * as controller from '../controllers/narrativeController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/narratives
 * @desc    Get user's saved Axiom narratives
 * @access  Private
 */
router.get('/', controller.getNarratives);

/**
 * @route   GET /api/narratives/:id
 * @desc    Get single narrative with full content
 * @access  Private
 */
router.get('/:id', controller.getNarrative);

/**
 * @route   GET /api/narratives/:id/download
 * @desc    Download narrative as markdown file
 * @access  Private
 */
router.get('/:id/download', controller.downloadNarrative);

export default router;
