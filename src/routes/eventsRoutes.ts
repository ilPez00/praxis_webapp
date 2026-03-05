import { Router } from 'express';
import { getEvents, createEvent, deleteEvent, rsvpEvent, removeRsvp } from '../controllers/eventsController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/', authenticateToken, getEvents);
router.post('/', authenticateToken, createEvent);
router.delete('/:id', authenticateToken, deleteEvent);
router.post('/:id/rsvp', authenticateToken, rsvpEvent);
router.delete('/:id/rsvp', authenticateToken, removeRsvp);

export default router;
