import { Router } from 'express';
import {
  listServices, getMyServices, getService,
  createService, updateService, deleteService,
} from '../controllers/servicesController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = Router();

router.get('/',       listServices);
router.get('/mine',   authenticateToken, getMyServices);
router.get('/:id',    getService);
router.post('/',      authenticateToken, createService);
router.put('/:id',    authenticateToken, updateService);
router.delete('/:id', authenticateToken, deleteService);

export default router;
