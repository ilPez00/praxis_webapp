import { Router } from 'express';
import { getWordFrequency, getUserWordFrequency } from '../controllers/wordsController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();
router.get('/frequency', authenticateToken, getWordFrequency);
router.get('/user-frequency', authenticateToken, getUserWordFrequency);
export default router;
