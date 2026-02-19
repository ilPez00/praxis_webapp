import { Router } from 'express';
import { seedDemoUsers } from '../controllers/adminController';

const router = Router();

// POST /admin/seed-demo-users — seed realistic demo profiles for beta matching
router.post('/seed-demo-users', seedDemoUsers);

export default router;
