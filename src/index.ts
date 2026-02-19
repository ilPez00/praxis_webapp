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

import { notFoundHandler, errorHandler } from './middleware/errorHandler'; // Import error handling middleware

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/messages', messageRoutes); // Use message routes
app.use('/goals', goalRoutes);
app.use('/matches', matchingRoutes); // Use matching routes
app.use('/feedback', feedbackRoutes); // Use feedback routes
app.use('/achievements', achievementRoutes); // Use achievement routes
app.use('/stripe', stripeRoutes); // Use stripe routes
app.use('/ai-coaching', aiCoachingRoutes); // Use AI Coaching routes
app.use('/analytics', analyticsRoutes); // Use analytics routes
app.use('/admin', adminRoutes); // Admin-only endpoints (protected by X-Admin-Secret header)

// Error Handling Middleware - MUST be last
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});


