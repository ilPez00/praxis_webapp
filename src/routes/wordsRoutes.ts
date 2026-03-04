import { Router } from 'express';
import { getWordFrequency } from '../controllers/wordsController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();
router.get('/frequency', authenticateToken, getWordFrequency);
export default router;
