/// <reference path="./types/express.d.ts" />
require('dotenv').config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initSentry } from './lib/sentry';

// Initialize Sentry error tracking
initSentry();

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import messageRoutes from './routes/messageRoutes';
import goalRoutes from './routes/goalRoutes';
import matchingRoutes from './routes/matchingRoutes';
import feedbackRoutes from './routes/feedbackRoutes';
import achievementRoutes from './routes/achievementRoutes';
import stripeRoutes from './routes/stripeRoutes';
import aiCoachingRoutes from './routes/aiCoachingRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import adminRoutes from './routes/adminRoutes';
import completionRoutes from './routes/completionRoutes';
import groupRoutes from './routes/groupRoutes';
import bettingRoutes from './routes/bettingRoutes';
import challengeRoutes from './routes/challengeRoutes';
import coachRoutes from './routes/coachRoutes';
import searchRoutes from './routes/searchRoutes';
import marketplaceRoutes from './routes/marketplaceRoutes';
import postRoutes from './routes/postRoutes';
import checkinRoutes from './routes/checkinRoutes';
import pointsRoutes from './routes/pointsRoutes';
import servicesRoutes from './routes/servicesRoutes';
import wordsRoutes from './routes/wordsRoutes';
import eventsRoutes from './routes/eventsRoutes';
import honorRoutes from './routes/honorRoutes';
import referralRoutes from './routes/referralRoutes';
import friendRoutes from './routes/friendRoutes';
import notificationRoutes from './routes/notificationRoutes';
import pushRoutes from './routes/pushRoutes';
import muteRoutes from './routes/muteRoutes';
import placesRoutes from './routes/placesRoutes';
import offersRoutes from './routes/offersRoutes';
import duelRoutes from './routes/duelRoutes';
import trackerRoutes from './routes/trackerRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import journalRoutes from './routes/journalRoutes';
import axiomRoutes from './routes/axiomRoutes';
import axiomUnlockRoutes from './routes/axiomUnlockRoutes';
import notebookRoutes from './routes/notebookRoutes';
import diaryRoutes from './routes/diaryRoutes';
import authoringRoutes from './routes/authoringRoutes';
import sparringRoutes from './routes/sparringRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import calendarRoutes from './routes/calendarRoutes';
import streamRoutes from './routes/streamRoutes';
import narrativeRoutes from './routes/narrativeRoutes';
import publicWidgetRoutes from './routes/publicWidgetRoutes';
import adminCLIRoutes from './routes/adminCLIRoutes';
import healthRoutes from './routes/healthRoutes';
import gamificationRoutes from './routes/gamificationRoutes';
import seasonalEventRoutes from './routes/seasonalEventRoutes';
import accountabilityBuddyRoutes from './routes/accountabilityBuddyRoutes';
import failsRoutes from './routes/failsRoutes';
import weeklyChallengeRoutes from './routes/weeklyChallengeRoutes';
import agentRoutes from './routes/agentRoutes';
import mcpRoutes from './routes/mcpRoutes';

import { supabase } from './lib/supabaseClient';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { authLimiter, aiLimiter, axiomLimiter, generalLimiter, strictLimiter } from './middleware/rateLimiter';
import { authenticateToken } from './middleware/authenticateToken';
import { requireAdmin } from './middleware/requireAdmin';
import { requestTracer, auditSecurity } from './utils/logger';

const app = express();

// CORS configuration - restrict to production domains
const allowedOrigins = [
  'https://praxis-webapp.vercel.app',
  'https://praxisweb.xyz',
  'https://www.praxisweb.xyz',
  'https://praxis.app',
  'https://www.praxis.app',
  process.env.CLIENT_URL || 'http://localhost:3000',
];

// Railway production URL (set via environment variable)
const railwayOrigin = process.env.RAILWAY_STATIC_URL;
if (railwayOrigin) {
  allowedOrigins.push(railwayOrigin);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.indexOf(origin) !== -1;

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },

  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret', 'X-API-Key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for React
        'https://www.google-analytics.com',
        'https://www.googletagmanager.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for MUI
        'https://fonts.googleapis.com',
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
      ],
      imgSrc: [
        "'self'",
        'blob:',
        'data:',
        'https:',
      ],
      connectSrc: [
        "'self'",
        'https://*.supabase.co',
        'https://*.vercel.app',
        'https://*.up.railway.app',
        'https://www.google-analytics.com',
        'https://api.stripe.com',
        'https://accounts.google.com',
        'https://www.googleapis.com',
      ],
      frameSrc: [
        "'self'",
        'https://js.stripe.com',
        'https://accounts.google.com',
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

app.use(express.json());

// Apply request tracing middleware (after CORS, before routes)
app.use(requestTracer);

// Run security audit on startup
auditSecurity();

// Liveness — must return instantly, no external I/O (Railway healthcheck path)
app.get('/health', (_req, res) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const keyType = key.startsWith('sb_') ? 'anon_publishable_WRONG' : key.startsWith('eyJ') ? 'service_role_ok' : 'missing';
  res.json({ status: 'ok', supabase_key_type: keyType });
});

