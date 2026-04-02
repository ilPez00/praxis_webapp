import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  getMyBuddyPairs,
  getPendingRequests,
  sendBuddyRequest,
  respondToRequest,
  recordBuddyCheckin,
  getBuddyStats,
  pauseBuddyPair,
} from '../controllers/accountabilityBuddyController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/', getMyBuddyPairs);
router.get('/requests', getPendingRequests);
router.get('/stats', getBuddyStats);
router.post('/request', sendBuddyRequest);
router.post('/requests/:requestId/respond', respondToRequest);
router.post('/pairs/:buddyPairId/checkin', recordBuddyCheckin);
router.post('/pairs/:pairId/pause', pauseBuddyPair);

export default router;
