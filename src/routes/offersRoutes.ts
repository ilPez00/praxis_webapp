import { Router } from 'express';
import { getOffers, createOffer, deleteOffer, closeOffer } from '../controllers/offersController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();
router.get('/', authenticateToken, getOffers);
router.post('/', authenticateToken, createOffer);
router.delete('/:id', authenticateToken, deleteOffer);
router.patch('/:id/close', authenticateToken, closeOffer);
export default router;
