require('dotenv').config();
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import messageRoutes from './routes/messageRoutes'; // Import message routes
import goalRoutes from './routes/goalRoutes';
import matchingRoutes from './routes/matchingRoutes'; // Import matching routes
import feedbackRoutes from './routes/feedbackRoutes'; // Import feedback routes
import achievementRoutes from './routes/achievementRoutes'; // Import achievement routes
import stripeRoutes from './routes/stripeRoutes'; // Import stripe routes

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

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});


