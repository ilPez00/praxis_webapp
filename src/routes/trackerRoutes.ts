import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { getMyTrackers, logTracker, updateObjective, getCalendarData, saveTemplate, getTemplateSuggestions } from '../controllers/trackerController';

const router = Router();

router.get('/calendar', authenticateToken, getCalendarData);
router.get('/my', authenticateToken, getMyTrackers);
router.post('/log', authenticateToken, logTracker);
router.patch('/:type/objective', authenticateToken, updateObjective);
router.put('/:type/template', authenticateToken, saveTemplate);
router.get('/:type/suggestions', authenticateToken, getTemplateSuggestions);

export default router;
