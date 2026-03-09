import express from 'express';
import { createCheckoutSession, createPPCheckout, handleWebhook } from '../controllers/stripeController';
import bodyParser from 'body-parser'; // Import body-parser

const router = express.Router();

router.post('/create-checkout-session', createCheckoutSession);
router.post('/create-pp-checkout', createPPCheckout);

// Use raw body parser for webhook endpoint
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), handleWebhook);

export default router;