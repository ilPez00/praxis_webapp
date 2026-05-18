import React, { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Grid, Chip, LinearProgress,
  Card, CardContent, Stack, Button, IconButton, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, CircularProgress, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import RouterIcon from '@mui/icons-material/Router';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CancelIcon from '@mui/icons-material/Cancel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LatticeDevice {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: 'online' | 'offline' | 'busy' | 'idle';
  last_seen: string | null;
  capabilities: string[];
  metadata: Record<string, unknown>;
  created_at: string;
}

interface LatticeJob {
  id: string;
  device_id: string;
  type: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  submitted_by: string;
  progress_pct: number;
  result: unknown;
  error_msg: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEVICE_ICON: Record<string, string> = {
  '3dprinter':  '⬡',
  'cnc_mill':   '⚙',
  'computer':   '▣',
  'smart_home': '⌂',
  'wearable':   '◉',
  'camera':     '◎',
  'server':     '▤',
  'custom':     '◈',
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
  online:    'success',
  busy:      'warning',
  idle:      'info',
  offline:   'default',
  pending:   'default',
  running:   'warning',
  done:      'success',
  failed:    'error',
  cancelled: 'default',
};

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done':      return <CheckCircleIcon fontSize="small" color="success" />;
    case 'failed':    return <ErrorIcon fontSize="small" color="error" />;
    case 'running':   return <PlayCircleIcon fontSize="small" color="warning" />;
    case 'cancelled': return <CancelIcon fontSize="small" color="disabled" />;
    default:          return <AccessTimeIcon fontSize="small" color="disabled" />;
  }
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const LatticePage: React.FC = () => {
  const { user } = useUser();
  const [devices, setDevices] = useState<LatticeDevice[]>([]);
  const [jobs, setJobs] = useState<LatticeJob[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<LatticeDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<LatticeDevice | null>(null);
  const [jobType, setJobType] = useState('');
  const [jobPayload, setJobPayload] = useState('{}');
  const [dispatching, setDispatching] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/lattice/devices');
      const devList: LatticeDevice[] = res.data.devices ?? [];
      setDevices(devList);
      if (!selectedDevice && devList.length > 0) {
        setSelectedDevice(devList[0]);
      }
    } catch {
      toast.error('Failed to load Lattice devices');
    } finally {
      setLoading(false);
    }
  }, [selectedDevice]);

  const fetchJobs = useCallback(async (deviceId?: string) => {
    const id = deviceId ?? selectedDevice?.id;
    if (!id) return;
    setJobsLoading(true);
    try {
      const res = await api.get('/lattice/jobs', { params: { device_id: id, limit: 30 } });
      setJobs(res.data.jobs ?? []);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setJobsLoading(false);
    }
  }, [selectedDevice]);

  useEffect(() => { fetchDevices(); }, []);
  useEffect(() => { if (selectedDevice) fetchJobs(selectedDevice.id); }, [selectedDevice]);

  const handleDispatch = async () => {
    if (!dispatchTarget || !jobType.trim()) return;
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(jobPayload); } catch { toast.error('Invalid JSON payload'); return; }
    setDispatching(true);
    try {
      await api.post('/lattice/jobs', {
        device_id:    dispatchTarget.id,
        type:         jobType.trim(),
        payload,
        submitted_by: 'user',
      });
      toast.success(`Job dispatched to ${dispatchTarget.name}`);
      setDispatchOpen(false);
      setJobType('');
      setJobPayload('{}');
      if (selectedDevice?.id === dispatchTarget.id) fetchJobs(dispatchTarget.id);
    } catch {
      toast.error('Dispatch failed');
    } finally {
      setDispatching(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await api.delete(`/lattice/jobs/${jobId}`);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled' } : j));
    } catch {
      toast.error('Cancel failed');
    }
  };

  if (!user) return null;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <RouterIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Lattice</Typography>
            <Typography variant="body2" color="text.secondary">
              Physical node network · {devices.length} device{devices.length !== 1 ? 's' : ''} registered
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={() => { fetchDevices(); if (selectedDevice) fetchJobs(selectedDevice.id); }}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      {loading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
      ) : devices.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>No nodes registered</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ fontFamily: 'monospace', mt: 1 }}>
            POST /api/lattice/devices/register with your device's api_key
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {/* Device strip */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              {devices.map(dev => (
                <Grid item xs={6} sm={4} md={3} lg={2} key={dev.id}>
                  <Card
                    onClick={() => setSelectedDevice(dev)}
                    sx={{
                      cursor: 'pointer',
                      border: selectedDevice?.id === dev.id ? '2px solid' : '1px solid',
                      borderColor: selectedDevice?.id === dev.id ? 'primary.main' : 'divider',
                      borderRadius: 2,
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: 'primary.main', boxShadow: 3 },
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Stack alignItems="center" gap={0.5}>
                        <Typography fontSize={28}>{DEVICE_ICON[dev.type] ?? '◈'}</Typography>
                        <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: '100%' }}>
                          {dev.name}
                        </Typography>
                        <Chip
                          label={dev.status}
                          size="small"
                          color={STATUS_COLOR[dev.status] ?? 'default'}
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                        {dev.last_seen && (
                          <Typography variant="caption" color="text.disabled">
                            {fmtTime(dev.last_seen)}
                          </Typography>
                        )}
                        <Button
                          size="small"
                          startIcon={<FlashOnIcon />}
                          onClick={(e) => { e.stopPropagation(); setDispatchTarget(dev); setDispatchOpen(true); }}
                          sx={{ mt: 0.5, fontSize: '0.7rem', minWidth: 0 }}
                          variant="outlined"
                        >
                          Dispatch
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Job feed */}
          {selectedDevice && (
            <Grid item xs={12}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                <Typography variant="h6" fontWeight={600}>
                  Jobs · {selectedDevice.name}
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  variant="contained"
                  onClick={() => { setDispatchTarget(selectedDevice); setDispatchOpen(true); }}
                >
                  Dispatch job
                </Button>
              </Stack>

              {jobsLoading ? (
                <LinearProgress sx={{ borderRadius: 1 }} />
              ) : jobs.length === 0 ? (
                <Typography color="text.secondary" variant="body2">No jobs yet.</Typography>
              ) : (
                <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' } }}>
                        <TableCell>Status</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Submitted by</TableCell>
                        <TableCell>Progress</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Completed</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {jobs.map(job => (
                        <TableRow key={job.id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" gap={0.5}>
                              <JobStatusIcon status={job.status} />
                              <Chip
                                label={job.status}
                                size="small"
                                color={STATUS_COLOR[job.status] ?? 'default'}
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                              {job.type}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={job.submitted_by}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 80 }}>
                            {job.status === 'running' ? (
                              <Stack direction="row" alignItems="center" gap={0.5}>
                                <LinearProgress
                                  variant="determinate"
                                  value={job.progress_pct}
                                  sx={{ flexGrow: 1, borderRadius: 1, height: 6 }}
                                />
                                <Typography variant="caption">{job.progress_pct}%</Typography>
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.disabled">
                                {job.status === 'done' ? '100%' : '—'}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {fmtTime(job.created_at)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {fmtTime(job.completed_at)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {job.status === 'pending' && (
                              <Tooltip title="Cancel">
                                <IconButton size="small" onClick={() => handleCancel(job.id)}>
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Grid>
          )}
        </Grid>
      )}

      {/* Dispatch dialog */}
      <Dialog open={dispatchOpen} onClose={() => setDispatchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Dispatch job → {dispatchTarget?.name ?? ''}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              label="Job type"
              value={jobType}
              onChange={e => setJobType(e.target.value)}
              placeholder="e.g. print_file, run_script, capture_photo"
              fullWidth
              size="small"
              inputProps={{ style: { fontFamily: 'monospace' } }}
            />
            <TextField
              label="Payload (JSON)"
              value={jobPayload}
              onChange={e => setJobPayload(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDispatchOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDispatch}
            variant="contained"
            disabled={!jobType.trim() || dispatching}
            startIcon={dispatching ? <CircularProgress size={14} /> : <FlashOnIcon />}
          >
            Dispatch
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LatticePage;