// Readiness check — used for Kubernetes/Railway orchestration
app.get('/health/ready', async (_req, res) => {
  const checks: Record<string, string> = {};
  let isHealthy = true;

  // Check database
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    checks.database = error ? `error: ${error.message}` : 'ok';
    if (error) isHealthy = false;
  } catch (err: any) {
    checks.database = `error: ${err.message}`;
    isHealthy = false;
  }

  // Check Stripe API (if configured)
  if (process.env.STRIPE_SECRET_KEY) {
    checks.stripe = 'configured';
  } else {
    checks.stripe = 'not configured (optional)';
  }

  // Check Sentry
  if (process.env.SENTRY_DSN) {
    checks.sentry = 'configured';
  } else {
    checks.sentry = 'not configured (optional)';
  }

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ready' : 'not ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// API routes prefix
const apiRouter = express.Router();

apiRouter.get('/', (_req, res) => res.json({ message: 'Praxis API is running' }));

// Apply rate limiters to critical routes
apiRouter.use('/auth', authLimiter, authRoutes);  // Strict: 5 attempts per 15 min
apiRouter.use('/ai-coaching', aiLimiter, aiCoachingRoutes);  // AI cost control: 10/min
apiRouter.use('/axiom', axiomLimiter, axiomRoutes);  // Axiom briefs: 3/hour
apiRouter.use('/stripe', strictLimiter, stripeRoutes);  // Payments: 10/15 min
apiRouter.use('/admin', strictLimiter, authenticateToken, requireAdmin, adminRoutes);  // Admin ops: 10/15 min + auth + admin check
apiRouter.use('/admin/cli', strictLimiter, authenticateToken, requireAdmin, adminCLIRoutes);  // CLI control: 10/15 min + auth + admin check

// General routes with fallback limiter
apiRouter.use('/users', generalLimiter, userRoutes);
apiRouter.use('/messages', generalLimiter, messageRoutes);
apiRouter.use('/goals', generalLimiter, goalRoutes);
apiRouter.use('/matches', generalLimiter, matchingRoutes);
apiRouter.use('/feedback', generalLimiter, feedbackRoutes);
apiRouter.use('/achievements', generalLimiter, achievementRoutes);
apiRouter.use('/analytics', generalLimiter, analyticsRoutes);
apiRouter.use('/completions', generalLimiter, completionRoutes);
apiRouter.use('/groups', generalLimiter, groupRoutes);
apiRouter.use('/bets', generalLimiter, bettingRoutes);
apiRouter.use('/challenges', generalLimiter, challengeRoutes);
apiRouter.use('/coaches', generalLimiter, coachRoutes);
apiRouter.use('/search', generalLimiter, searchRoutes);
apiRouter.use('/marketplace', generalLimiter, marketplaceRoutes);
apiRouter.use('/posts', generalLimiter, postRoutes);
apiRouter.use('/checkins', generalLimiter, checkinRoutes);
apiRouter.use('/points', generalLimiter, pointsRoutes);
apiRouter.use('/services', generalLimiter, servicesRoutes);
apiRouter.use('/words', generalLimiter, wordsRoutes);
apiRouter.use('/events', generalLimiter, eventsRoutes);
apiRouter.use('/honor', generalLimiter, honorRoutes);
apiRouter.use('/referrals', generalLimiter, referralRoutes);
apiRouter.use('/friends', generalLimiter, friendRoutes);
apiRouter.use('/notifications', generalLimiter, notificationRoutes);
apiRouter.use('/push', generalLimiter, pushRoutes);
apiRouter.use('/mutes', generalLimiter, muteRoutes);
apiRouter.use('/places', generalLimiter, placesRoutes);
apiRouter.use('/offers', generalLimiter, offersRoutes);
apiRouter.use('/duels', generalLimiter, duelRoutes);
apiRouter.use('/trackers', generalLimiter, trackerRoutes);
apiRouter.use('/dashboard', generalLimiter, dashboardRoutes);
apiRouter.use('/journal', generalLimiter, journalRoutes);
// NOTE: /axiom is already registered above with axiomLimiter (line 125) — do NOT re-register here
apiRouter.use('/axiom-unlock', generalLimiter, axiomUnlockRoutes);
apiRouter.use('/notebook', generalLimiter, notebookRoutes);
apiRouter.use('/diary', generalLimiter, diaryRoutes);
apiRouter.use('/authoring', generalLimiter, authoringRoutes);
apiRouter.use('/schedule', generalLimiter, scheduleRoutes);
apiRouter.use('/calendar', generalLimiter, calendarRoutes);
apiRouter.use('/streams', generalLimiter, streamRoutes);
apiRouter.use('/narratives', generalLimiter, narrativeRoutes);
apiRouter.use('/sparring', generalLimiter, sparringRoutes);
apiRouter.use('/gamification', generalLimiter, gamificationRoutes);
apiRouter.use('/seasonal-events', generalLimiter, seasonalEventRoutes);
apiRouter.use('/buddies', generalLimiter, accountabilityBuddyRoutes);
apiRouter.use('/fails', generalLimiter, failsRoutes);
apiRouter.use('/weekly-challenge', generalLimiter, weeklyChallengeRoutes);
apiRouter.use('/agent', generalLimiter, agentRoutes);

app.use('/api', apiRouter);

// Health check endpoints (no auth required - for monitoring)
app.use('/health', healthRoutes);

// Root level health check for Vercel functions compatibility
app.get('/', (_req, res) => res.json({ message: 'Praxis API Entry Point' }));

// Public widget routes (no /api prefix, no auth — embeddable iframe)
// Rate limited to prevent user enumeration attacks
app.use('/public/widget', generalLimiter, publicWidgetRoutes);

// Error Handling Middleware - MUST be last
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
