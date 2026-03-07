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

router.get('/feed', getPersonalizedFeed);
router.get('/by-user/:userId', getUserPosts);
router.get('/', getPosts);
router.post('/', createPost);
router.get('/:id', getPost);
router.delete('/:id', deletePost);
router.post('/:id/likes', toggleLike);
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.delete('/:postId/comments/:commentId', deleteComment);
router.post('/:id/vote', authenticateToken, votePost);
router.get('/:id/vote', authenticateToken, getPostVote);

export default router;
