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
  Stack,
  Chip,
  LinearProgress,
  Grid,
  Avatar,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FeedbackIcon from '@mui/icons-material/Feedback';
import InsightsIcon from '@mui/icons-material/Insights';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { DOMAIN_COLORS } from '../../types/goal';
import ProBanner from '../../components/common/ProBanner';

const MEDALS = ['🥇', '🥈', '🥉'];

function getStreakTier(streak: number): { label: string; color: string } {
  if (streak >= 30) return { label: 'Elite', color: '#EF4444' };
  if (streak >= 14) return { label: 'Veteran', color: '#8B5CF6' };
  if (streak >= 7)  return { label: 'Disciplined', color: '#3B82F6' };
  if (streak >= 3)  return { label: 'Consistent', color: '#10B981' };
  return { label: 'Newcomer', color: '#6B7280' };
}

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar_url?: string;
  praxis_points: number;
  is_premium?: boolean;
  current_streak?: number;
  reliability_score?: number;
  rank: number;
  similarity: number;
  domains: string[];
}

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

  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [lbFilter, setLbFilter] = useState<'all' | 'aligned'>('all');

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

        // Leaderboard
        try {
          const lbRes = await axios.get(`${API_URL}/users/leaderboard`, { params: { userId } });
          setLeaderboardEntries(Array.isArray(lbRes.data) ? lbRes.data : []);
        } catch { /* non-fatal */ }
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
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <ProBanner message="Advanced Analytics — deep goal insights, domain performance, feedback trends, and peer comparison — is a Praxis Pro feature." />
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

      {/* Leaderboard */}
      <GlassCard glowColor="rgba(245,158,11,0.1)" sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LeaderboardIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Community Leaderboard</Typography>
          </Box>
          <ToggleButtonGroup
            size="small"
            value={lbFilter}
            exclusive
            onChange={(_, v) => v && setLbFilter(v)}
            sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.4, fontSize: '0.75rem', fontWeight: 600 } }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="aligned">
              <AutoAwesomeIcon sx={{ fontSize: 14, mr: 0.5 }} />
              Aligned
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {leaderboardEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No leaderboard data yet.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {(lbFilter === 'aligned'
              ? leaderboardEntries.filter(e => e.similarity > 0)
              : leaderboardEntries
            ).map((entry, idx) => {
              const medal = MEDALS[idx];
              const tier = getStreakTier(entry.current_streak ?? 0);
              const isMe = entry.id === user?.id;
              return (
                <Box
                  key={entry.id}
                  onClick={() => navigate(`/profile/${entry.id}`)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    p: 1.5, borderRadius: '12px', cursor: 'pointer',
                    bgcolor: isMe ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                    border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.04)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Typography sx={{ minWidth: 28, fontSize: medal ? '1.1rem' : '0.8rem', fontWeight: 800, color: 'text.disabled', textAlign: 'center' }}>
                    {medal ?? `#${entry.rank}`}
                  </Typography>
                  <Avatar src={entry.avatar_url || undefined} sx={{ width: 34, height: 34, border: isMe ? '2px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)' }}>
                    {(entry.name ?? 'U').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{entry.name ?? 'Praxis User'}</Typography>
                      {isMe && <Chip label="you" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.12)', color: 'primary.main' }} />}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {entry.domains?.slice(0, 2).map(d => (
                        <Typography key={d} variant="caption" sx={{ color: DOMAIN_COLORS[d] || 'text.disabled', fontWeight: 500 }}>{d}</Typography>
                      ))}
                      {lbFilter === 'aligned' && entry.similarity > 0 && (
                        <Chip label={`${Math.round(entry.similarity * 100)}% match`} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(139,92,246,0.12)', color: '#A78BFA' }} />
                      )}
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                    {(entry.current_streak ?? 0) > 0 && (
                      <Tooltip title={`${tier.label} — ${entry.current_streak}d streak`}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                          <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 13 }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#F97316', fontSize: '0.7rem' }}>{entry.current_streak}</Typography>
                        </Box>
                      </Tooltip>
                    )}
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>{entry.praxis_points ?? 0}</Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>pts</Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </GlassCard>
    </Container>
  );
};

export default AnalyticsPage;
