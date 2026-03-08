import { Router } from 'express';
import { getEvents, createEvent, deleteEvent, rsvpEvent, removeRsvp, getCheckinToken, checkinEvent } from '../controllers/eventsController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/', authenticateToken, getEvents);
router.post('/', authenticateToken, createEvent);
router.delete('/:id', authenticateToken, deleteEvent);
router.post('/:id/rsvp', authenticateToken, rsvpEvent);
router.delete('/:id/rsvp', authenticateToken, removeRsvp);

router.get('/:id/checkin-token', authenticateToken, getCheckinToken);
router.post('/:id/checkin', authenticateToken, checkinEvent);

export default router;
