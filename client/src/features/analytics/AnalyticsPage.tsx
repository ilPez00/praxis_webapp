import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../hooks/useUser';

import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Stack,
  Paper,
} from '@mui/material';

/**
 * @description Analytics page component for premium users.
 * Displays various charts and insights into their goal progress, feedback, and comparisons.
 */
const AnalyticsPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [progressData, setProgressData] = useState<any[]>([]);
  const [domainPerformance, setDomainPerformance] = useState<any[]>([]);
  const [feedbackTrends, setFeedbackTrends] = useState<any[]>([]);
  const [achievementRate, setAchievementRate] = useState<any>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);


  useEffect(() => {
    if (userLoading) return; // Wait for user loading to complete

    if (!user || !user.is_premium) {
      // If user is not premium, redirect or show an error
      navigate('/upgrade'); // Redirect to upgrade page
      return;
    }

    const fetchAnalyticsData = async () => {
      setLoadingAnalytics(true);
      setError(null);
      try {
        const userId = user.id;

        const [progressRes, domainRes, feedbackRes, achievementRes, comparisonRes] = await Promise.allSettled([
          axios.get(`http://localhost:3001/analytics/progress-over-time/${userId}`),
          axios.get(`http://localhost:3001/analytics/domain-performance/${userId}`),
          axios.get(`http://localhost:3001/analytics/feedback-trends/${userId}`),
          axios.get(`http://localhost:3001/analytics/achievement-rate/${userId}`),
          axios.get(`http://localhost:3001/analytics/comparison-data/${userId}`),
        ]);

        if (progressRes.status === 'fulfilled') setProgressData(progressRes.value.data);
        if (domainRes.status === 'fulfilled') setDomainPerformance(domainRes.value.data);
        if (feedbackRes.status === 'fulfilled') setFeedbackTrends(feedbackRes.value.data);
        if (achievementRes.status === 'fulfilled') setAchievementRate(achievementRes.value.data);
        if (comparisonRes.status === 'fulfilled') setComparisonData(comparisonRes.value.data);

      } catch (err) {
        console.error('Error fetching analytics data:', err);
        setError('Failed to fetch analytics data.');
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalyticsData();
  }, [user, userLoading, navigate]);

  if (userLoading || loadingAnalytics) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!user || !user.is_premium) {
    // This case should be handled by the redirect in useEffect, but as a fallback
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="warning">You need a premium subscription to access Advanced Analytics.</Alert>
        <Button variant="contained" color="primary" onClick={() => navigate('/upgrade')} sx={{ mt: 2 }}>
          Upgrade Now
        </Button>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Advanced Analytics for {user.name}
      </Typography>

      <Stack spacing={4} sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>Goal Progress Overview</Typography>
          {progressData.length > 0 ? (
            <Box>
              {progressData.map((data, index) => (
                <Typography key={index}>
                  {data.goalName} ({data.domain}): {Math.round(data.progress * 100)}% progress, Weight: {data.weight.toFixed(1)}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography>No goal progress data available.</Typography>
          )}
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>Domain Performance</Typography>
          {domainPerformance.length > 0 ? (
            <Box>
              {domainPerformance.map((data, index) => (
                <Typography key={index}>
                  {data.domain}: Average Progress {Math.round(data.averageProgress * 100)}%, Total Goals: {data.goalCount}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography>No domain performance data available.</Typography>
          )}
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>Feedback Trends</Typography>
          {feedbackTrends.length > 0 ? (
            <Box>
              {feedbackTrends.map((data, index) => (
                <Typography key={index}>
                  {data.grade}: {data.count} occurrences
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography>No feedback trends data available.</Typography>
          )}
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>Achievement Rate</Typography>
          {achievementRate ? (
            <Typography>
              Total Goals: {achievementRate.totalGoals}, Completed Achievements: {achievementRate.completedAchievements}, Rate: {Math.round(achievementRate.achievementRate * 100)}%
            </Typography>
          ) : (
            <Typography>No achievement rate data available.</Typography>
          )}
        </Paper>

        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>Comparison Data</Typography>
          {comparisonData ? (
            <Box>
              <Typography>{comparisonData.message}</Typography>
              {comparisonData.globalAverageProgress && <Typography>Global Average Progress: {Math.round(comparisonData.globalAverageProgress * 100)}%</Typography>}
              {comparisonData.globalAverageFeedbackDistribution && (
                <Typography>Global Average Feedback (Succeeded): {comparisonData.globalAverageFeedbackDistribution.Succeeded}</Typography>
              )}
            </Box>
          ) : (
            <Typography>No comparison data available.</Typography>
          )}
        </Paper>
      </Stack>
    </Container>
  );
};

export default AnalyticsPage;
