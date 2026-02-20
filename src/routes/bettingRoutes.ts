import { Router } from 'express';
import { createBet, getUserBets, cancelBet } from '../controllers/bettingController';

const router = Router();

router.post('/', createBet);
router.get('/:userId', getUserBets);
router.delete('/:betId', cancelBet);

export default router;
