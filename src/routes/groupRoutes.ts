import { Router } from 'express';
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
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/joined', authenticateToken, getJoinedRooms);   // must be before /:roomId
router.get('/', listRooms);
router.post('/', authenticateToken, createRoom);
router.get('/:roomId', getRoom);
router.post('/:roomId/join', authenticateToken, joinRoom);
router.delete('/:roomId/leave', authenticateToken, leaveRoom);
router.get('/:roomId/messages', authenticateToken, getRoomMessages);
router.post('/:roomId/messages', authenticateToken, sendRoomMessage);
router.get('/:roomId/members', getRoomMembers);
router.post('/:roomId/invite', authenticateToken, inviteMember);

export default router;
