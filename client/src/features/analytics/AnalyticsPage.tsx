import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/common/GlassCard';
import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Stack,
  Chip,
  LinearProgress,
  Grid,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FeedbackIcon from '@mui/icons-material/Feedback';
import InsightsIcon from '@mui/icons-material/Insights';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LockIcon from '@mui/icons-material/Lock';
import { DOMAIN_COLORS } from '../../types/goal';

const StatCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; glowColor?: string }> = ({
  icon, title, children, glowColor,
}) => (
  <GlassCard glowColor={glowColor} sx={{ p: 3, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <Box sx={{ color: 'primary.main' }}>{icon}</Box>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
    </Box>
    {children}
  </GlassCard>
);

/**
 * @description Advanced Analytics page — premium-only feature.
 * Displays goal progress, domain performance, feedback trends, achievement rate,
 * and anonymized comparison data. All endpoints require auth token.
 *
 * NOTE: getComparisonData endpoint is a placeholder returning simulated aggregates.
 * Real implementation requires anonymized aggregate DB queries (whitepaper §6).
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
    if (userLoading) return;
    if (!user || !user.is_premium) {
      navigate('/upgrade');
      return;
    }

    const fetchAnalyticsData = async () => {
      setLoadingAnalytics(true);
      setError(null);
      try {
        const userId = user.id;
        // Auth header required — analytics endpoints are protected by authenticateToken middleware
        const { data: { session } } = await supabase.auth.getSession();
        const authHeaders = { headers: { Authorization: `Bearer ${session?.access_token}` } };

        const [progressRes, domainRes, feedbackRes, achievementRes, comparisonRes] = await Promise.allSettled([
          axios.get(`${API_URL}/analytics/progress-over-time/${userId}`, authHeaders),
          axios.get(`${API_URL}/analytics/domain-performance/${userId}`, authHeaders),
          axios.get(`${API_URL}/analytics/feedback-trends/${userId}`, authHeaders),
          axios.get(`${API_URL}/analytics/achievement-rate/${userId}`, authHeaders),
          axios.get(`${API_URL}/analytics/comparison-data/${userId}`, authHeaders),
        ]);

        if (progressRes.status === 'fulfilled') setProgressData(progressRes.value.data);
        if (domainRes.status === 'fulfilled') setDomainPerformance(domainRes.value.data);
        if (feedbackRes.status === 'fulfilled') setFeedbackTrends(feedbackRes.value.data);
        if (achievementRes.status === 'fulfilled') setAchievementRate(achievementRes.value.data);
        if (comparisonRes.status === 'fulfilled') setComparisonData(comparisonRes.value.data);
      } catch (err) {
        setError('Failed to fetch analytics data.');
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalyticsData();
  }, [user, userLoading, navigate]);

  if (userLoading || loadingAnalytics) {
    return (
      <Container sx={{ mt: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Loading analytics...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!user || !user.is_premium) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert
          severity="warning"
          icon={<LockIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/upgrade')}>Upgrade</Button>
          }
        >
          Advanced Analytics requires a Premium subscription.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <InsightsIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Advanced Analytics
          </Typography>
          <Chip label="PREMIUM" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: 'primary.main', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }} />
        </Box>
        <Typography color="text.secondary">
          Deep insights into your goal progress and peer interactions.
        </Typography>
      </Box>

      <Stack spacing={3}>
        {/* Row 1: Progress + Achievement Rate */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <StatCard icon={<TrendingUpIcon />} title="Goal Progress" glowColor="rgba(245,158,11,0.15)">
              {progressData.length > 0 ? (
                <Stack spacing={2}>
                  {progressData.map((data, i) => {
                    const pct = Math.round(data.progress * 100);
                    const color = DOMAIN_COLORS[data.domain] || '#F59E0B';
                    return (
                      <Box key={i}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{data.goalName}</Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip label={data.domain} size="small" sx={{ bgcolor: `${color}20`, color, border: `1px solid ${color}40`, fontSize: '0.7rem', height: 20 }} />
                            <Typography variant="body2" sx={{ color, fontWeight: 700 }}>{pct}%</Typography>
                          </Box>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 6, borderRadius: 3,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography color="text.secondary" variant="body2">No goal data yet.</Typography>
              )}
            </StatCard>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <StatCard icon={<EmojiEventsIcon />} title="Achievement Rate" glowColor="rgba(16,185,129,0.15)">
              {achievementRate ? (
                <Box>
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h2" sx={{ fontWeight: 800, color: 'success.main', lineHeight: 1 }}>
                      {Math.round(achievementRate.achievementRate * 100)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>completion rate</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={achievementRate.achievementRate * 100}
                    sx={{
                      height: 8, borderRadius: 4, mb: 2,
                      bgcolor: 'rgba(16,185,129,0.12)',
                      '& .MuiLinearProgress-bar': { bgcolor: '#10B981', borderRadius: 4 },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{achievementRate.totalGoals}</Typography>
                      <Typography variant="caption" color="text.secondary">Total Goals</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {achievementRate.completedAchievements}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Completed</Typography>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography color="text.secondary" variant="body2">No achievement data yet.</Typography>
              )}
            </StatCard>
          </Grid>
        </Grid>

        {/* Row 2: Domain Performance */}
        <StatCard icon={<InsightsIcon />} title="Domain Performance" glowColor="rgba(139,92,246,0.15)">
          {domainPerformance.length > 0 ? (
            <Grid container spacing={2}>
              {domainPerformance.map((data, i) => {
                const color = DOMAIN_COLORS[data.domain] || '#8B5CF6';
                const pct = Math.round(data.averageProgress * 100);
                return (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
                    <Box
                      sx={{
                        p: 2, borderRadius: 2, textAlign: 'center',
                        bgcolor: `${color}12`, border: `1px solid ${color}30`,
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: `${color}20`, transform: 'translateY(-2px)' },
                      }}
                    >
                      <Typography variant="h4" sx={{ fontWeight: 800, color }}>{pct}%</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {data.domain}
                      </Typography>
                      <Typography variant="caption" sx={{ color: color + 'cc' }}>
                        {data.goalCount} goal{data.goalCount !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Typography color="text.secondary" variant="body2">No domain data yet.</Typography>
          )}
        </StatCard>

        {/* Row 3: Feedback Trends + Comparison */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <StatCard icon={<FeedbackIcon />} title="Feedback Trends" glowColor="rgba(59,130,246,0.15)">
              {feedbackTrends.filter(d => d.count > 0).length > 0 ? (
                <Stack spacing={1.5}>
                  {feedbackTrends.filter(d => d.count > 0).map((data, i) => {
                    const maxCount = Math.max(...feedbackTrends.map(d => d.count));
                    const pct = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
                    return (
                      <Box key={i}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{data.grade}</Typography>
                          <Typography variant="body2" color="text.secondary">{data.count}×</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 6, borderRadius: 3,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            '& .MuiLinearProgress-bar': { bgcolor: 'info.main', borderRadius: 3 },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography color="text.secondary" variant="body2">No feedback received yet.</Typography>
              )}
            </StatCard>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <StatCard icon={<CompareArrowsIcon />} title="Community Comparison" glowColor="rgba(245,158,11,0.1)">
              {comparisonData ? (
                <Box>
                  <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
                    Placeholder data — real aggregation coming in Step 15.
                  </Alert>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {Math.round((comparisonData.globalAverageProgress || 0) * 100)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Global Avg Progress</Typography>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Typography color="text.secondary" variant="body2">No comparison data available.</Typography>
              )}
            </StatCard>
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
};

export default AnalyticsPage;
