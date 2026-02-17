import { Router } from 'express';
import { getMatchesForUser } from '../controllers/matchingController';

const router = Router();

router.get('/:userId', getMatchesForUser);

export default router;
