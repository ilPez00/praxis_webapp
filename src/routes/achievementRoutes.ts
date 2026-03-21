import express from 'express';
import {
  createAchievement,
  getAchievementById,
  getAchievements,
  updateAchievement,
  deleteAchievement,
  addCommentToAchievement,
  getCommentsForAchievement,
  updateComment,
  deleteComment,
  addVoteToAchievement,
  updateVote,
  deleteVote,
  setAchievementVideo,
} from '../controllers/achievementController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = express.Router();

// Achievement routes — reads are public, writes require auth
router.get('/', getAchievements);
router.get('/:id', getAchievementById);
router.post('/', authenticateToken, createAchievement);
router.put('/:id', authenticateToken, updateAchievement);
router.delete('/:id', authenticateToken, deleteAchievement);

// Comment routes
router.get('/:id/comments', getCommentsForAchievement);
router.post('/:id/comments', authenticateToken, addCommentToAchievement);
router.put('/:achievementId/comments/:commentId', authenticateToken, updateComment);
router.delete('/:achievementId/comments/:commentId', authenticateToken, deleteComment);

// Vote routes
router.post('/:id/votes', authenticateToken, addVoteToAchievement);
router.put('/:achievementId/votes/:voteId', authenticateToken, updateVote);
router.delete('/:achievementId/votes/:voteId', authenticateToken, deleteVote);

// Video route
router.patch('/:id/video', authenticateToken, setAchievementVideo);

export default router;