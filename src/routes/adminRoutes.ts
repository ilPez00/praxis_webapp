import { Router } from 'express';
import {
  seedDemoUsers, deleteDemoUsers,
  listAllUsers, adminDeleteUser, adminDeletePost, adminDeleteGroup,
  banUser, unbanUser, grantPoints, resetTreeEdits, getUserDetail,
  listGroups, getAdminStats, getNetworkData, createChallenge, listChallenges,
  listAllServices, adminDeleteService, listAllCoaches, decayPoints, promoteUser,
  leaderboardBonus,
  streakAlerts,
  getSystemConfig, updateSystemConfig, triggerAxiomScan, togglePremium
} from '../controllers/adminController';
import adminAxiomRoutes from './adminAxiomRoutes';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';
import { generateAllBriefs } from '../controllers/adminController';

const router = Router();

// ── curl-only routes (X-Admin-Secret header) ─────────────────────────────────
router.post('/seed-demo-users', seedDemoUsers);
router.delete('/delete-demo-users', deleteDemoUsers);
router.post('/decay-points', decayPoints);             // cron or admin-secret — weekly economy balancer
router.post('/cron/leaderboard-bonus', leaderboardBonus); // daily cron — top 100 PP awards
router.post('/cron/streak-alerts', streakAlerts);         // nightly cron — notify at-risk streaks

// ── Webapp admin routes (JWT + is_admin check) ────────────────────────────────
router.get('/users', authenticateToken, requireAdmin, listAllUsers);
router.delete('/users/:id', authenticateToken, requireAdmin, adminDeleteUser);
router.post('/users/:id/ban', authenticateToken, requireAdmin, banUser);
router.post('/users/:id/unban', authenticateToken, requireAdmin, unbanUser);
router.post('/users/:id/grant-points', authenticateToken, requireAdmin, grantPoints);
router.post('/users/:id/reset-tree-edits', authenticateToken, requireAdmin, resetTreeEdits);
router.get('/users/:id/detail', authenticateToken, requireAdmin, getUserDetail);
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
router.put('/users/:id/premium', authenticateToken, requireAdmin, togglePremium);

// Axiom & Config
router.get('/config', authenticateToken, requireAdmin, getSystemConfig);
router.put('/config/:key', authenticateToken, requireAdmin, updateSystemConfig);
router.post('/axiom/trigger-scan', authenticateToken, requireAdmin, triggerAxiomScan);
router.post('/axiom/generate-all-briefs', authenticateToken, requireAdmin, generateAllBriefs);
router.use('/axiom', adminAxiomRoutes);

export default router;
