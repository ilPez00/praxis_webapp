import { Router } from 'express';
import { getWidget, getWidgetData } from '../controllers/publicWidgetController';

const router = Router();
// No auth middleware — intentionally public
router.get('/:userId', getWidget);
router.get('/:userId/data', getWidgetData);
export default router;
