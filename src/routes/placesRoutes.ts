import { Router } from 'express';
import { getPlaces, createPlace, joinPlace, leavePlace, deletePlace, updatePlace } from '../controllers/placesController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();
router.get('/', authenticateToken, getPlaces);
router.post('/', authenticateToken, createPlace);
router.put('/:id', authenticateToken, updatePlace);
router.post('/:id/join', authenticateToken, joinPlace);
router.delete('/:id/join', authenticateToken, leavePlace);
router.delete('/:id', authenticateToken, deletePlace);
export default router;
