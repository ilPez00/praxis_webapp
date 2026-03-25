import { Router } from 'express';
import { signup, login } from '../controllers/authController';
import { validateBody } from '../middleware/validateRequest';
import { registerSchema, loginSchema } from '../schemas/userSchemas';

const router = Router();

// POST /auth/signup - Register new user
router.post('/signup', validateBody(registerSchema), signup);

// POST /auth/login - User login
router.post('/login', validateBody(loginSchema), login);

export default router;
