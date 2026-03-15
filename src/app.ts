/// <reference path="./types/express.d.ts" />
require('dotenv').config();
import express from 'express';
import cors from 'cors';

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
import muteRoutes from './routes/muteRoutes';
import placesRoutes from './routes/placesRoutes';
import offersRoutes from './routes/offersRoutes';
import duelRoutes from './routes/duelRoutes';
import trackerRoutes from './routes/trackerRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import journalRoutes from './routes/journalRoutes';
import axiomRoutes from './routes/axiomRoutes';
import notebookRoutes from './routes/notebookRoutes';
import diaryRoutes from './routes/diaryRoutes';
import sparringRoutes from './routes/sparringRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import publicWidgetRoutes from './routes/publicWidgetRoutes';

import { supabase } from './lib/supabaseClient';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { authLimiter, aiLimiter, axiomLimiter, generalLimiter, strictLimiter } from './middleware/rateLimiter';
import { requestTracer, auditSecurity } from './utils/logger';

const app = express();

// CORS configuration - restrict to production domains
const allowedOrigins = [
  'https://praxis-webapp.vercel.app',
  'https://praxis.app',
  'https://www.praxis.app',
  process.env.CLIENT_URL || 'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));
app.use(express.json());

// Apply request tracing middleware (after CORS, before routes)
app.use(requestTracer);

// Run security audit on startup
auditSecurity();

// Health check — used by Railway deployment
app.get('/health', async (_req, res) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const keyType = key.startsWith('sb_') ? 'anon_publishable_WRONG' : key.startsWith('eyJ') ? 'service_role_ok' : 'missing';
  // Test an actual write to catch service-role key / RLS issues
  const testId = '00000000-0000-0000-0000-000000000001';
  const { error: writeErr } = await supabase
    .from('messages')
    .insert({ sender_id: testId, receiver_id: testId, content: '__health_check__' })
    .select()
    .single();
  // Immediately delete it (best-effort)
  await supabase.from('messages').delete().eq('content', '__health_check__');
  const writeOk = !writeErr || writeErr.code === '23503'; // 23503 = FK violation (user doesn't exist) = key is fine
  res.json({
    status: 'ok',
    supabase_key_type: keyType,
    write_test: writeOk ? 'ok' : writeErr?.message,
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
apiRouter.use('/admin', strictLimiter, adminRoutes);  // Admin ops: 10/15 min

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
apiRouter.use('/mutes', generalLimiter, muteRoutes);
apiRouter.use('/places', generalLimiter, placesRoutes);
apiRouter.use('/offers', generalLimiter, offersRoutes);
apiRouter.use('/duels', generalLimiter, duelRoutes);
apiRouter.use('/trackers', generalLimiter, trackerRoutes);
apiRouter.use('/dashboard', generalLimiter, dashboardRoutes);
apiRouter.use('/journal', generalLimiter, journalRoutes);
apiRouter.use('/notebook', generalLimiter, notebookRoutes);
apiRouter.use('/diary', generalLimiter, diaryRoutes);
apiRouter.use('/schedule', generalLimiter, scheduleRoutes);
apiRouter.use('/sparring', generalLimiter, sparringRoutes);

app.use('/api', apiRouter);

// Root level health check for Vercel functions compatibility
app.get('/', (_req, res) => res.json({ message: 'Praxis API Entry Point' }));

// Error Handling Middleware - MUST be last
app.use('/public/widget', publicWidgetRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
