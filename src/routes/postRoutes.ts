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
} from '../controllers/postController';

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

export default router;
