import { Router } from 'express';
import {
  seedDemoUsers, deleteDemoUsers,
  listAllUsers, adminDeleteUser, adminDeletePost, adminDeleteGroup,
  banUser, unbanUser, grantPoints,
} from '../controllers/adminController';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// ── curl-only routes (X-Admin-Secret header) ─────────────────────────────────
router.post('/seed-demo-users', seedDemoUsers);
router.delete('/delete-demo-users', deleteDemoUsers);

// ── Webapp admin routes (JWT + is_admin check) ────────────────────────────────
router.get('/users', authenticateToken, requireAdmin, listAllUsers);
router.delete('/users/:id', authenticateToken, requireAdmin, adminDeleteUser);
router.post('/users/:id/ban', authenticateToken, requireAdmin, banUser);
router.post('/users/:id/unban', authenticateToken, requireAdmin, unbanUser);
router.post('/users/:id/grant-points', authenticateToken, requireAdmin, grantPoints);
router.delete('/posts/:id', authenticateToken, requireAdmin, adminDeletePost);
router.delete('/groups/:id', authenticateToken, requireAdmin, adminDeleteGroup);

// Demo user management from webapp (same logic, JWT-secured)
router.post('/seed', authenticateToken, requireAdmin, seedDemoUsers);
router.delete('/demo-users', authenticateToken, requireAdmin, deleteDemoUsers);

export default router;
