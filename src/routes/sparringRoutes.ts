import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { sendRequest, respondRequest, getIncoming, getPartners, toggleOpen } from '../controllers/sparringController';

const router = Router();
router.post('/request', authenticateToken, sendRequest);
router.post('/respond', authenticateToken, respondRequest);
router.get('/requests', authenticateToken, getIncoming);
router.get('/partners', authenticateToken, getPartners);
router.post('/toggle-open', authenticateToken, toggleOpen);
export default router;
