import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
} from '../controllers/notificationController';

const router = Router();

router.get('/',             authenticateToken, getNotifications);
router.get('/unread-count', authenticateToken, getUnreadCount);
router.post('/read',        authenticateToken, markRead);
router.post('/read-all',    authenticateToken, markAllRead);
router.delete('/:id',       authenticateToken, deleteNotification);

export default router;
