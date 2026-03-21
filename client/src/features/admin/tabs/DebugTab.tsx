/**
 * Admin Debug Tab - System diagnostics and debugging tools
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, Card, CardContent,
  Alert, Chip, Stack, LinearProgress, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import SpeedIcon from '@mui/icons-material/Speed';
import SecurityIcon from '@mui/icons-material/Security';
import { apiFetch } from './adminTypes';

interface SystemHealth {
  database: { status: string; size: string; connections: number };
  api: { status: string; uptime: string; requestsPerMin: number };
  cache: { status: string; hitRate: number; size: string };
  queue: { status: string; pending: number; failed: number };
}

interface RecentError {
  timestamp: string;
  type: string;
  message: string;
  userId?: string;
  endpoint?: string;
}

const DebugTab: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await apiFetch('/admin/debug/health');
      if (res.ok) setHealth(await res.json());
    } catch (err) {
      console.error('Failed to fetch health:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchErrors = async () => {
    try {
      const res = await apiFetch('/admin/debug/errors?limit=20');
      if (res.ok) setRecentErrors(await res.json());
    } catch (err) {
      console.error('Failed to fetch errors:', err);
    }
  };

  const runDiagnostics = async () => {
    setTesting(true);
    setTestResults([]);
    
    const results: string[] = [];
    const tests = [
      { name: 'Database Connection', endpoint: '/admin/debug/test/db' },
      { name: 'Cache System', endpoint: '/admin/debug/test/cache' },
      { name: 'API Authentication', endpoint: '/admin/debug/test/auth' },
      { name: 'File Storage', endpoint: '/admin/debug/test/storage' },
      { name: 'Email Service', endpoint: '/admin/debug/test/email' },
    ];

    for (const test of tests) {
      try {
        const res = await apiFetch(test.endpoint);
        if (res.ok) {
          results.push(`✅ ${test.name}: OK`);
        } else {
          results.push(`❌ ${test.name}: FAILED`);
        }
      } catch (err: any) {
        results.push(`❌ ${test.name}: ${err.message || 'Error'}`);
      }
    }

    setTestResults(results);
    setTesting(false);
  };

  useEffect(() => {
    fetchHealth();
    fetchErrors();
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'healthy' || status === 'OK') return '#10B981';
    if (status === 'warning') return '#F59E0B';
    return '#EF4444';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <BugReportIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>System Diagnostics</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={loadingHealth ? <CircularProgress size={18} /> : <RefreshIcon />}
          onClick={fetchHealth}
          disabled={loadingHealth}
          sx={{ mr: 1 }}
        >
          Refresh
        </Button>
        <Button
          variant="contained"
          startIcon={testing ? <CircularProgress size={18} /> : <CheckCircleIcon />}
          onClick={runDiagnostics}
          disabled={testing}
        >
          Run Diagnostics
        </Button>
      </Box>

      {/* System Health Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {health && (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <StorageIcon sx={{ color: getStatusColor(health.database.status) }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Database</Typography>
                    <Chip label={health.database.status} size="small" sx={{ ml: 'auto', bgcolor: `${getStatusColor(health.database.status)}20`, color: getStatusColor(health.database.status) }} />
                  </Box>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Size:</Typography>
                      <Typography variant="body2">{health.database.size}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Connections:</Typography>
                      <Typography variant="body2">{health.database.connections}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <SpeedIcon sx={{ color: getStatusColor(health.api.status) }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>API</Typography>
                    <Chip label={health.api.status} size="small" sx={{ ml: 'auto', bgcolor: `${getStatusColor(health.api.status)}20`, color: getStatusColor(health.api.status) }} />
                  </Box>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Uptime:</Typography>
                      <Typography variant="body2">{health.api.uptime}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Requests/min:</Typography>
                      <Typography variant="body2">{health.api.requestsPerMin}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <SecurityIcon sx={{ color: getStatusColor(health.cache.status) }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Cache</Typography>
                    <Chip label={health.cache.status} size="small" sx={{ ml: 'auto', bgcolor: `${getStatusColor(health.cache.status)}20`, color: getStatusColor(health.cache.status) }} />
                  </Box>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Hit Rate:</Typography>
                      <Typography variant="body2">{health.cache.hitRate}%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Size:</Typography>
                      <Typography variant="body2">{health.cache.size}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <StorageIcon sx={{ color: getStatusColor(health.queue.status) }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Job Queue</Typography>
                    <Chip label={health.queue.status} size="small" sx={{ ml: 'auto', bgcolor: `${getStatusColor(health.queue.status)}20`, color: getStatusColor(health.queue.status) }} />
                  </Box>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Pending:</Typography>
                      <Typography variant="body2">{health.queue.pending}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Failed:</Typography>
                      <Typography variant="body2" color={health.queue.failed > 0 ? '#EF4444' : 'text.primary'}>{health.queue.failed}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {!health && !loadingHealth && (
          <Grid size={12}>
            <Alert severity="warning">Failed to load system health. Try refreshing.</Alert>
          </Grid>
        )}
      </Grid>

      {/* Diagnostic Test Results */}
      {testResults.length > 0 && (
        <Card sx={{ mb: 4, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Diagnostic Results</Typography>
            <Stack spacing={1}>
              {testResults.map((result, i) => (
                <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {result}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Recent Errors */}
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ErrorIcon sx={{ color: recentErrors.length > 0 ? '#EF4444' : 'text.secondary' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Recent Errors</Typography>
            <Chip label={recentErrors.length} size="small" sx={{ ml: 'auto' }} />
            <Button size="small" onClick={fetchErrors} sx={{ ml: 1 }}>
              <RefreshIcon fontSize="small" />
            </Button>
          </Box>

          {recentErrors.length === 0 ? (
            <Alert severity="success">No recent errors detected</Alert>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: 'rgba(0,0,0,0.2)', mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Endpoint</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentErrors.map((error, i) => (
                    <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                      <TableCell>{new Date(error.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip label={error.type} size="small" color="error" />
                      </TableCell>
                      <TableCell>{error.message}</TableCell>
                      <TableCell>{error.userId || '-'}</TableCell>
                      <TableCell>{error.endpoint || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DebugTab;
