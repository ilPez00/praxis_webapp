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
} from '../controllers/groupController';

const router = Router();

router.get('/joined', getJoinedRooms);   // must be before /:roomId
router.get('/', listRooms);
router.post('/', createRoom);
router.get('/:roomId', getRoom);
router.post('/:roomId/join', joinRoom);
router.delete('/:roomId/leave', leaveRoom);
router.get('/:roomId/messages', getRoomMessages);
router.post('/:roomId/messages', sendRoomMessage);
router.get('/:roomId/members', getRoomMembers);

export default router;
