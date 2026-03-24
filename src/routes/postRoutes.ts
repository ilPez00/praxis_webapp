import express from 'express';
import {
  getPosts,
  getPost,
  getPersonalizedFeed,
  getUserPosts,
  createPost,
  deletePost,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
  votePost,
  getPostVote,
} from '../controllers/postController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = express.Router();

// Public reads
router.get('/feed', getPersonalizedFeed);
router.get('/by-user/:userId', getUserPosts);
router.get('/', getPosts);
router.get('/:id', getPost);
router.get('/:id/comments', getComments);

// Authenticated writes
router.post('/', authenticateToken, createPost);
router.delete('/:id', authenticateToken, deletePost);
router.post('/:id/likes', authenticateToken, toggleLike);
router.post('/:id/comments', authenticateToken, addComment);
router.delete('/:postId/comments/:commentId', authenticateToken, deleteComment);
router.post('/:id/vote', authenticateToken, votePost);
router.get('/:id/vote', authenticateToken, getPostVote);

export default router;
