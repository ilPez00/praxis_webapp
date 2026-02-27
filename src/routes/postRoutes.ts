import express from 'express';
import {
  getPosts,
  createPost,
  deletePost,
  toggleLike,
  getComments,
  addComment,
  deleteComment,
} from '../controllers/postController';

const router = express.Router();

router.get('/', getPosts);
router.post('/', createPost);
router.delete('/:id', deletePost);
router.post('/:id/likes', toggleLike);
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.delete('/:postId/comments/:commentId', deleteComment);

export default router;
