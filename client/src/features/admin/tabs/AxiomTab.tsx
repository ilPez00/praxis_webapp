import React, { useState, useEffect, useCallback } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Box, Typography, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Chip, Avatar, TextField, Select, MenuItem, FormControl, InputLabel,
  Grid, Stack, List, ListItem, ListItemText,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { AdminUser } from './adminTypes';

// ── Types ────────────────────────────────────────────────────────────────────

interface SystemConfig {
  key: string;
  value: string;
  updated_at: string;
  updated_by?: string;
}

interface AxiomTabProps {
  users: AdminUser[];
}

// ── Component ────────────────────────────────────────────────────────────────

const AxiomTab: React.FC<AxiomTabProps> = ({ users }) => {
  // State
  const [axiomPrompt, setAxiomPrompt] = useState('');
  const [axiomStrategy, setAxiomStrategy] = useState<'first' | 'last' | 'random'>('first');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [updatingStrategy, setUpdatingStrategy] = useState(false);
  const [triggeringScan, setTriggeringScan] = useState(false);
  const [generatingBriefs, setGeneratingBriefs] = useState(false);
  const [generateResult, setGenerateResult] = useState<any>(null);
  const [forcePushUserId, setForcePushUserId] = useState('');
  const [forcePushing, setForcePushing] = useState(false);
  const [axiomStats, setAxiomStats] = useState<any>(null);
  const [loadingAxiomStats, setLoadingAxiomStats] = useState(false);
  const [keyUsage, setKeyUsage] = useState<any[]>([]);
  const [loadingKeyUsage, setLoadingKeyUsage] = useState(false);

  // Handlers
  const fetchAxiomPrompt = useCallback(async () => {
    try {
      const res = await api.get('/admin/config');
      const configs: SystemConfig[] = res.data;

      const prompt = configs.find(c => c.key === 'axiom_prompt');
      if (prompt) setAxiomPrompt(prompt.value);

      const strategy = configs.find(c => c.key === 'axiom_key_strategy');
      if (strategy) setAxiomStrategy(strategy.value as any);
    } catch {
      toast.error('Failed to fetch Axiom settings.');
    }
  }, []);

  const fetchAxiomStats = useCallback(async () => {
    setLoadingAxiomStats(true);
    try {
      const res = await api.get('/admin/axiom/stats');
      setAxiomStats(res.data);
    } catch (err) {
      console.error('Failed to fetch Axiom stats:', err);
    } finally {
      setLoadingAxiomStats(false);
    }
  }, []);

  const fetchKeyUsage = useCallback(async () => {
    setLoadingKeyUsage(true);
    try {
      const res = await api.get('/admin/axiom/key-usage');
      setKeyUsage(res.data?.keys || []);
    } catch (err) {
      console.error('Failed to fetch key usage:', err);
    } finally {
      setLoadingKeyUsage(false);
    }
  }, []);

  const handleUpdateStrategy = async (newStrategy: 'first' | 'last' | 'random') => {
    setUpdatingStrategy(true);
    try {
      await api.put('/admin/config/axiom_key_strategy', { value: newStrategy });
      setAxiomStrategy(newStrategy);
      toast.success(`Strategy set to ${newStrategy}`);
    } catch {
      toast.error('Failed to update strategy.');
    } finally {
      setUpdatingStrategy(false);
    }
  };

  const handleUpdatePrompt = async () => {
    setSavingPrompt(true);
    try {
      await api.put('/admin/config/axiom_prompt', { value: axiomPrompt });
      toast.success('Axiom prompt updated!');
    } catch {
      toast.error('Failed to update prompt.');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleTriggerScan = async () => {
    if (!window.confirm('Trigger global midnight scan now? This will generate daily recommendations for all active users.')) return;
    setTriggeringScan(true);
    try {
      await api.post('/admin/axiom/trigger-scan');
      toast.success('Axiom scan triggered in background. Check logs for progress.');
    } catch {
      toast.error('Failed to trigger scan.');
    } finally {
      setTriggeringScan(false);
    }
  };

  const handleGenerateAllBriefs = async () => {
    if (!window.confirm('Generate LLM-powered Axiom briefs for ALL active users? This will take 1-2 minutes.')) return;
    setGeneratingBriefs(true);
    setGenerateResult(null);
    try {
      const res = await api.post('/admin/axiom/generate-all-briefs');
      const data = res.data;
      setGenerateResult(data);
      if (data.llm_briefs > 0) {
        toast.success(`Generated ${data.generated} briefs (${data.llm_briefs} via LLM)!`);
      } else {
        toast(`Generated ${data.generated} briefs (all algorithm fallback)`, { icon: '⚠️' });
      }
    } catch (err: any) {
      toast.error('Failed to generate briefs: ' + (err.message || 'Unknown error'));
    } finally {
      setGeneratingBriefs(false);
    }
  };

  const handleForcePush = async (targetUserId?: string) => {
    const isAll = !targetUserId;
    if (isAll && !window.confirm('Force-push Axiom briefs to ALL active users? This will overwrite today\'s briefs.')) return;
    setForcePushing(true);
    try {
      const res = await api.post('/admin/axiom/force-push', targetUserId ? { userId: targetUserId } : {});
      const data = res.data;
      if (data.source === 'algorithm' && data.llm_error) {
        toast.error(`LLM FAILED: ${data.llm_error}\nBrief was generated using algorithm fallback.`, { duration: 8000 });
      } else if (data.source === 'llm') {
        toast.success(`${data.message} ✨`, { duration: 5000 });
      } else {
        toast.success(data.message || 'Brief generated!');
      }
      fetchAxiomStats();
    } catch {
      toast.error('Failed to force-push brief.');
    } finally {
      setForcePushing(false);
      setForcePushUserId('');
    }
  };

  // Mount
  useEffect(() => {
    fetchAxiomPrompt();
    fetchAxiomStats();
    fetchKeyUsage();
  }, [fetchAxiomPrompt, fetchAxiomStats, fetchKeyUsage]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <AutoAwesomeIcon /> Axiom Engine Management
      </Typography>

      {/* Axiom Usage Statistics */}
      {loadingAxiomStats ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : axiomStats ? (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Summary Cards */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(245,158,11,0.8)', fontWeight: 700, display: 'block', mb: 1 }}>
                  TOTAL BRIEFS
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 900, color: '#F59E0B' }}>
                  {axiomStats.summary.total_briefs.toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>All time</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(139,92,246,0.8)', fontWeight: 700, display: 'block', mb: 1 }}>
                  THIS WEEK
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 900, color: '#A78BFA' }}>
                  {axiomStats.summary.week_briefs.toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Last 7 days</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ bgcolor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(16,185,129,0.8)', fontWeight: 700, display: 'block', mb: 1 }}>
                  THIS MONTH
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 900, color: '#10B981' }}>
                  {axiomStats.summary.month_briefs.toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Last 30 days</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ bgcolor: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" sx={{ color: 'rgba(236,72,153,0.8)', fontWeight: 700, display: 'block', mb: 1 }}>
                  TODAY
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 900, color: '#EC4899' }}>
                  {axiomStats.summary.today_briefs.toLocaleString()}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Generated today</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Users Table */}
          <Grid size={{ xs: 12 }}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEventsIcon sx={{ color: '#F59E0B' }} /> Top Axiom Users
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Rank</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>User</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Streak</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Points</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700, align: 'right' }}>Briefs Generated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {axiomStats.top_users.map((user: any, index: number) => (
                        <TableRow key={user.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {index === 0 && '🥇'}
                              {index === 1 && '🥈'}
                              {index === 2 && '🥉'}
                              {index > 2 && `#${index + 1}`}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                {user.name?.charAt(0) || 'U'}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontWeight: 600 }}>{user.name || 'Unknown'}</Typography>
                                <Typography variant="caption" color="text.secondary">{user.email || ''}</Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {user.is_premium && (
                              <Chip label="Premium" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.2)', color: '#F59E0B', height: 24 }} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocalFireDepartmentIcon sx={{ fontSize: 16, color: '#F59E0B' }} />
                              {user.current_streak || 0}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600, color: '#A78BFA' }}>
                              {user.praxis_points?.toLocaleString() || 0}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={user.brief_count.toLocaleString()}
                              size="small"
                              sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#A78BFA', fontWeight: 700 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Briefs */}
          <Grid size={{ xs: 12 }}>
            <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Recent Brief Generation (Last 24h)
                </Typography>
                <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                  {axiomStats.recent_briefs.length > 0 ? (
                    <List dense>
                      {axiomStats.recent_briefs.map((brief: any) => {
                        const briefData = typeof brief.brief === 'string' ? JSON.parse(brief.brief) : (brief.brief || {});
                        const src = briefData.source || 'unknown';
                        const isLLM = src === 'llm';
                        const hasError = !!briefData.llm_error;
                        return (
                          <ListItem key={brief.id} sx={{ py: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <ListItemText
                              primary={
                                <Typography sx={{ fontWeight: 600 }}>
                                  {brief.profiles?.name || 'Unknown User'}
                                </Typography>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="caption" color="text.secondary">
                                    Date: {brief.date} • Generated: {new Date(brief.generated_at).toLocaleString()}
                                  </Typography>
                                  {hasError && (
                                    <Typography variant="caption" sx={{ display: 'block', color: '#EF4444', mt: 0.25 }}>
                                      LLM Error: {briefData.llm_error}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                            <Chip
                              label={isLLM ? '🧠 Axiom' : '⚙️ Algorithm'}
                              size="small"
                              sx={{
                                bgcolor: isLLM ? 'rgba(167,139,250,0.2)' : 'rgba(245,158,11,0.2)',
                                color: isLLM ? '#A78BFA' : '#F59E0B',
                                fontWeight: 700,
                                border: `1px solid ${isLLM ? 'rgba(167,139,250,0.3)' : 'rgba(245,158,11,0.3)'}`,
                              }}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No briefs generated in the last 24 hours
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : null}

      <Grid container spacing={4}>
        {/* System Prompt */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>System Identity & Prompt</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                This prompt defines Axiom's personality, knowledge, and tone. It is injected into every coaching request.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={10}
                value={axiomPrompt}
                onChange={(e) => setAxiomPrompt(e.target.value)}
                placeholder="Enter Axiom's system prompt..."
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)', fontFamily: 'monospace', fontSize: '0.85rem' }
                }}
              />
              <Button
                variant="contained"
                onClick={handleUpdatePrompt}
                disabled={savingPrompt || !axiomPrompt.trim()}
                sx={{ borderRadius: '10px', fontWeight: 800, px: 4 }}
              >
                {savingPrompt ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : 'Save Prompt'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Key Pool Strategy */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>API Key Pool Strategy</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Choose where Axiom starts looking for an available Gemini key in your .env pool.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant={axiomStrategy === 'first' ? 'contained' : 'outlined'}
                  onClick={() => handleUpdateStrategy('first')}
                  disabled={updatingStrategy}
                  sx={{ borderRadius: '10px', fontWeight: 700 }}
                >
                  Start from First
                </Button>
                <Button
                  variant={axiomStrategy === 'last' ? 'contained' : 'outlined'}
                  onClick={() => handleUpdateStrategy('last')}
                  disabled={updatingStrategy}
                  sx={{ borderRadius: '10px', fontWeight: 700 }}
                >
                  Start from Last
                </Button>
                <Button
                  variant={axiomStrategy === 'random' ? 'contained' : 'outlined'}
                  onClick={() => handleUpdateStrategy('random')}
                  disabled={updatingStrategy}
                  sx={{ borderRadius: '10px', fontWeight: 700 }}
                >
                  Balanced (Random)
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* API Key Usage */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon sx={{ color: '#A78BFA' }} /> API Key Usage
                </Typography>
                <Button size="small" onClick={fetchKeyUsage} disabled={loadingKeyUsage} startIcon={<RefreshIcon />}>
                  Refresh
                </Button>
              </Box>
              {loadingKeyUsage ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : keyUsage.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No key usage recorded yet.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Key</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Provider</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700, align: 'right' }}>Requests</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700, align: 'right' }}>Errors</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700, align: 'right' }}>Input Tokens</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700, align: 'right' }}>Output Tokens</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Last Used</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {keyUsage.map((k, idx) => {
                        const errorRate = k.requests > 0 ? (k.errors / k.requests * 100) : 0;
                        return (
                          <TableRow key={idx} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                {k.key_hash}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={k.provider}
                                size="small"
                                sx={{
                                  bgcolor: k.provider === 'gemini' ? 'rgba(59,130,246,0.15)' : k.provider === 'deepseek' ? 'rgba(236,72,153,0.15)' : 'rgba(34,197,94,0.15)',
                                  color: k.provider === 'gemini' ? '#60A5FA' : k.provider === 'deepseek' ? '#F472B6' : '#4ADE80',
                                  fontWeight: 600,
                                  textTransform: 'capitalize',
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography sx={{ fontWeight: 700, color: '#A78BFA' }}>{k.requests.toLocaleString()}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography sx={{ fontWeight: 600, color: errorRate > 10 ? '#EF4444' : errorRate > 0 ? '#F59E0B' : 'text.secondary' }}>
                                {k.errors.toLocaleString()} {errorRate > 0 && `(${errorRate.toFixed(1)}%)`}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">{k.input_tokens.toLocaleString()}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">{k.output_tokens.toLocaleString()}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {k.last_used ? new Date(k.last_used).toLocaleString() : '—'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Manual Triggers */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>🌙 Midnight Scan Trigger</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Manually initiate the midnight automated scan. This will process all active users, analyze their activity,
                and generate new LLM-powered daily protocols with Gemini AI. Runs automatically at midnight UTC.
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleTriggerScan}
                disabled={triggeringScan}
                startIcon={<RefreshIcon />}
                sx={{ borderRadius: '10px', fontWeight: 800, border: '2px solid' }}
              >
                {triggeringScan ? 'Triggering...' : 'Trigger Midnight Scan Now'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Generate All Briefs */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ bgcolor: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon sx={{ color: '#A78BFA' }} /> Generate All Briefs (Synchronous)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Immediately generate LLM-powered Axiom briefs for ALL active users. Waits for completion and shows results.
                Uses Gemini 2.5 Flash for highest quality. Takes ~1-2 minutes for all users.
              </Typography>
              <Button
                variant="contained"
                onClick={handleGenerateAllBriefs}
                disabled={generatingBriefs}
                startIcon={generatingBriefs ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
                sx={{
                  borderRadius: '12px', fontWeight: 800, px: 4,
                  background: 'linear-gradient(135deg, #A78BFA, #8B5CF6)',
                  '&:hover': { background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' },
                }}
              >
                {generatingBriefs ? 'Generating...' : 'Generate All Briefs Now'}
              </Button>
              {generateResult && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Result:</strong> {generateResult.message}
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                    <Chip label={`Total: ${generateResult.total_users}`} size="small" />
                    <Chip label={`Generated: ${generateResult.generated}`} size="small" color="success" />
                    <Chip label={`LLM: ${generateResult.llm_briefs}`} size="small" sx={{ bgcolor: 'rgba(167,139,250,0.2)', color: '#A78BFA' }} />
                    <Chip label={`Algorithm: ${generateResult.algorithm_briefs}`} size="small" />
                    <Chip label={`Failed: ${generateResult.failed}`} size="small" color="error" />
                    <Chip label={`Duration: ${generateResult.duration_seconds}s`} size="small" />
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Force Push Brief */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ bgcolor: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon sx={{ color: '#A78BFA' }} /> Force Push Axiom Brief
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Generate and push a fresh Axiom daily brief immediately. Pick a specific user or push to everyone.
                The brief includes message, routine, challenge, resources, match, event, and place — the full protocol.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
                {/* User selector — pick from loaded users list */}
                <FormControl sx={{ minWidth: 280 }} size="small">
                  <InputLabel>Target User (leave empty for all)</InputLabel>
                  <Select
                    value={forcePushUserId}
                    onChange={(e) => setForcePushUserId(e.target.value)}
                    label="Target User (leave empty for all)"
                    disabled={forcePushing}
                  >
                    <MenuItem value="">
                      <em>All active users</em>
                    </MenuItem>
                    {users.map(u => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.name || u.email || u.id.slice(0, 8)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  onClick={() => handleForcePush(forcePushUserId || undefined)}
                  disabled={forcePushing}
                  startIcon={forcePushing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                  sx={{
                    borderRadius: '10px', fontWeight: 800, px: 4,
                    background: 'linear-gradient(135deg, #A78BFA, #F59E0B)',
                    '&:hover': { background: 'linear-gradient(135deg, #8B5CF6, #D97706)' },
                  }}
                >
                  {forcePushing
                    ? 'Generating...'
                    : forcePushUserId
                      ? 'Push Brief to User'
                      : 'Push Briefs to All Users'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AxiomTab;
