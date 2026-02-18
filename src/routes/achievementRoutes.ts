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
} from '../controllers/achievementController';

const router = express.Router();

// Achievement routes
router.post('/', createAchievement);
router.get('/:id', getAchievementById);
router.get('/', getAchievements);
router.put('/:id', updateAchievement);
router.delete('/:id', deleteAchievement);

// Comment routes
router.post('/:id/comments', addCommentToAchievement);
router.get('/:id/comments', getCommentsForAchievement);
router.put('/:achievementId/comments/:commentId', updateComment);
router.delete('/:achievementId/comments/:commentId', deleteComment);

// Vote routes
router.post('/:id/votes', addVoteToAchievement);
router.put('/:achievementId/votes/:voteId', updateVote);
router.delete('/:achievementId/votes/:voteId', deleteVote);

export default router;