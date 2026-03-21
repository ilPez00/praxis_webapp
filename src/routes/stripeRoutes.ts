import express from 'express';
import { createCheckoutSession, createPPCheckout, handleWebhook } from '../controllers/stripeController';
import bodyParser from 'body-parser'; // Import body-parser
import { authenticateToken } from '../middleware/authenticateToken';

const router = express.Router();

router.post('/create-checkout-session', authenticateToken, createCheckoutSession);
router.post('/create-pp-checkout', authenticateToken, createPPCheckout);

// Use raw body parser for webhook endpoint
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), handleWebhook);

export default router;