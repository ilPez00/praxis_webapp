import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../../lib/api';
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
import { GoalNode } from '../../models/GoalNode';

interface Bet {
  id: string;
  user_id: string;
  goal_node_id: string;
  goal_name: string;
  deadline: string;
  stake_points: number;
  status: 'active' | 'won' | 'lost' | 'cancelled';
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active:    { label: 'Active',     color: '#3B82F6', icon: <TimerIcon fontSize="small" /> },
  won:       { label: 'Won',        color: '#10B981', icon: <EmojiEventsIcon fontSize="small" /> },
  lost:      { label: 'Lost',       color: '#EF4444', icon: <HighlightOffIcon fontSize="small" /> },
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setCurrentUserId(u?.id));
  }, []);

  const fetchBets = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await axios.get(`${API_URL}/bets/${currentUserId}`);
      setBets(Array.isArray(res.data) ? res.data : []);
    } catch {
      setBets([]);
    }
  }, [currentUserId]);

  const fetchGoalNodes = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await axios.get(`${API_URL}/goals/${currentUserId}`);
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
      await axios.post(`${API_URL}/bets`, {
        userId: currentUserId,
        goalNodeId: selectedNodeId,
        goalName: node.name,
        deadline,
        stakePoints: stake,
      });
      toast.success(`Bet placed! ${stake} PP staked on "${node.name}"`);

      // Auto-post public accountability message to the feed
      try {
        await axios.post(`${API_URL}/posts`, {
          userId: currentUserId,
          userName: user?.name || 'A Praxis member',
          userAvatarUrl: (user as any)?.avatar_url || null,
          content: `🎯 I just staked ${stake} PP on completing my goal: "${node.name}" by ${new Date(deadline).toLocaleDateString()}. Hold me accountable! 💪`,
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
      const { data: { session } } = await supabase.auth.getSession();
      await axios.delete(`${API_URL}/bets/${betId}`, {
        data: { userId: currentUserId },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      toast.success('Bet cancelled. 90% of stake refunded (10% house fee).');
      await fetchBets();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel bet.');
    }
  };

  const points = user?.praxis_points ?? 0;
  const activeBets = bets.filter(b => b.status === 'active');
  const historyBets = bets.filter(b => b.status !== 'active');
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
            <Typography variant="h4" sx={{ fontWeight: 900 }}>Goal Staking</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Put your Praxis Points on the line. Complete the goal → 2× reward. Fail → forfeit.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={points < MIN_STAKE || goalNodes.length === 0}
            sx={{ borderRadius: '12px', fontWeight: 700, px: 3 }}
          >
            Place Bet
          </Button>
        </Box>

        {/* Stats row */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { label: 'Available PP', value: points.toLocaleString(), color: '#A78BFA', icon: <ElectricBoltIcon /> },
            { label: 'Staked PP', value: totalStaked.toLocaleString(), color: '#3B82F6', icon: <TimerIcon /> },
            { label: 'Active Bets', value: activeBets.length, color: '#F59E0B', icon: <LocalFireDepartmentIcon /> },
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
        <GlassCard sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Active Bets ({activeBets.length})
          </Typography>
          {activeBets.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <TimerIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">No active bets. Stake some PP on a goal to get started.</Typography>
              {points < MIN_STAKE && (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                  You need at least {MIN_STAKE} PP to place a bet. Keep checking in!
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
                        <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>{bet.goal_name}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                          <Chip
                            icon={<ElectricBoltIcon />}
                            label={`${bet.stake_points} PP staked`}
                            size="small"
                            sx={{ bgcolor: 'rgba(167,139,250,0.1)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.25)', fontWeight: 700, fontSize: '0.7rem' }}
                          />
                          <Chip
                            icon={<TimerIcon />}
                            label={days > 0 ? `${days}d left` : 'Overdue'}
                            size="small"
                            sx={{ bgcolor: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', color: urgent ? '#EF4444' : '#3B82F6', border: `1px solid ${urgent ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)'}`, fontWeight: 700, fontSize: '0.7rem' }}
                          />
                          <Chip
                            icon={<EmojiEventsIcon />}
                            label={`Win: ${Math.round(bet.stake_points * 1.8)} PP`}
                            size="small"
                            sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', fontWeight: 700, fontSize: '0.7rem' }}
                          />
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
                              const text = `I just staked ${bet.stake_points} PP that I'll "${bet.goal_name}" by ${deadlineStr}. Think you can beat me? Join Praxis → https://praxis-app.vercel.app`;
                              if (navigator.share) {
                                navigator.share({ title: 'I accepted a Praxis challenge', text }).catch(() => {});
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

        {/* Bet history */}
        {historyBets.length > 0 && (
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
                      {bet.status === 'won' && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#10B981', fontWeight: 700, mt: 0.25 }}>
                          +{Math.round(bet.stake_points * 1.8)} PP
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </GlassCard>
        )}
      </Container>

      {/* Create bet dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ElectricBoltIcon sx={{ color: '#A78BFA' }} />
            Place a Bet
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
              label="Goal to bet on"
              value={selectedNodeId}
              onChange={e => setSelectedNodeId(e.target.value)}
              helperText="You can only bet on incomplete goals"
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
            {creating ? 'Placing…' : `Stake ${stake} PP`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BettingPage;
