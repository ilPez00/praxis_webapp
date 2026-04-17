import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import * as controller from '../controllers/calendarController';

const router = Router();

// Public callback (Google redirects here — no JWT)
router.get('/google/callback', controller.googleCallback);

// Protected routes
router.use(authenticateToken);

router.get('/google/auth', controller.googleAuth);
router.get('/google/status', controller.getGoogleStatus);
router.get('/google/events', controller.getGoogleEvents);
router.post('/google/events', controller.createGoogleEvent);
router.delete('/google/disconnect', controller.disconnectGoogle);

export default router;
