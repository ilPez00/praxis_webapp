import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { addEntry, getEntries, getRecentEntries } from '../controllers/journalController';

const router = Router();
router.post('/entries', authenticateToken, addEntry);
router.get('/entries', authenticateToken, getEntries);
router.get('/recent', authenticateToken, getRecentEntries);
export default router;
