import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';
import GlassCard from '../../components/common/GlassCard';
import {
  Container, Box, Typography, Button, Stack, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Slider, CircularProgress, Divider,
  LinearProgress, Avatar, Tooltip,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TimerIcon from '@mui/icons-material/Timer';
import CancelIcon from '@mui/icons-material/Cancel';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import ShareIcon from '@mui/icons-material/Share';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import EuroIcon from '@mui/icons-material/Euro';
import { GoalNode } from '../../models/GoalNode';
import ErrorBoundary from '../../components/common/ErrorBoundary';

interface Bet {
  id: string;
  user_id: string;
  goal_node_id: string;
  goal_name: string;
  deadline: string;
  stake_points: number;
  stake_euros?: number;
  is_real_money?: boolean;
  status: 'pending' | 'active' | 'won' | 'lost' | 'cancelled';
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',    color: '#F59E0B', icon: <TimerIcon fontSize="small" /> },
  active:    { label: 'Active',     color: '#3B82F6', icon: <TimerIcon fontSize="small" /> },
  won:       { label: 'Fulfilled',  color: '#10B981', icon: <EmojiEventsIcon fontSize="small" /> },
  lost:      { label: 'Missed',     color: '#EF4444', icon: <HighlightOffIcon fontSize="small" /> },
  cancelled: { label: 'Cancelled',  color: '#6B7280', icon: <CancelIcon fontSize="small" /> },
};

function daysUntil(deadline: string): number {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

const MIN_STAKE = 50;
const MAX_STAKE = 2000;

const BettingPage: React.FC = () => {
  const { user } = useUser();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [bets, setBets] = useState<Bet[]>([]);
  const [goalNodes, setGoalNodes] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New bet form state
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [stake, setStake] = useState(100);

  // Real money bet state
  const [realDialogOpen, setRealDialogOpen] = useState(false);
  const [stakeEuros, setStakeEuros] = useState(10);
  const [creatingReal, setCreatingReal] = useState(false);

  // Duel state
  const [duelDialogOpen, setDuelDialogOpen] = useState(false);
  const [opponentType, setOpponentType] = useState<'random' | 'specific'>('random');
  const [selectedOpponentId, setSelectedOpponentId] = useState('');
  const [creatingDuel, setCreatingDuel] = useState(false);
  const [duelInviteCode, setDuelInviteCode] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setCurrentUserId(u?.id));
    // Handle return from Stripe for real-money bet
    const params = new URLSearchParams(window.location.search);
    if (params.get('bet_placed') === 'real') {
      toast.success('Payment confirmed! Your real-money commitment is now active.');
      window.history.replaceState({}, '', '/commitments');
    } else if (params.get('bet_cancelled') === '1') {
      toast.error('Payment cancelled — commitment not created.');
      window.history.replaceState({}, '', '/commitments');
    }
  }, []);

  const fetchBets = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await api.get(`/bets/${currentUserId}`);
      setBets(Array.isArray(res.data) ? res.data : []);
    } catch {
      setBets([]);
    }
  }, [currentUserId]);

  const fetchGoalNodes = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await api.get(`/goals/${currentUserId}`);
      const tree = res.data;
      const nodes: GoalNode[] = Array.isArray(tree?.nodes) ? tree.nodes : [];
      setGoalNodes(nodes.filter(n => n.progress < 1));
    } catch {
      setGoalNodes([]);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    Promise.all([fetchBets(), fetchGoalNodes()]).finally(() => setLoading(false));
  }, [currentUserId, fetchBets, fetchGoalNodes]);

  const handleCreate = async () => {
    if (!currentUserId || !selectedNodeId || !deadline) {
      toast.error('Select a goal and deadline.');
      return;
    }
    const node = goalNodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    setCreating(true);
    try {
      await api.post('/bets', {
        goalNodeId: selectedNodeId,
        goalName: node.name,
        deadline,
        stakePoints: stake,
      });
      toast.success(`Commitment made! ${stake} PP pledged on "${node.name}"`);

      // Auto-post public accountability message to the feed
      try {
        await api.post('/posts', {
          userName: user?.name || 'A Praxis member',
          userAvatarUrl: (user as any)?.avatar_url || null,
          content: `🎯 I just pledged ${stake} PP on completing my goal: "${node.name}" by ${new Date(deadline).toLocaleDateString()}. Hold me accountable! 💪`,
          context: 'general',
        });
      } catch { /* non-critical */ }

      setDialogOpen(false);
      setSelectedNodeId('');
      setDeadline('');
      setStake(100);
      await fetchBets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to place bet.');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (betId: string) => {
    if (!currentUserId) return;
    try {
      await api.delete(`/bets/${betId}`);
      toast.success('Pledge cancelled. 90% of stake refunded (10% house fee).');
      await fetchBets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel bet.');
    }
  };

  const handleRealCreate = async () => {
    if (!currentUserId || !selectedNodeId || !deadline) {
      toast.error('Select a goal and deadline.');
      return;
    }
    const node = goalNodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    setCreatingReal(true);
    try {
      const res = await api.post('/bets/real/checkout', {
        goalNodeId: selectedNodeId,
        goalName: node.name,
        deadline,
        stakeEuros,
      });
      // Redirect to Stripe Checkout
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment.');
      setCreatingReal(false);
    }
  };

  const points = user?.praxis_points ?? 0;
  const activeBets = bets.filter(b => b.status === 'active' || b.status === 'pending');
  const historyBets = bets.filter(b => b.status !== 'active' && b.status !== 'pending');
  const totalStaked = activeBets.reduce((s, b) => s + b.stake_points, 0);
  const totalWon = bets.filter(b => b.status === 'won').reduce((s, b) => s + Math.round(b.stake_points * 1.8), 0);

  const minDeadline = new Date();
  minDeadline.setDate(minDeadline.getDate() + 1);
  const minDeadlineStr = minDeadline.toISOString().slice(0, 10);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 8 }}>
      <Container maxWidth="lg" sx={{ pt: 4 }}>

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>Commitments</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Put your Praxis Points behind a goal. Fulfill it → 2× reward. Miss it → forfeit.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={points < MIN_STAKE || goalNodes.length === 0}
            sx={{ borderRadius: '12px', fontWeight: 700, px: 3 }}
          >
            Solo Pledge
          </Button>
          <Button
            variant="outlined"
            startIcon={<EuroIcon />}
            onClick={() => setRealDialogOpen(true)}
            disabled={goalNodes.length === 0}
            sx={{ borderRadius: '12px', fontWeight: 700, px: 3, borderColor: '#10B981', color: '#10B981' }}
          >
            Real Stakes (€)
          </Button>
          <Button
            variant="outlined"
            startIcon={<GroupAddIcon />}
            onClick={() => setDuelDialogOpen(true)}
            disabled={points < MIN_STAKE * 1.8 || goalNodes.length === 0}
            sx={{ borderRadius: '12px', fontWeight: 700, px: 3, borderColor: '#F59E0B', color: '#F59E0B' }}
          >
            Challenge Friend
          </Button>
        </Box>

        {/* Stats row */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { label: 'Available PP', value: points.toLocaleString(), color: '#A78BFA', icon: <ElectricBoltIcon /> },
            { label: 'Staked PP', value: totalStaked.toLocaleString(), color: '#3B82F6', icon: <TimerIcon /> },
            { label: 'Active Pledges', value: activeBets.length, color: '#F59E0B', icon: <LocalFireDepartmentIcon /> },
            { label: 'PP Won (all-time)', value: totalWon.toLocaleString(), color: '#10B981', icon: <EmojiEventsIcon /> },
          ].map(stat => (
            <Grid key={stat.label} size={{ xs: 6, md: 3 }}>
              <GlassCard sx={{ p: 2.5, textAlign: 'center' }}>
                <Box sx={{ color: stat.color, mb: 0.5 }}>{stat.icon}</Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: stat.color }}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
              </GlassCard>
            </Grid>
          ))}
        </Grid>

        {/* Active Bets */}
        <ErrorBoundary label="Active Pledges">
        <GlassCard sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Active Pledges ({activeBets.length})
          </Typography>
          {activeBets.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <TimerIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No active pledges. Commit some PP to a goal to get started.</Typography>
              {points < MIN_STAKE && (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  You need at least {MIN_STAKE} PP to make a pledge. Keep checking in!
                </Typography>
              )}
            </Box>
          ) : (
            <Stack spacing={2}>
              {activeBets.map(bet => {
                const days = daysUntil(bet.deadline);
                const progress = goalNodes.find(n => n.id === bet.goal_node_id)?.progress ?? 0;
                const urgent = days <= 2;
                return (
                  <Box
                    key={bet.id}
                    sx={{
                      p: 2,
                      borderRadius: '12px',
                      bgcolor: urgent ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${urgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0, mr: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>{bet.goal_name}</Typography>
                          {bet.is_real_money && (
                            <Chip label="REAL €" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.4)', fontWeight: 800, fontSize: '0.6rem', height: 18 }} />
                          )}
                          {bet.status === 'pending' && (
                            <Chip label="PENDING PAYMENT" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.4)', fontWeight: 800, fontSize: '0.6rem', height: 18 }} />
                          )}
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                          {bet.is_real_money ? (
                            <Chip
                              icon={<EuroIcon />}
                              label={`€${Number(bet.stake_euros ?? 0).toFixed(2)} staked`}
                              size="small"
                              sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', fontWeight: 700, fontSize: '0.7rem' }}
                            />
                          ) : (
                            <Chip
                              icon={<ElectricBoltIcon />}
                              label={`${bet.stake_points} PP pledged`}
                              size="small"
                              sx={{ bgcolor: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)', fontWeight: 700, fontSize: '0.7rem' }}
                            />
                          )}
                          <Chip
                            icon={<TimerIcon />}
                            label={days > 0 ? `${days}d left` : 'Overdue'}
                            size="small"
                            sx={{ bgcolor: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: urgent ? '#EF4444' : '#3B82F6', border: `1px solid ${urgent ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)'}`, fontWeight: 700, fontSize: '0.7rem' }}
                          />
                          {!bet.is_real_money && (
                            <Chip
                              icon={<EmojiEventsIcon />}
                              label={`Win: ${Math.round(bet.stake_points * 1.8)} PP`}
                              size="small"
                              sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', fontWeight: 700, fontSize: '0.7rem' }}
                            />
                          )}
                          {bet.is_real_money && bet.status === 'active' && (
                            <Chip
                              icon={<EmojiEventsIcon />}
                              label={`Win: refund + ${Math.round(Number(bet.stake_euros ?? 0) * 50)} PP`}
                              size="small"
                              sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', fontWeight: 700, fontSize: '0.7rem' }}
                            />
                          )}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                        <Tooltip title="Challenge a friend — share this stake">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ShareIcon sx={{ fontSize: '14px !important' }} />}
                            onClick={() => {
                              const deadlineStr = new Date(bet.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                              const text = `I just pledged ${bet.stake_points} PP that I'll "${bet.goal_name}" by ${deadlineStr}. Think you can beat me? Join Praxis → https://praxis-app.vercel.app`;
                              if (navigator.share) {
                                navigator.share({ title: 'I made a Praxis commitment', text }).catch(() => {});
                              } else {
                                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                              }
                            }}
                            sx={{ borderRadius: '8px', color: '#A78BFA', borderColor: 'rgba(167,139,250,0.4)', fontSize: '0.72rem' }}
                          >
                            Challenge
                          </Button>
                        </Tooltip>
                        <Tooltip title="Cancel bet (refunds 90% — 10% house fee)">
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => handleCancel(bet.id)}
                            sx={{ borderRadius: '8px' }}
                          >
                            Cancel
                          </Button>
                        </Tooltip>
                      </Stack>
                    </Box>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Goal progress</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>{Math.round(progress * 100)}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.round(progress * 100)}
                        sx={{
                          height: 6, borderRadius: 3,
                          bgcolor: 'rgba(255,255,255,0.05)',
                          '& .MuiLinearProgress-bar': { bgcolor: progress >= 1 ? '#10B981' : '#3B82F6' },
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </GlassCard>
        </ErrorBoundary>

        {/* Bet history */}
        {historyBets.length > 0 && (
          <ErrorBoundary label="Bet History">
          <GlassCard sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>History</Typography>
            <Stack spacing={1.5}>
              {historyBets.map(bet => {
                const meta = STATUS_META[bet.status];
                return (
                  <Box
                    key={bet.id}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
                      borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <Avatar sx={{ width: 32, height: 32, bgcolor: `${meta.color}18`, color: meta.color }}>
                      {meta.icon}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{bet.goal_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(bet.deadline).toLocaleDateString()} · {bet.stake_points} PP staked
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{ bgcolor: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}44`, fontWeight: 700, fontSize: '0.65rem' }}
                      />
                      {bet.status === 'won' && !bet.is_real_money && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#10B981', fontWeight: 700, mt: 0.25 }}>
                          +{Math.round(bet.stake_points * 1.8)} PP
                        </Typography>
                      )}
                      {bet.status === 'won' && bet.is_real_money && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#10B981', fontWeight: 700, mt: 0.25 }}>
                          Refunded + {Math.round(Number(bet.stake_euros ?? 0) * 50)} PP
                        </Typography>
                      )}
                      {bet.status === 'lost' && bet.is_real_money && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#6B7280', mt: 0.25 }}>
                          €{Number(bet.stake_euros ?? 0).toFixed(2)} → charity
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </GlassCard>
          </ErrorBoundary>
        )}
      </Container>

      {/* Real money bet dialog */}
      <Dialog open={realDialogOpen} onClose={() => !creatingReal && setRealDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EuroIcon sx={{ color: '#10B981' }} />
            Real-Money Commitment
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400, display: 'block', mt: 0.5 }}>
            Put real € behind your goal. Win → full refund + PP bonus. Miss → funds donated to charity.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              select
              fullWidth
              label="Goal to commit to"
              value={selectedNodeId}
              onChange={e => setSelectedNodeId(e.target.value)}
              helperText="Only incomplete goals are eligible"
            >
              {goalNodes.length === 0
                ? <MenuItem value="" disabled>No incomplete goals found</MenuItem>
                : goalNodes.map(n => (
                    <MenuItem key={n.id} value={n.id}>
                      {n.name} ({Math.round((n.progress ?? 0) * 100)}% done)
                    </MenuItem>
                  ))
              }
            </TextField>

            <TextField
              fullWidth
              label="Deadline"
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              inputProps={{ min: minDeadlineStr }}
              InputLabelProps={{ shrink: true }}
              helperText="If goal isn't peer-verified by this date, your stake goes to charity"
            />

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Stake amount</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#10B981' }}>
                  €{stakeEuros.toFixed(2)}
                </Typography>
              </Box>
              <Slider
                value={stakeEuros}
                onChange={(_, v) => setStakeEuros(v as number)}
                min={1}
                max={100}
                step={1}
                marks={[
                  { value: 1, label: '€1' },
                  { value: 25, label: '€25' },
                  { value: 50, label: '€50' },
                  { value: 100, label: '€100' },
                ]}
                sx={{ color: '#10B981' }}
              />
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">If you win (peer-verified):</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#10B981' }}>
                  €{(stakeEuros * 0.92).toFixed(2)} refunded + {stakeEuros * 50} PP
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">If you miss the deadline:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#EF4444' }}>
                  €{stakeEuros.toFixed(2)} donated to charity
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Platform fee (on win):</Typography>
                <Typography variant="body2" color="text.secondary">
                  €{(stakeEuros * 0.08).toFixed(2)} (8%)
                </Typography>
              </Box>
              <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <Typography variant="caption" color="text.secondary">
                  Payment processed via Stripe. Funds held in escrow until deadline. This is a personal commitment device, not gambling. EU consumer rights apply.
                </Typography>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setRealDialogOpen(false)} disabled={creatingReal} sx={{ borderRadius: '10px' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRealCreate}
            disabled={creatingReal || !selectedNodeId || !deadline}
            startIcon={creatingReal ? <CircularProgress size={16} color="inherit" /> : <EuroIcon />}
            sx={{ borderRadius: '10px', fontWeight: 800, px: 3, bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}
          >
            {creatingReal ? 'Redirecting to Stripe…' : `Stake €${stakeEuros.toFixed(2)}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create bet dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ElectricBoltIcon sx={{ color: '#A78BFA' }} />
            Make a Commitment
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Available: {points.toLocaleString()} PP
              </Typography>
            </Box>

            <TextField
              select
              fullWidth
              label="Goal to commit to"
              value={selectedNodeId}
              onChange={e => setSelectedNodeId(e.target.value)}
              helperText="Only incomplete goals are eligible"
            >
              {goalNodes.length === 0
                ? <MenuItem value="" disabled>No incomplete goals found</MenuItem>
                : goalNodes.map(n => (
                    <MenuItem key={n.id} value={n.id}>
                      {n.name} ({Math.round((n.progress ?? 0) * 100)}% done)
                    </MenuItem>
                  ))
              }
            </TextField>

            <TextField
              fullWidth
              label="Deadline"
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              inputProps={{ min: minDeadlineStr }}
              InputLabelProps={{ shrink: true }}
              helperText="If goal isn't peer-verified by this date, you lose the stake"
            />

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Stake amount</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#A78BFA' }}>
                  {stake} PP
                </Typography>
              </Box>
              <Slider
                value={stake}
                onChange={(_, v) => setStake(v as number)}
                min={MIN_STAKE}
                max={Math.min(MAX_STAKE, points)}
                step={50}
                marks={[
                  { value: MIN_STAKE, label: `${MIN_STAKE}` },
                  { value: Math.min(MAX_STAKE, points), label: `${Math.min(MAX_STAKE, points)}` },
                ]}
                sx={{ color: '#A78BFA' }}
              />
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">If you win (goal peer-verified):</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#10B981' }}>+{Math.round(stake * 1.8)} PP (1.8×)</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">If you lose (missed deadline):</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#EF4444' }}>−{stake} PP</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">If you cancel early:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#F59E0B' }}>+{Math.floor(stake * 0.9)} PP (90%)</Typography>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: '10px' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || !selectedNodeId || !deadline || stake > points}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <ElectricBoltIcon />}
            sx={{ borderRadius: '10px', fontWeight: 800, px: 3, bgcolor: '#A78BFA', '&:hover': { bgcolor: '#9333EA' } }}
          >
            {creating ? 'Committing…' : `Pledge ${stake} PP`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duel Challenge Dialog */}
      <Dialog open={duelDialogOpen} onClose={() => setDuelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupAddIcon sx={{ color: '#F59E0B' }} />
            Challenge a Friend
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
            Bet against an opponent — winner takes 1.8× their stake!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Available: {points.toLocaleString()} PP (need {Math.round(stake * 1.8)} to duel)
              </Typography>
            </Box>

            <TextField
              select
              fullWidth
              label="Goal to compete on"
              value={selectedNodeId}
              onChange={e => setSelectedNodeId(e.target.value)}
            >
              {goalNodes.length === 0
                ? <MenuItem value="" disabled>No incomplete goals</MenuItem>
                : goalNodes.map(n => (
                    <MenuItem key={n.id} value={n.id}>
                      {n.name} ({Math.round((n.progress ?? 0) * 100)}% done)
                    </MenuItem>
                  ))
              }
            </TextField>

            <TextField
              type="date"
              fullWidth
              label="Deadline"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: minDeadlineStr }}
            />

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Stake (PP)</Typography>
              <Slider
                value={stake}
                onChange={(_, v) => setStake(v as number)}
                min={50}
                max={Math.min(2000, Math.floor(points / 1.8))}
                step={50}
                marks={[
                  { value: 50, label: '50' },
                  { value: 500, label: '500' },
                  { value: 1000, label: '1000' },
                  { value: Math.min(2000, Math.floor(points / 1.8)), label: 'max' },
                ]}
                sx={{ color: '#F59E0B' }}
              />
              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(245,158,11,0.1)', flex: 1, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Your stake</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#F59E0B' }}>{stake} PP</Typography>
                </Box>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(16,185,129,0.1)', flex: 1, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Win reward</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#10B981' }}>{Math.round(stake * 1.8)} PP</Typography>
                </Box>
              </Stack>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Opponent</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant={opponentType === 'random' ? 'contained' : 'outlined'}
                  onClick={() => setOpponentType('random')}
                  size="small"
                  sx={{ flex: 1, bgcolor: opponentType === 'random' ? '#F59E0B' : undefined, color: opponentType === 'random' ? '#000' : undefined }}
                >
                  Random Match
                </Button>
                <Button
                  variant={opponentType === 'specific' ? 'contained' : 'outlined'}
                  onClick={() => setOpponentType('specific')}
                  size="small"
                  sx={{ flex: 1, bgcolor: opponentType === 'specific' ? '#F59E0B' : undefined, color: opponentType === 'specific' ? '#000' : undefined }}
                >
                  Select Friend
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDuelDialogOpen(false)} sx={{ borderRadius: '10px' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!selectedNodeId || !deadline) {
                toast.error('Select a goal and deadline');
                return;
              }
              const node = goalNodes.find(n => n.id === selectedNodeId);
              setCreatingDuel(true);
              try {
                await api.post('/bets/challenge', {
                  goalName: node?.name || '',
                  deadline,
                  stakePoints: stake,
                  opponentType,
                  opponentId: opponentType === 'specific' ? selectedOpponentId : null,
                });
                toast.success('Duel created! Invite link generated.');
                setDuelDialogOpen(false);
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Failed to create duel');
              } finally {
                setCreatingDuel(false);
              }
            }}
            disabled={creatingDuel || !selectedNodeId || !deadline || stake * 1.8 > points}
            startIcon={creatingDuel ? <CircularProgress size={16} color="inherit" /> : <GroupAddIcon />}
            sx={{ borderRadius: '10px', fontWeight: 800, px: 3, bgcolor: '#F59E0B', color: '#000', '&:hover': { bgcolor: '#D97706' } }}
          >
            {creatingDuel ? 'Creating…' : `Challenge (${Math.round(stake * 1.8)} PP)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BettingPage;
