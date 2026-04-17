import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import * as controller from '../controllers/streamController';

const router = Router();

router.use(authenticateToken);

router.post('/', controller.startStream);
router.post('/:id/end', controller.endStream);
router.get('/live', controller.getLiveStreams);
router.get('/:id', controller.getStream);
router.post('/:id/viewer-count', controller.updateViewerCount);
router.post('/:id/donate', controller.donateToStream);

export default router;
