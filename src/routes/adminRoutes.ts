import { Router } from 'express';
import {
  seedDemoUsers, deleteDemoUsers,
  listAllUsers, adminDeleteUser, adminDeletePost, adminDeleteGroup,
  banUser, unbanUser, grantPoints,
  listGroups, getAdminStats, getNetworkData, createChallenge, listChallenges,
  listAllServices, adminDeleteService, listAllCoaches, decayPoints, promoteUser,
} from '../controllers/adminController';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

// ── curl-only routes (X-Admin-Secret header) ─────────────────────────────────
router.post('/seed-demo-users', seedDemoUsers);
router.delete('/delete-demo-users', deleteDemoUsers);
router.post('/decay-points', decayPoints); // cron or admin-secret — weekly economy balancer

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

// Analytics + moderation
router.get('/groups', authenticateToken, requireAdmin, listGroups);
router.get('/stats', authenticateToken, requireAdmin, getAdminStats);
router.get('/network', authenticateToken, requireAdmin, getNetworkData);
router.get('/challenges', authenticateToken, requireAdmin, listChallenges);
router.post('/challenges', authenticateToken, requireAdmin, createChallenge);
router.get('/services', authenticateToken, requireAdmin, listAllServices);
router.delete('/services/:id', authenticateToken, requireAdmin, adminDeleteService);
router.get('/coaches', authenticateToken, requireAdmin, listAllCoaches);
router.put('/users/:id/role', authenticateToken, requireAdmin, promoteUser);

export default router;
