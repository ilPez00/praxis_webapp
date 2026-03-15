import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import * as controller from '../controllers/scheduleController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/schedule/today
 * @desc    Get today's schedule (generates if doesn't exist)
 * @access  Private
 */
router.get('/today', controller.getTodaySchedule);

/**
 * @route   GET /api/schedule/:date
 * @desc    Get schedule for a specific date
 * @access  Private
 */
router.get('/:date', controller.getSchedule);

/**
 * @route   POST /api/schedule/generate
 * @desc    Generate a new schedule for a specific date
 * @access  Private
 */
router.post('/generate', controller.generateSchedule);

/**
 * @route   POST /api/schedule/:scheduleId/slots/:hour/complete
 * @desc    Mark a time slot as completed (optionally with a note)
 * @access  Private
 */
router.post('/:scheduleId/slots/:hour/complete', controller.completeTimeSlot);

/**
 * @route   POST /api/schedule/:scheduleId/slots/:hour/note
 * @desc    Add a note to a time slot (creates linked diary entry)
 * @access  Private
 */
router.post('/:scheduleId/slots/:hour/note', controller.addNoteToSlot);

/**
 * @route   GET /api/schedule/stats
 * @desc    Get schedule completion statistics
 * @access  Private
 */
router.get('/stats', controller.getScheduleStats);

/**
 * @route   GET /api/schedule/:scheduleId/slots/:hour/share
 * @desc    Get shareable data for a time slot (for diary integration)
 * @access  Private
 */
router.get('/:scheduleId/slots/:hour/share', controller.getShareableSlot);

export default router;
