require('dotenv').config();
import express from 'express';
import cors from 'cors';

import aiCoachingRoutes from './routes/aiCoachingRoutes'; // Import AI Coaching routes
import analyticsRoutes from './routes/analyticsRoutes'; // Import analytics routes

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

// Error Handling Middleware - MUST be last
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});


