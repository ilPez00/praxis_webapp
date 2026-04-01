import express from 'express';
import { 
  createCheckoutSession, 
  createPPCheckout, 
  handleWebhook,
  createPortalSession,
  verifySession,
} from '../controllers/stripeController';
import bodyParser from 'body-parser'; // Import body-parser
import { authenticateToken } from '../middleware/authenticateToken';

const router = express.Router();

// Subscription checkout (supports monthly and annual)
router.post('/create-checkout-session', authenticateToken, createCheckoutSession);

// One-time PP purchase
router.post('/create-pp-checkout', authenticateToken, createPPCheckout);

// Customer portal for subscription management
router.post('/create-portal-session', authenticateToken, createPortalSession);

// Server-side session verification
router.get('/verify-session', authenticateToken, verifySession);

// Use raw body parser for webhook endpoint
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), handleWebhook);

export default router;