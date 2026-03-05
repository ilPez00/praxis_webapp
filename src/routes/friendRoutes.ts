import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  getFriends,
  getIncomingRequests,
  getFriendStatus,
  sendFriendRequest,
  acceptFriendRequest,
  rejectOrCancelRequest,
  unfriend,
} from '../controllers/friendController';

const router = Router();

router.use(authenticateToken);

router.get('/', getFriends);
router.get('/requests/incoming', getIncomingRequests);
router.get('/status/:targetUserId', getFriendStatus);
router.post('/request/:targetUserId', sendFriendRequest);
router.post('/accept/:requestId', acceptFriendRequest);
router.delete('/requests/:requestId', rejectOrCancelRequest);
router.delete('/:friendId', unfriend);

export default router;
