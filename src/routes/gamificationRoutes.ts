/**
 * Gamification Routes
 * Level system, daily quests, achievements, social rewards
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
  getGamificationProfile,
  getLeaderboard,
  getDailyQuests,
  progressQuest,
  claimQuestReward,
  getAchievements,
  trackSocialAction,
  getSocialTracking,
  getTitles,
  equipTitle,
  unequipTitle,
} from '../controllers/gamificationController';

const router = Router();

// Profile & Leaderboard
router.get('/profile', authenticateToken, getGamificationProfile);
router.get('/leaderboard', getLeaderboard);

// Daily Quests
router.get('/quests', authenticateToken, getDailyQuests);
router.post('/quests/:questType/progress', authenticateToken, progressQuest);
router.post('/quests/:questId/claim', authenticateToken, claimQuestReward);

// Achievements
router.get('/achievements', authenticateToken, getAchievements);

// Social Rewards
router.post('/social/track', authenticateToken, trackSocialAction);
router.get('/social/tracking', authenticateToken, getSocialTracking);

// Titles & Customization
router.get('/titles', authenticateToken, getTitles);
router.post('/titles/equip', authenticateToken, equipTitle);
router.post('/titles/unequip', authenticateToken, unequipTitle);

export default router;
