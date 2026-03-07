import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Tabs, Tab, Button, Stack, Chip, Grid,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Slider,
  Avatar, Tooltip, IconButton, Divider, Alert,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SwordIcon from '@mui/icons-material/SportsMartialArts';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WhiteFlagIcon from '@mui/icons-material/Flag';
import BoltIcon from '@mui/icons-material/Bolt';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TuneIcon from '@mui/icons-material/Tune';
import GlassCard from '../../components/common/GlassCard';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';

// ─── Constants ───────────────────────────────────────────────────────────────

const DOMAINS = [
  'Fitness', 'Business', 'Creative', 'Tech', 'Education',
  'Health', 'Finance', 'Relationships', 'Mindfulness', 'Personal Goals',
];

const DOMAIN_COLORS: Record<string, string> = {
  Fitness: '#F97316', Business: '#3B82F6', Creative: '#EC4899',
  Tech: '#8B5CF6', Education: '#10B981', Health: '#34D399',
  Finance: '#F59E0B', Relationships: '#E11D48', Mindfulness: '#A78BFA',
  'Personal Goals': '#F43F5E',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:      { label: 'Open',      color: '#10B981' },
  pending:   { label: 'Pending',   color: '#F59E0B' },
  active:    { label: 'Active',    color: '#3B82F6' },
  completed: { label: 'Done',      color: '#6B7280' },
  declined:  { label: 'Declined',  color: '#EF4444' },
  cancelled: { label: 'Cancelled', color: '#6B7280' },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface DuelProfile {
  id: string; name: string; avatar_url: string | null; current_streak?: number; praxis_points?: number;
}

interface Duel {
  id: string;
  creator_id: string;
  opponent_id: string | null;
  title: string;
  description: string | null;
  category: string;
  stake_pp: number;
  deadline_days: number;
  deadline: string;
  status: string;
  won_by: string | null;
  creator_claimed: boolean;
  opponent_claimed: boolean;
  created_at: string;
  _relevance?: number;
  creator: DuelProfile | null;
  opponent: DuelProfile | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysLeft(deadline: string): number {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Duel Card ───────────────────────────────────────────────────────────────

const DuelCard: React.FC<{
  duel: Duel;
  currentUserId?: string;
  onAction: () => void;
}> = ({ duel, currentUserId, onAction }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const color = DOMAIN_COLORS[duel.category] ?? '#6B7280';
  const statusCfg = STATUS_CONFIG[duel.status] ?? { label: duel.status, color: '#6B7280' };
  const isCreator = duel.creator_id === currentUserId;
  const isOpponent = duel.opponent_id === currentUserId;
  const myClaim = isCreator ? duel.creator_claimed : isOpponent ? duel.opponent_claimed : false;
  const days = daysLeft(duel.deadline);

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const doAction = async (endpoint: string, method: 'post' | 'delete' = 'post') => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      await axios[method](`${API_URL}/duels/${duel.id}/${endpoint}`, {}, { headers });
      toast.success(endpoint === 'accept' ? 'Challenge accepted! Game on.' :
                    endpoint === 'decline' ? 'Challenge declined.' :
                    endpoint === 'claim' ? 'Win claimed! Waiting for opponent.' :
                    endpoint === 'concede' ? 'You conceded. Better luck next time!' :
                    'Done!');
      onAction();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally { setLoading(false); }
  };

  return (
    <GlassCard sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            label={duel.category}
            size="small"
            sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: '0.7rem' }}
          />
          <Chip
            label={statusCfg.label}
            size="small"
            sx={{ bgcolor: `${statusCfg.color}18`, color: statusCfg.color, fontWeight: 700, fontSize: '0.7rem' }}
          />
          {duel._relevance && duel._relevance > 0.7 && (
            <Chip label="Relevant" size="small" sx={{ bgcolor: 'rgba(167,139,250,0.12)', color: '#A78BFA', fontWeight: 700, fontSize: '0.7rem' }} />
          )}
        </Stack>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <BoltIcon sx={{ fontSize: 14, color: '#A78BFA' }} />
          <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800 }}>
            {duel.stake_pp} PP
          </Typography>
        </Box>
      </Box>

      {/* Title */}
      <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.3 }}>{duel.title}</Typography>
      {duel.description && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>{duel.description}</Typography>
      )}

      {/* Meta */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ fontSize: '0.75rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AccessTimeIcon sx={{ fontSize: 13, color: days <= 1 ? '#EF4444' : 'text.disabled' }} />
          <Typography variant="caption" color={days <= 1 ? 'error' : 'text.secondary'}>
            {days === 0 ? 'Expires today' : `${days}d left`} · due {formatDate(duel.deadline)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <BoltIcon sx={{ fontSize: 13, color: '#34D399' }} />
          <Typography variant="caption" color="text.secondary">
            Pot: {duel.stake_pp * 2} PP · winner gets {Math.floor(duel.stake_pp * 2 * 0.95)} PP
          </Typography>
        </Box>
      </Stack>

      {/* Creator + Opponent */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Tooltip title={`${duel.creator?.name ?? 'Unknown'} (creator)`}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer' }}
            onClick={() => duel.creator?.id && navigate(`/profile/${duel.creator.id}`)}
          >
            <Avatar src={duel.creator?.avatar_url ?? undefined} sx={{ width: 24, height: 24, fontSize: '0.65rem' }}>
              {duel.creator?.name?.[0]}
            </Avatar>
            <Typography variant="caption" fontWeight={600}>{duel.creator?.name ?? '?'}</Typography>
          </Box>
        </Tooltip>

        <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 800 }}>VS</Typography>

        {duel.opponent ? (
          <Tooltip title={duel.opponent.name}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer' }}
              onClick={() => duel.opponent?.id && navigate(`/profile/${duel.opponent.id}`)}
            >
              <Avatar src={duel.opponent.avatar_url ?? undefined} sx={{ width: 24, height: 24, fontSize: '0.65rem' }}>
                {duel.opponent.name?.[0]}
              </Avatar>
              <Typography variant="caption" fontWeight={600}>{duel.opponent.name}</Typography>
            </Box>
          </Tooltip>
        ) : (
          <Chip label="Open slot" size="small" variant="outlined"
            sx={{ fontSize: '0.68rem', color: '#10B981', borderColor: '#10B981', height: 20 }} />
        )}
      </Box>

      {/* Claims indicator (active duels) */}
      {duel.status === 'active' && (isCreator || isOpponent) && (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            icon={duel.creator_claimed ? <CheckCircleIcon sx={{ fontSize: '12px !important' }} /> : undefined}
            label={`${duel.creator?.name?.split(' ')[0] ?? 'Creator'}: ${duel.creator_claimed ? 'claimed ✓' : 'pending'}`}
            size="small"
            sx={{ fontSize: '0.68rem', bgcolor: duel.creator_claimed ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', color: duel.creator_claimed ? '#10B981' : 'text.secondary' }}
          />
          <Chip
            icon={duel.opponent_claimed ? <CheckCircleIcon sx={{ fontSize: '12px !important' }} /> : undefined}
            label={`${duel.opponent?.name?.split(' ')[0] ?? 'Opponent'}: ${duel.opponent_claimed ? 'claimed ✓' : 'pending'}`}
            size="small"
            sx={{ fontSize: '0.68rem', bgcolor: duel.opponent_claimed ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', color: duel.opponent_claimed ? '#10B981' : 'text.secondary' }}
          />
        </Box>
      )}

      {/* Winner badge */}
      {duel.status === 'completed' && duel.won_by && (
        <Chip
          icon={<EmojiEventsIcon sx={{ fontSize: '14px !important', color: '#F59E0B !important' }} />}
          label={`Winner: ${duel.won_by === duel.creator_id ? duel.creator?.name : duel.opponent?.name}`}
          sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontWeight: 700, alignSelf: 'flex-start' }}
        />
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 'auto', flexWrap: 'wrap' }}>
        {/* Open duel: anyone can accept */}
        {duel.status === 'open' && !isCreator && currentUserId && (
          <Button
            size="small" variant="contained"
            startIcon={loading ? <CircularProgress size={13} color="inherit" /> : <SwordIcon />}
            onClick={() => doAction('accept')} disabled={loading}
            sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', flex: 1 }}
          >
            Accept ({duel.stake_pp} PP)
          </Button>
        )}

        {/* Creator can cancel open/pending duels */}
        {isCreator && ['open', 'pending'].includes(duel.status) && (
          <Button
            size="small" variant="outlined" color="error"
            startIcon={<CancelIcon />}
            onClick={() => doAction('cancel')} disabled={loading}
            sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem' }}
          >
            Cancel
          </Button>
        )}

        {/* Opponent can accept/decline a direct (pending) challenge */}
        {isOpponent && duel.status === 'pending' && (
          <>
            <Button
              size="small" variant="contained" color="success"
              startIcon={loading ? <CircularProgress size={13} color="inherit" /> : <CheckCircleIcon />}
              onClick={() => doAction('accept')} disabled={loading}
              sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', flex: 1 }}
            >
              Accept ({duel.stake_pp} PP)
            </Button>
            <Button
              size="small" variant="outlined" color="error"
              startIcon={<CancelIcon />}
              onClick={() => doAction('decline')} disabled={loading}
              sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem' }}
            >
              Decline
            </Button>
          </>
        )}

        {/* Active duel: claim win or concede */}
        {duel.status === 'active' && (isCreator || isOpponent) && !myClaim && (
          <>
            <Button
              size="small" variant="contained" color="success"
              startIcon={loading ? <CircularProgress size={13} color="inherit" /> : <EmojiEventsIcon />}
              onClick={() => doAction('claim')} disabled={loading}
              sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', flex: 1 }}
            >
              I won!
            </Button>
            <Button
              size="small" variant="outlined"
              startIcon={<WhiteFlagIcon />}
              onClick={() => doAction('concede')} disabled={loading}
              sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              Concede
            </Button>
          </>
        )}

        {duel.status === 'active' && (isCreator || isOpponent) && myClaim && (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            Waiting for opponent to respond…
          </Typography>
        )}
      </Box>
    </GlassCard>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ChallengesPage: React.FC = () => {
  const { user } = useUser();
  const [mainTab, setMainTab] = useState(0); // 0=Feed 1=Mine
  const [filterCategory, setFilterCategory] = useState('');
  const [duels, setDuels] = useState<Duel[]>([]);
  const [myDuels, setMyDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLoading, setMyLoading] = useState(true);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('Fitness');
  const [formStake, setFormStake] = useState(50);
  const [formDays, setFormDays] = useState(7);
  const [formOpponentUsername, setFormOpponentUsername] = useState('');
  const [resolvedOpponentId, setResolvedOpponentId] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const params = filterCategory ? `?category=${encodeURIComponent(filterCategory)}` : '';
      const { data } = await axios.get(`${API_URL}/duels${params}`, { headers });
      setDuels(Array.isArray(data) ? data : []);
    } catch { setDuels([]); }
    finally { setLoading(false); }
  }, [filterCategory, getHeaders]);

  const fetchMine = useCallback(async () => {
    if (!user) return;
    setMyLoading(true);
    try {
      const headers = await getHeaders();
      const { data } = await axios.get(`${API_URL}/duels/mine`, { headers });
      setMyDuels(Array.isArray(data) ? data : []);
    } catch { setMyDuels([]); }
    finally { setMyLoading(false); }
  }, [user, getHeaders]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);
  useEffect(() => { if (mainTab === 1) fetchMine(); }, [mainTab, fetchMine]);

  // Resolve opponent by @username
  const lookupOpponent = async () => {
    const handle = formOpponentUsername.replace(/^@/, '').trim();
    if (!handle) return;
    setLookingUp(true);
    try {
      const { data } = await supabase
        .from('profiles').select('id, name').eq('username', handle).maybeSingle();
      if (data) {
        setResolvedOpponentId((data as any).id);
        toast.success(`Found: ${(data as any).name}`);
      } else {
        toast.error('User not found. Check the @username.');
        setResolvedOpponentId(null);
      }
    } catch { toast.error('Lookup failed.'); }
    finally { setLookingUp(false); }
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) { toast.error('Title is required.'); return; }
    setSaving(true);
    try {
      const headers = await getHeaders();
      await axios.post(`${API_URL}/duels`, {
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        category: formCategory,
        stakePP: formStake,
        deadlineDays: formDays,
        opponentId: resolvedOpponentId || undefined,
      }, { headers });
      toast.success(resolvedOpponentId ? 'Challenge sent!' : 'Open challenge posted!');
      setDialogOpen(false);
      setFormTitle(''); setFormDesc(''); setFormCategory('Fitness'); setFormStake(50);
      setFormDays(7); setFormOpponentUsername(''); setResolvedOpponentId(null);
      if (resolvedOpponentId) { fetchMine(); setMainTab(1); } else fetchFeed();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create challenge.');
    } finally { setSaving(false); }
  };

  const refreshAll = useCallback(() => {
    fetchFeed();
    if (mainTab === 1 || user) fetchMine();
  }, [fetchFeed, fetchMine, mainTab, user]);

  // Filter my duels by status group
  const pending = myDuels.filter(d => d.status === 'pending');
  const active  = myDuels.filter(d => d.status === 'active');
  const history = myDuels.filter(d => ['completed', 'declined', 'cancelled'].includes(d.status));

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Page header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <EmojiEventsIcon sx={{ color: '#F59E0B', fontSize: 36 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>Challenges</Typography>
            <Typography variant="body2" color="text.secondary">
              Bet PP against other users. The matched feed shows the most relevant challenges first.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ borderRadius: '12px', fontWeight: 800, px: 3 }}
        >
          New Challenge
        </Button>
      </Box>

      {/* Main tabs */}
      <Tabs
        value={mainTab}
        onChange={(_, v) => setMainTab(v)}
        sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Tab label="Open Feed" />
        <Tab
          label={
            myDuels.filter(d => d.status === 'pending' && d.opponent_id === user?.id).length > 0
              ? `My Duels (${myDuels.filter(d => d.status === 'pending' && d.opponent_id === user?.id).length} pending)`
              : 'My Duels'
          }
        />
      </Tabs>

      {/* ── Feed tab ── */}
      {mainTab === 0 && (
        <Box>
          {/* Category filter */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
            <Chip
              label="All"
              onClick={() => setFilterCategory('')}
              variant={filterCategory === '' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700 }}
            />
            {DOMAINS.map(d => (
              <Chip
                key={d}
                label={d}
                onClick={() => setFilterCategory(d === filterCategory ? '' : d)}
                variant={filterCategory === d ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 700,
                  bgcolor: filterCategory === d ? `${DOMAIN_COLORS[d]}22` : undefined,
                  color: filterCategory === d ? DOMAIN_COLORS[d] : undefined,
                  borderColor: filterCategory === d ? DOMAIN_COLORS[d] : undefined,
                }}
              />
            ))}
          </Stack>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : duels.length === 0 ? (
            <GlassCard sx={{ p: 6, textAlign: 'center' }}>
              <EmojiEventsIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" fontWeight={700}>No open challenges yet</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                Post the first challenge — your matched users will see it ranked by relevance.
              </Typography>
              <Button variant="outlined" sx={{ borderRadius: '10px' }} onClick={() => setDialogOpen(true)}>
                Create a challenge
              </Button>
            </GlassCard>
          ) : (
            <Grid container spacing={2}>
              {duels.map(duel => (
                <Grid key={duel.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <DuelCard duel={duel} currentUserId={user?.id} onAction={refreshAll} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* ── My Duels tab ── */}
      {mainTab === 1 && (
        <Box>
          {myLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : myDuels.length === 0 ? (
            <GlassCard sx={{ p: 6, textAlign: 'center' }}>
              <SwordIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" fontWeight={700}>No duels yet</Typography>
              <Typography variant="body2" color="text.disabled">
                Challenge someone directly or post an open challenge in the feed.
              </Typography>
            </GlassCard>
          ) : (
            <Stack spacing={4}>
              {pending.length > 0 && (
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: '#F59E0B' }}>
                    Pending ({pending.length})
                  </Typography>
                  <Grid container spacing={2}>
                    {pending.map(d => (
                      <Grid key={d.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <DuelCard duel={d} currentUserId={user?.id} onAction={refreshAll} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
              {active.length > 0 && (
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: '#3B82F6' }}>
                    Active ({active.length})
                  </Typography>
                  <Grid container spacing={2}>
                    {active.map(d => (
                      <Grid key={d.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <DuelCard duel={d} currentUserId={user?.id} onAction={refreshAll} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
              {history.length > 0 && (
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: 'text.secondary' }}>
                    History
                  </Typography>
                  <Grid container spacing={2}>
                    {history.map(d => (
                      <Grid key={d.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <DuelCard duel={d} currentUserId={user?.id} onAction={refreshAll} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Stack>
          )}
        </Box>
      )}

      {/* ── Create Challenge Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ color: '#F59E0B' }} />
            New Challenge
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              fullWidth label="Challenge title *"
              value={formTitle} onChange={e => setFormTitle(e.target.value)}
              placeholder="e.g. Run 5km every day for a week"
            />
            <TextField
              fullWidth label="Description"
              value={formDesc} onChange={e => setFormDesc(e.target.value)}
              multiline rows={2}
              placeholder="What does winning look like? How will you prove it?"
            />
            <FormControl fullWidth>
              <InputLabel>Category *</InputLabel>
              <Select value={formCategory} label="Category *" onChange={e => setFormCategory(e.target.value)}>
                {DOMAINS.map(d => (
                  <MenuItem key={d} value={d}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: DOMAIN_COLORS[d] }} />
                      {d}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Stake slider */}
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                Stake: <Box component="span" sx={{ color: '#A78BFA' }}>{formStake} PP</Box>
                {' '}· Pot: <Box component="span" sx={{ color: '#34D399' }}>{formStake * 2} PP</Box>
                {' '}· Winner gets: <Box component="span" sx={{ color: '#F59E0B' }}>{Math.floor(formStake * 2 * 0.95)} PP</Box>
              </Typography>
              <Slider
                value={formStake} onChange={(_, v) => setFormStake(v as number)}
                min={10} max={500} step={10}
                marks={[{ value: 50, label: '50' }, { value: 200, label: '200' }, { value: 500, label: '500' }]}
                sx={{ color: '#A78BFA' }}
              />
              <Typography variant="caption" color="text.secondary">
                5% platform fee on winnings. Both parties stake the same amount.
              </Typography>
            </Box>

            {/* Deadline slider */}
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                Duration: <Box component="span" sx={{ color: '#3B82F6' }}>{formDays} day{formDays !== 1 ? 's' : ''}</Box>
              </Typography>
              <Slider
                value={formDays} onChange={(_, v) => setFormDays(v as number)}
                min={1} max={30} step={1}
                marks={[{ value: 1, label: '1d' }, { value: 7, label: '7d' }, { value: 30, label: '30d' }]}
                sx={{ color: '#3B82F6' }}
              />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

            {/* Optional direct opponent */}
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                Challenge a specific user (optional)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Leave blank to post as an open challenge anyone can accept.
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small" fullWidth
                  label="@username"
                  value={formOpponentUsername}
                  onChange={e => { setFormOpponentUsername(e.target.value); setResolvedOpponentId(null); }}
                  placeholder="@handle"
                />
                <Button
                  variant="outlined" size="small"
                  onClick={lookupOpponent}
                  disabled={lookingUp || !formOpponentUsername.trim()}
                  sx={{ borderRadius: '8px', minWidth: 80, fontWeight: 700 }}
                >
                  {lookingUp ? <CircularProgress size={14} /> : 'Find'}
                </Button>
              </Stack>
              {resolvedOpponentId && (
                <Alert severity="success" sx={{ mt: 1, fontSize: '0.8rem', borderRadius: '8px' }}>
                  Opponent found! This will be a direct challenge they must accept.
                </Alert>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !formTitle.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <EmojiEventsIcon />}
            sx={{ borderRadius: '10px', fontWeight: 800, px: 3 }}
          >
            {saving ? 'Posting…' : resolvedOpponentId ? `Challenge for ${formStake} PP` : `Post for ${formStake} PP`}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ChallengesPage;
