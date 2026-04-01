import React, { useState, useEffect } from 'react';
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
  Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../../../lib/api';

interface MetricsData {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  payingUsers: number;
  mrr: number;
  checkinsThisPeriod: number;
  totalGoals: number;
  postsThisPeriod: number;
  achievementsThisPeriod: number;
  retentionCurve: { day: number; dau: number }[];
  topGoals: { name: string; count: number }[];
  generatedAt: string;
}

interface MetricsTabProps {
  metrics: MetricsData | null;
  loadingMetrics: boolean;
  fetchMetrics: () => Promise<void>;
}

const MetricsTab: React.FC<MetricsTabProps> = ({ metrics, loadingMetrics, fetchMetrics }) => {
  const handleExportCSV = () => {
    if (!metrics) return;
    
    const rows = [
      ['Metric', 'Value'],
      ['Total Users', metrics.totalUsers],
      ['Active Users (7d)', metrics.activeUsers7d],
      ['Active Users (30d)', metrics.activeUsers30d],
      ['Paying Users', metrics.payingUsers],
      ['MRR', metrics.mrr],
      ['Check-ins (30d)', metrics.checkinsThisPeriod],
      ['Total Goals', metrics.totalGoals],
      ['Posts (30d)', metrics.postsThisPeriod],
      ['Achievements (30d)', metrics.achievementsThisPeriod],
      ['Generated At', metrics.generatedAt],
    ];
    
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `praxis-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Acquisition Metrics</Typography>
          {metrics?.generatedAt && (
            <Chip 
              label={`Updated: ${new Date(metrics.generatedAt).toLocaleTimeString()}`} 
              size="small" 
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Export to CSV">
            <IconButton onClick={handleExportCSV} disabled={!metrics} sx={{ color: 'text.secondary' }}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh metrics">
            <IconButton onClick={fetchMetrics} disabled={loadingMetrics} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loadingMetrics ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : metrics ? (
        <Grid container spacing={3}>
          {/* Key Business Metrics */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
              Revenue & Growth
            </Typography>
          </Grid>
          
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid #22C55E22', background: 'linear-gradient(135deg, #22C55E0A 0%, transparent 100%)' }}>
              <CardContent sx={{ textAlign: 'center', py: '20px !important' }}>
                <Typography sx={{ fontSize: 28, mb: 0.5 }}>💰</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#22C55E', lineHeight: 1 }}>
                  ${metrics.mrr}
                </Typography>
                <Typography variant="caption" color="text.secondary">MRR</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid #A78BFA22', background: 'linear-gradient(135deg, #A78BFA0A 0%, transparent 100%)' }}>
              <CardContent sx={{ textAlign: 'center', py: '20px !important' }}>
                <Typography sx={{ fontSize: 28, mb: 0.5 }}>👑</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#A78BFA', lineHeight: 1 }}>
                  {metrics.payingUsers}
                </Typography>
                <Typography variant="caption" color="text.secondary">Paying Users</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid #60A5FA22', background: 'linear-gradient(135deg, #60A5FA0A 0%, transparent 100%)' }}>
              <CardContent sx={{ textAlign: 'center', py: '20px !important' }}>
                <Typography sx={{ fontSize: 28, mb: 0.5 }}>👥</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#60A5FA', lineHeight: 1 }}>
                  {metrics.totalUsers.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">Total Users</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid #F59E0B22', background: 'linear-gradient(135deg, #F59E0B0A 0%, transparent 100%)' }}>
              <CardContent sx={{ textAlign: 'center', py: '20px !important' }}>
                <Typography sx={{ fontSize: 28, mb: 0.5 }}>🔥</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>
                  {metrics.activeUsers7d.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">Active (7d)</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Engagement Metrics */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1, mt: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
              Engagement
            </Typography>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
              <CardContent sx={{ textAlign: 'center', py: '16px !important' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#34D399' }}>
                  {metrics.checkinsThisPeriod.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">Check-ins (30d)</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
              <CardContent sx={{ textAlign: 'center', py: '16px !important' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#34D399' }}>
                  {metrics.totalGoals.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">Total Goals</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
              <CardContent sx={{ textAlign: 'center', py: '16px !important' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#34D399' }}>
                  {metrics.postsThisPeriod.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">Posts (30d)</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
              <CardContent sx={{ textAlign: 'center', py: '16px !important' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#FBBF24' }}>
                  {metrics.achievementsThisPeriod.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">Achievements (30d)</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Goals */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Top Goals by Domain</Typography>
                {metrics.topGoals.length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {metrics.topGoals.map((goal, i) => (
                      <Box key={goal.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2">{goal.name}</Typography>
                        <Chip label={goal.count} size="small" sx={{ fontSize: '0.7rem' }} />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">No data yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Retention Curve */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Daily Active Users (Last 7 Days)</Typography>
                {metrics.retentionCurve.length > 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 100 }}>
                    {metrics.retentionCurve.map((d) => {
                      const max = Math.max(...metrics.retentionCurve.map(r => r.dau), 1);
                      const height = (d.dau / max) * 80;
                      return (
                        <Box key={d.day} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                            {d.dau}
                          </Typography>
                          <Box 
                            sx={{ 
                              width: '100%', 
                              height: height, 
                              bgcolor: 'primary.main', 
                              borderRadius: '4px 4px 0 0',
                              minHeight: 4,
                            }} 
                          />
                          <Typography variant="caption" color="text.disabled">D-{d.day}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">No data yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Valuation Summary */}
          <Grid size={{ xs: 12 }}>
            <Card sx={{ 
              borderRadius: 3, 
              border: '2px solid #F59E0B',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(139,92,246,0.05) 100%)',
            }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Quick Valuation Estimate</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary">Conservative (1x ARR)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#F59E0B' }}>
                      ${metrics.mrr * 12}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary">Growth (3x ARR)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#A78BFA' }}>
                      ${metrics.mrr * 12 * 3}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" color="text.secondary">Code Value (no revenue)</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#60A5FA' }}>
                      $50K-$150K
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <Typography variant="body2">Could not load metrics.</Typography>
          <Button onClick={fetchMetrics} sx={{ mt: 2 }}>Retry</Button>
        </Box>
      )}
    </>
  );
};

export const useMetrics = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/metrics');
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return { metrics, loadingMetrics: loading, fetchMetrics };
};

export default MetricsTab;
