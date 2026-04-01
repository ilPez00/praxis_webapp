import { Router } from 'express';
import {
  seedDemoUsers, deleteDemoUsers,
  listAllUsers, adminDeleteUser, adminDeletePost, adminDeleteGroup,
  banUser, unbanUser, grantPoints, grantPointsToAll, resetTreeEdits, getUserDetail,
  listGroups, getAdminStats, getNetworkData, createChallenge, listChallenges,
  listAllServices, adminDeleteService, listAllCoaches, decayPoints, promoteUser,
  leaderboardBonus,
  streakAlerts,
  getSystemConfig, updateSystemConfig, triggerAxiomScan, togglePremium,
  importOSMPlacesEndpoint,
  clearSeenMessages,
  getAdminMetrics
} from '../controllers/adminController';
import adminAxiomRoutes from './adminAxiomRoutes';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';
import { generateAllBriefs } from '../controllers/adminController';
import adminDebugRoutes from './adminDebugRoutes';
import { validateBody } from '../middleware/validateRequest';
import { grantPointsBodySchema, banUserBodySchema, togglePremiumBodySchema, promoteUserBodySchema, updateSystemConfigBodySchema, importOSMPlacesBodySchema, createChallengeBodySchema } from '../schemas/adminSchemas';

const router = Router();

// ── curl-only routes (X-Admin-Secret header required) ────────────────────────
// These routes rely on X-Admin-Secret header checked inside each controller.
// authenticateToken is NOT applied so they can be called from cron/scripts without JWT.
// The controllers MUST validate X-Admin-Secret before proceeding.
router.post('/seed-demo-users', seedDemoUsers);
router.delete('/delete-demo-users', deleteDemoUsers);
router.post('/decay-points', decayPoints);             // cron or admin-secret — weekly economy balancer
router.post('/cron/leaderboard-bonus', leaderboardBonus); // daily cron — top 100 PP awards
router.post('/cron/streak-alerts', streakAlerts);         // nightly cron — notify at-risk streaks

// ── Webapp admin routes (JWT + is_admin check) ────────────────────────────────
router.get('/users', authenticateToken, requireAdmin, listAllUsers);
router.delete('/users/:id', authenticateToken, requireAdmin, adminDeleteUser);
router.post('/users/:id/ban', authenticateToken, requireAdmin, validateBody(banUserBodySchema), banUser);
router.post('/users/:id/unban', authenticateToken, requireAdmin, unbanUser);
router.post('/users/:id/grant-points', authenticateToken, requireAdmin, validateBody(grantPointsBodySchema), grantPoints);
router.post('/users/grant-points-all', authenticateToken, requireAdmin, grantPointsToAll);
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
router.post('/challenges', authenticateToken, requireAdmin, validateBody(createChallengeBodySchema), createChallenge);
router.get('/services', authenticateToken, requireAdmin, listAllServices);
router.delete('/services/:id', authenticateToken, requireAdmin, adminDeleteService);
router.get('/coaches', authenticateToken, requireAdmin, listAllCoaches);
router.put('/users/:id/role', authenticateToken, requireAdmin, validateBody(promoteUserBodySchema), promoteUser);
router.put('/users/:id/premium', authenticateToken, requireAdmin, validateBody(togglePremiumBodySchema), togglePremium);

// Axiom & Config
router.get('/config', authenticateToken, requireAdmin, getSystemConfig);
router.put('/config/:key', authenticateToken, requireAdmin, validateBody(updateSystemConfigBodySchema), updateSystemConfig);
router.post('/config/clear-seen-messages', authenticateToken, requireAdmin, clearSeenMessages);
router.post('/axiom/trigger-scan', authenticateToken, requireAdmin, triggerAxiomScan);
router.post('/axiom/generate-all-briefs', authenticateToken, requireAdmin, generateAllBriefs);
// OSM place import
router.post('/import-osm-places', authenticateToken, requireAdmin, validateBody(importOSMPlacesBodySchema), importOSMPlacesEndpoint);

// Metrics dashboard
router.get('/metrics', authenticateToken, requireAdmin, getAdminMetrics);

router.use('/axiom', adminAxiomRoutes);
router.use('/debug', adminDebugRoutes);

export default router;
