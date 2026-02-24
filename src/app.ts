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

import { notFoundHandler, errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

// Health check — used by Railway deployment
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// API routes prefix
const apiRouter = express.Router();

apiRouter.get('/', (_req, res) => res.json({ message: 'Praxis API is running' }));
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/messages', messageRoutes);
apiRouter.use('/goals', goalRoutes);
apiRouter.use('/matches', matchingRoutes);
apiRouter.use('/feedback', feedbackRoutes);
apiRouter.use('/achievements', achievementRoutes);
apiRouter.use('/stripe', stripeRoutes);
apiRouter.use('/ai-coaching', aiCoachingRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/completions', completionRoutes);
apiRouter.use('/groups', groupRoutes);
apiRouter.use('/bets', bettingRoutes);
apiRouter.use('/challenges', challengeRoutes);

app.use('/api', apiRouter);

// Root level health check for Vercel functions compatibility
app.get('/', (_req, res) => res.json({ message: 'Praxis API Entry Point' }));

// Error Handling Middleware - MUST be last
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
