import { Router } from 'express';
import { seedDemoUsers, deleteDemoUsers } from '../controllers/adminController';

const router = Router();

// POST /admin/seed-demo-users — seed realistic demo profiles for beta matching
router.post('/seed-demo-users', seedDemoUsers);

// DELETE /admin/delete-demo-users — remove all is_demo=true users
router.delete('/delete-demo-users', deleteDemoUsers);

export default router;
