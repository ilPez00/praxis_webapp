import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { AdminStats } from './adminTypes';

interface StatsTabProps {
  stats: AdminStats | null;
  loadingStats: boolean;
  fetchStats: () => Promise<void>;
}

const StatsTab: React.FC<StatsTabProps> = ({ stats, loadingStats, fetchStats }) => {
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Platform Stats</Typography>
        <Tooltip title="Refresh stats">
          <IconButton onClick={fetchStats} disabled={loadingStats} sx={{ color: 'text.secondary' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loadingStats ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : stats ? (
        <Grid container spacing={2}>
          {[
            { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: '👥', color: '#60A5FA' },
            { label: 'Goal Trees', value: stats.totalGoalTrees.toLocaleString(), icon: '🌳', color: '#34D399' },
            { label: 'Total Points', value: stats.totalPoints.toLocaleString(), icon: '⚡', color: '#FBBF24' },
            { label: 'Avg Streak', value: `${stats.avgStreak}d`, icon: '🔥', color: '#F87171' },
            { label: 'Pro Users', value: stats.premiumCount.toLocaleString(), icon: '👑', color: '#A78BFA' },
            { label: 'Active Today', value: stats.activeToday.toLocaleString(), icon: '✅', color: '#6EE7B7' },
            { label: 'Challenges', value: stats.totalChallenges.toLocaleString(), icon: '🏆', color: '#FCD34D' },
          ].map(s => (
            <Grid key={s.label} size={{ xs: 6, sm: 4, md: 3 }}>
              <Card sx={{ borderRadius: 3, border: `1px solid ${s.color}22`, background: `linear-gradient(135deg, ${s.color}0A 0%, transparent 100%)` }}>
                <CardContent sx={{ textAlign: 'center', py: '20px !important' }}>
                  <Typography sx={{ fontSize: 28, mb: 0.5 }}>{s.icon}</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{s.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <Typography variant="body2">Could not load stats.</Typography>
          <Button onClick={fetchStats} sx={{ mt: 2 }}>Retry</Button>
        </Box>
      )}
    </>
  );
};

export default StatsTab;
