import express from 'express';
import {
  createCheckoutSession,
  createPPCheckout,
  createPortalSession,
  verifySession,
} from '../controllers/stripeController';
import { authenticateToken } from '../middleware/authenticateToken';

const router = express.Router();

// NOTE: POST /webhook is NOT mounted here. It is registered directly on the
// app in src/app.ts BEFORE express.json() so the handler receives a raw Buffer
// for Stripe signature verification.

// Subscription checkout (supports monthly and annual)
router.post('/create-checkout-session', authenticateToken, createCheckoutSession);

// One-time PP purchase
router.post('/create-pp-checkout', authenticateToken, createPPCheckout);

// Customer portal for subscription management
router.post('/create-portal-session', authenticateToken, createPortalSession);

// Server-side session verification
router.get('/verify-session', authenticateToken, verifySession);

export default router;