import { Router, Request, Response } from 'express';
import {
  listRooms,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomMessages,
  sendRoomMessage,
  getRoomMembers,
  getRoom,
  getJoinedRooms,
  inviteMember,
} from '../controllers/groupController';
import { recommendGroups } from '../controllers/groupRecommendationController';
import { authenticateToken } from '../middleware/authenticateToken';
import { catchAsync } from '../utils/appErrors';

const router = Router();

router.get('/joined', authenticateToken, getJoinedRooms);   // must be before /:roomId
router.get('/', listRooms);

// GET /groups/recommendations — domain-based group suggestions for authenticated user
router.get('/recommendations', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const groups = await recommendGroups(userId);
  res.json({ groups });
}));

router.post('/', authenticateToken, createRoom);
router.get('/:roomId', getRoom);
router.post('/:roomId/join', authenticateToken, joinRoom);
router.delete('/:roomId/leave', authenticateToken, leaveRoom);
router.get('/:roomId/messages', authenticateToken, getRoomMessages);
router.post('/:roomId/messages', authenticateToken, sendRoomMessage);
router.get('/:roomId/members', getRoomMembers);
router.post('/:roomId/invite', authenticateToken, inviteMember);

export default router;
