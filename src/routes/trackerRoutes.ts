import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { validateBody } from '../middleware/validateRequest';
import { trackerLogSchema } from '../schemas/trackerSchemas';
import { getMyTrackers, logTracker, updateObjective, getCalendarData, saveTemplate, getTemplateSuggestions, deleteTrackerEntry, getNodeActivity } from '../controllers/trackerController';

const router = Router();

router.get('/calendar', authenticateToken, getCalendarData);
router.get('/my', authenticateToken, getMyTrackers);
router.post('/log', authenticateToken, validateBody(trackerLogSchema), logTracker);
router.delete('/entries/:id', authenticateToken, deleteTrackerEntry);
router.patch('/:type/objective', authenticateToken, updateObjective);
router.put('/:type/template', authenticateToken, saveTemplate);
router.get('/:type/suggestions', authenticateToken, getTemplateSuggestions);
router.get('/node-activity/:nodeId', authenticateToken, getNodeActivity);

export default router;
