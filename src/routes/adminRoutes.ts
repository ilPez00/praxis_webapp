import { Router } from 'express';
import { seedDemoUsers, deleteDemoUsers, listAllUsers, adminDeleteUser, adminDeletePost, adminDeleteGroup } from '../controllers/adminController';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// ── curl-only routes (X-Admin-Secret header) ─────────────────────────────────
// POST /admin/seed-demo-users — seed realistic demo profiles for beta matching
router.post('/seed-demo-users', seedDemoUsers);

// DELETE /admin/delete-demo-users — remove all is_demo=true users
router.delete('/delete-demo-users', deleteDemoUsers);

// ── Webapp admin routes (JWT + is_admin check) ────────────────────────────────
router.get('/users', authenticateToken, requireAdmin, listAllUsers);
router.delete('/users/:id', authenticateToken, requireAdmin, adminDeleteUser);
router.delete('/posts/:id', authenticateToken, requireAdmin, adminDeletePost);
router.delete('/groups/:id', authenticateToken, requireAdmin, adminDeleteGroup);

export default router;
