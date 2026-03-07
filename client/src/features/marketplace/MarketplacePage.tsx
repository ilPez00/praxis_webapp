import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  Avatar,
  Rating,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import WorkIcon from '@mui/icons-material/Work';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import ShieldIcon from '@mui/icons-material/Shield';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StarIcon from '@mui/icons-material/Star';
import SchoolIcon from '@mui/icons-material/School';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupsIcon from '@mui/icons-material/Groups';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import DiamondIcon from '@mui/icons-material/Diamond';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import { useUser } from '../../hooks/useUser';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import BettingPage from '../betting/BettingPage';

interface CatalogueItem {
  item_type: string;
  label: string;
  cost: number;
  description: string;
}

interface CoachProfile {
  id: string;
  user_id: string;
  bio: string;
  skills: string[];
  domains: string[];
  rating: number;
  hourly_rate?: number;
  profiles?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

const itemIcon = (type: string) => {
  if (type === 'streak_shield')     return <ShieldIcon sx={{ color: '#60A5FA' }} />;
  if (type === 'profile_boost')     return <RocketLaunchIcon sx={{ color: '#F59E0B' }} />;
  if (type === 'profile_boost_7d')  return <RocketLaunchIcon sx={{ color: '#F97316' }} />;
  if (type === 'badge_pioneer')     return <WhatshotIcon sx={{ color: '#34D399' }} />;
  if (type === 'badge_apprentice')  return <EmojiEventsIcon sx={{ color: '#94A3B8' }} />;
  if (type === 'badge_achiever')    return <EmojiEventsIcon sx={{ color: '#F59E0B' }} />;
  if (type === 'badge_mentor')      return <GroupsIcon sx={{ color: '#60A5FA' }} />;
  if (type === 'badge_legend')      return <EmojiEventsIcon sx={{ color: '#F97316' }} />;
  if (type === 'badge_visionary')   return <AutoAwesomeIcon sx={{ color: '#A78BFA' }} />;
  if (type === 'goal_tree_edit')    return <AccountTreeIcon sx={{ color: '#34D399' }} />;
  if (type === 'premium_trial')     return <StarIcon sx={{ color: '#A78BFA' }} />;
  if (type === 'coaching_session')  return <SchoolIcon sx={{ color: '#F59E0B' }} />;
  return null;
};

const isOwned = (type: string, user: any): boolean => {
  if (!user) return false;
  const boosted = user.profile_boosted_until && new Date(user.profile_boosted_until) > new Date();
  if (type === 'streak_shield'    && user.streak_shield)                return true;
  if ((type === 'profile_boost' || type === 'profile_boost_7d') && boosted) return true;
  if (type === 'badge_pioneer'    && user.badge === 'Pioneer')          return true;
  if (type === 'badge_apprentice' && user.badge === 'Apprentice')       return true;
  if (type === 'badge_achiever'   && user.badge === 'Achiever')         return true;
  if (type === 'badge_mentor'     && user.badge === 'Mentor')           return true;
  if (type === 'badge_legend'     && user.badge === 'Legend')           return true;
  if (type === 'badge_visionary'  && user.badge === 'Visionary')        return true;
  if (type === 'premium_trial'    && user.is_premium)                   return true;
  return false;
};

const SECTIONS = [
  { label: 'Boosts',   types: ['streak_shield', 'profile_boost', 'profile_boost_7d'] },
  { label: 'Badges',   types: ['badge_pioneer', 'badge_apprentice', 'badge_achiever', 'badge_mentor', 'badge_legend', 'badge_visionary'] },
  { label: 'Premium',  types: ['goal_tree_edit', 'premium_trial'] },
];

// ── Offers types ──────────────────────────────────────────────────────────────
const OFFER_TYPES = [
  { value: 'job', label: '💼 Full-time job', color: '#60A5FA' },
  { value: 'gig', label: '⚡ Gig / Freelance', color: '#F59E0B' },
  { value: 'internship', label: '🎓 Internship', color: '#34D399' },
  { value: 'volunteer', label: '🤝 Volunteer', color: '#A78BFA' },
  { value: 'collab', label: '🚀 Collaboration', color: '#EC4899' },
];

interface Offer {
  id: string;
  poster_id: string;
  title: string;
  description: string | null;
  type: string;
  domain: string | null;
  city: string | null;
  compensation: string | null;
  remote: boolean;
  requirements: string | null;
  contact: string | null;
  status: string;
  created_at: string;
  poster: { id: string; name: string; avatar_url: string | null; is_premium?: boolean } | null;
}

const DOMAINS = ['Fitness', 'Business', 'Creative', 'Tech', 'Education', 'Health', 'Finance', 'Other'];

function timeAgoOffers(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

const OffersPanel: React.FC<{ currentUserId?: string }> = ({ currentUserId }) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('job');
  const [formDomain, setFormDomain] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formComp, setFormComp] = useState('');
  const [formRemote, setFormRemote] = useState(false);
  const [formReqs, setFormReqs] = useState('');
  const [formContact, setFormContact] = useState('');

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const fetchOffers = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const params = filterType ? `?type=${filterType}` : '';
      const { data } = await axios.get(`${API_URL}/offers${params}`, { headers });
      setOffers(Array.isArray(data) ? data : []);
    } catch { setOffers([]); }
    finally { setLoading(false); }
  }, [filterType]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const handleCreate = async () => {
    if (!formTitle.trim()) { toast.error('Title is required.'); return; }
    setSaving(true);
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/offers`, {
        title: formTitle.trim(), description: formDesc.trim() || undefined,
        type: formType, domain: formDomain || undefined, city: formCity.trim() || undefined,
        compensation: formComp.trim() || undefined, remote: formRemote,
        requirements: formReqs.trim() || undefined, contact: formContact.trim() || undefined,
      }, { headers });
      toast.success('Offer posted!');
      setDialogOpen(false);
      setFormTitle(''); setFormDesc(''); setFormType('job'); setFormDomain('');
      setFormCity(''); setFormComp(''); setFormRemote(false); setFormReqs(''); setFormContact('');
      fetchOffers();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to post offer.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const headers = await getAuthHeader();
      await axios.delete(`${API_URL}/offers/${id}`, { headers });
      toast.success('Offer removed.');
      fetchOffers();
    } catch { toast.error('Failed to remove offer.'); }
  };

  const typeCfg = (type: string) => OFFER_TYPES.find(t => t.value === type) ?? OFFER_TYPES[0];

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={900}>Job Offers</Typography>
          <Typography variant="body2" color="text.secondary">Businesses and individuals seeking collaborators</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Filter type</InputLabel>
            <Select value={filterType} label="Filter type" onChange={e => setFilterType(e.target.value)} sx={{ borderRadius: '10px' }}>
              <MenuItem value="">All types</MenuItem>
              {OFFER_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ borderRadius: '10px', fontWeight: 700 }}
          >
            Post offer
          </Button>
        </Stack>
      </Box>

      {offers.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <WorkIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" fontWeight={700}>No offers yet</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>Be the first to post a job or collaboration opportunity.</Typography>
          <Button variant="outlined" sx={{ borderRadius: '10px' }} onClick={() => setDialogOpen(true)}>Post an offer</Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {offers.map(offer => {
            const cfg = typeCfg(offer.type);
            const isOwner = offer.poster_id === currentUserId;
            return (
              <Card key={offer.id} sx={{ bgcolor: '#1F2937', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', p: 0 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Chip label={cfg.label} size="small" sx={{ bgcolor: `${cfg.color}18`, color: cfg.color, fontWeight: 700, fontSize: '0.72rem' }} />
                        {offer.domain && <Chip label={offer.domain} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
                        {offer.remote && <Chip label="🌍 Remote" size="small" sx={{ bgcolor: 'rgba(52,211,153,0.1)', color: '#34D399', fontSize: '0.7rem' }} />}
                      </Box>
                      <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.3 }}>{offer.title}</Typography>
                      {offer.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{offer.description}</Typography>}
                    </Box>
                    {isOwner && (
                      <Tooltip title="Remove offer">
                        <IconButton size="small" onClick={() => handleDelete(offer.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5 }}>
                    {offer.city && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationOnIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary">{offer.city}</Typography>
                      </Box>
                    )}
                    {offer.compensation && (
                      <Typography variant="caption" sx={{ color: '#34D399', fontWeight: 700 }}>💰 {offer.compensation}</Typography>
                    )}
                    {offer.requirements && (
                      <Typography variant="caption" color="text.secondary">📋 {offer.requirements}</Typography>
                    )}
                    {offer.contact && (
                      <Typography variant="caption" sx={{ color: '#60A5FA' }}>📩 {offer.contact}</Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={offer.poster?.avatar_url ?? undefined} sx={{ width: 22, height: 22, fontSize: '0.65rem' }}>
                        {offer.poster?.name?.[0]}
                      </Avatar>
                      <Typography variant="caption" color="text.secondary">{offer.poster?.name}</Typography>
                      {offer.poster?.is_premium && <Chip label="Pro" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(167,139,250,0.15)', color: '#A78BFA' }} />}
                    </Box>
                    <Typography variant="caption" color="text.disabled">{timeAgoOffers(offer.created_at)}</Typography>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><WorkIcon sx={{ color: 'primary.main' }} />Post an Offer</Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth label="Title *" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Looking for a React developer" />
            <TextField fullWidth label="Description" value={formDesc} onChange={e => setFormDesc(e.target.value)} multiline rows={3} placeholder="What are you looking for?" />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Type *</InputLabel>
                  <Select value={formType} label="Type *" onChange={e => setFormType(e.target.value)}>
                    {OFFER_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Domain</InputLabel>
                  <Select value={formDomain} label="Domain" onChange={e => setFormDomain(e.target.value)}>
                    <MenuItem value="">Any domain</MenuItem>
                    {DOMAINS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="City" value={formCity} onChange={e => setFormCity(e.target.value)} placeholder="Milan, Remote…" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Compensation" value={formComp} onChange={e => setFormComp(e.target.value)} placeholder="€30k/yr, €50/hr, equity…" />
              </Grid>
            </Grid>
            <TextField fullWidth label="Requirements" value={formReqs} onChange={e => setFormReqs(e.target.value)} placeholder="2yr experience, fluent English…" />
            <TextField fullWidth label="Contact / Apply" value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="email@company.com or link" />
            <FormControlLabel
              control={<Switch checked={formRemote} onChange={e => setFormRemote(e.target.checked)} />}
              label={<Typography variant="body2">Remote-friendly</Typography>}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !formTitle.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineIcon />}
            sx={{ borderRadius: '10px', fontWeight: 800 }}
          >
            {saving ? 'Posting…' : 'Post offer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const MarketplacePage: React.FC = () => {
  const { user, refetch } = useUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, coachesRes] = await Promise.all([
          fetch(`${API_URL}/marketplace/items`),
          fetch(`${API_URL}/coaches`),
        ]);
        if (itemsRes.ok)   setCatalogue(await itemsRes.json());
        if (coachesRes.ok) setCoaches(await coachesRes.json());
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const buy = async (itemType: string, cost: number, coachUserId?: string) => {
    if (!user) return;
    const key = coachUserId ? `coaching_${coachUserId}` : itemType;
    setPurchasing(key);
    setToast(null);
    try {
      const res = await fetch(`${API_URL}/marketplace/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemType, coachUserId, cost }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Purchase failed.');
      setToast({ type: 'success', message: `Purchased! New balance: ${data.newBalance} pts` });
      refetch();
    } catch (err: any) {
      setToast({ type: 'error', message: err.message ?? 'Purchase failed.' });
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const points = user?.praxis_points ?? 0;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 3 }, py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Marketplace</Typography>
          <Typography variant="body2" color="text.secondary">Spend your Praxis Points on boosts, badges, and more.</Typography>
        </Box>
        <Chip
          icon={<StarIcon sx={{ color: '#F59E0B !important', fontSize: 18 }} />}
          label={`${points} pts`}
          sx={{
            fontSize: '1rem',
            fontWeight: 800,
            px: 1,
            py: 2.5,
            bgcolor: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#F59E0B',
          }}
        />
      </Box>

      {toast && (
        <Alert severity={toast.type} onClose={() => setToast(null)} sx={{ mb: 3 }}>
          {toast.message}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Tab icon={<DiamondIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Buy Pro" />
        <Tab icon={<CasinoIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Betting" />
        <Tab label="Shop" />
        <Tab label="Offers" />
      </Tabs>

      {/* ── Tab 0: Buy Pro ── */}
      {tab === 0 && (
        <Box sx={{ maxWidth: 640, mx: 'auto', py: 2 }}>
          {user?.is_premium ? (
            <Card sx={{
              textAlign: 'center', p: 4,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(52,211,153,0.06) 100%)',
              border: '1px solid rgba(16,185,129,0.3)', borderRadius: 4,
            }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 56, color: '#10B981', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#10B981', mb: 1 }}>
                You're on Praxis Pro ✓
              </Typography>
              <Typography color="text.secondary">
                All Pro features are active. Manage your subscription from your Stripe billing portal.
              </Typography>
              <Button
                variant="outlined"
                href="https://billing.stripe.com/p/login"
                target="_blank"
                sx={{ mt: 3, borderRadius: 2, borderColor: '#10B981', color: '#10B981' }}
              >
                Manage Billing
              </Button>
            </Card>
          ) : (
            <>
              {/* Hero */}
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1,
                  px: 2, py: 0.75, borderRadius: 10, mb: 2,
                  bgcolor: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
                }}>
                  <DiamondIcon sx={{ fontSize: 16, color: '#A78BFA' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#A78BFA', letterSpacing: '0.1em' }}>
                    PRAXIS PRO
                  </Typography>
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: '-0.02em', mb: 1 }}>
                  Level up your{' '}
                  <Box component="span" sx={{
                    background: 'linear-gradient(135deg, #A78BFA, #F59E0B)',
                    backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                    practice
                  </Box>
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 420, mx: 'auto' }}>
                  Everything you need to achieve your goals with AI, data, and community.
                </Typography>
              </Box>

              {/* Pricing cards */}
              <Grid container spacing={2} sx={{ mb: 4 }}>
                {/* Monthly */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card sx={{
                    height: '100%', borderRadius: 3, p: 0.5,
                    border: '1px solid rgba(167,139,250,0.25)',
                    bgcolor: 'rgba(167,139,250,0.05)',
                  }}>
                    <CardContent>
                      <Typography variant="overline" sx={{ color: '#A78BFA', fontWeight: 700 }}>Monthly</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 1 }}>
                        <Typography variant="h3" sx={{ fontWeight: 900 }}>$10</Typography>
                        <Typography color="text.secondary">/month</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">Billed monthly. Cancel anytime.</Typography>
                      <Button
                        fullWidth variant="contained"
                        onClick={() => navigate('/upgrade')}
                        sx={{
                          mt: 2, borderRadius: 2, fontWeight: 700,
                          background: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
                          '&:hover': { opacity: 0.9 },
                        }}
                      >
                        Get Pro — $10/mo
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Annual */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Card sx={{
                    height: '100%', borderRadius: 3, p: 0.5, position: 'relative',
                    border: '1px solid rgba(245,158,11,0.4)',
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(167,139,250,0.08) 100%)',
                  }}>
                    <Box sx={{
                      position: 'absolute', top: -1, right: 16,
                      px: 1.5, py: 0.25, borderRadius: '0 0 8px 8px',
                      bgcolor: '#F59E0B',
                    }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#000', fontSize: '0.65rem' }}>
                        SAVE $24
                      </Typography>
                    </Box>
                    <CardContent>
                      <Typography variant="overline" sx={{ color: '#F59E0B', fontWeight: 700 }}>Annual</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, my: 1 }}>
                        <Typography variant="h3" sx={{ fontWeight: 900 }}>$8</Typography>
                        <Typography color="text.secondary">/month</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">$96 billed once a year.</Typography>
                      <Button
                        fullWidth variant="contained"
                        onClick={() => navigate('/upgrade')}
                        sx={{
                          mt: 2, borderRadius: 2, fontWeight: 700,
                          background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
                          '&:hover': { opacity: 0.9 },
                        }}
                      >
                        Get Annual — $96/yr
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Features list */}
              <Card sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', mb: 4 }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    What's included
                  </Typography>
                  <Stack spacing={1.5}>
                    {[
                      { icon: <AccountTreeIcon sx={{ color: '#34D399', fontSize: 20 }} />, label: 'Unlimited goals & tree depth' },
                      { icon: <AutoAwesomeIcon sx={{ color: '#A78BFA', fontSize: 20 }} />, label: 'Master Roshi AI coaching — strategies, routines, meal plans' },
                      { icon: <StarIcon sx={{ color: '#F59E0B', fontSize: 20 }} />, label: 'Advanced Analytics — domain performance, feedback trends' },
                      { icon: <GroupsIcon sx={{ color: '#60A5FA', fontSize: 20 }} />, label: 'Priority matching algorithm' },
                      { icon: <DiamondIcon sx={{ color: '#A78BFA', fontSize: 20 }} />, label: 'Exclusive Pro badge on your profile' },
                      { icon: <BoltIcon sx={{ color: '#F59E0B', fontSize: 20 }} />, label: 'Early access to new features' },
                    ].map(({ icon, label }) => (
                      <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {icon}
                        <Typography variant="body2">{label}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Points packs */}
              <Typography variant="overline" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Or buy Praxis Points
              </Typography>
              <Grid container spacing={2}>
                {[
                  { label: 'Starter', pp: '500 PP', price: '$2.99', color: '#60A5FA' },
                  { label: 'Growth', pp: '1,500 PP', price: '$6.99', color: '#34D399', best: true },
                  { label: 'Elite', pp: '5,000 PP', price: '$19.99', color: '#A78BFA' },
                ].map(pack => (
                  <Grid size={{ xs: 12, sm: 4 }} key={pack.label}>
                    <Card sx={{
                      borderRadius: 3, textAlign: 'center', p: 0.5,
                      border: `1px solid ${pack.color}30`,
                      bgcolor: `${pack.color}08`,
                      position: 'relative',
                    }}>
                      {pack.best && (
                        <Box sx={{
                          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                          px: 1.5, py: 0.25, borderRadius: '0 0 8px 8px',
                          bgcolor: pack.color,
                        }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: '#000', fontSize: '0.6rem' }}>
                            BEST VALUE
                          </Typography>
                        </Box>
                      )}
                      <CardContent sx={{ pt: pack.best ? 3 : 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: pack.color }}>{pack.label}</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: pack.color, my: 0.5 }}>
                          {pack.pp}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{pack.price}</Typography>
                        <Button
                          fullWidth size="small" variant="outlined"
                          sx={{ borderRadius: 2, borderColor: pack.color, color: pack.color, fontWeight: 700 }}
                          onClick={() => navigate('/upgrade')}
                        >
                          Buy
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
                Points packs coming soon — wiring up Stripe one-time payments.
              </Typography>
            </>
          )}
        </Box>
      )}

      {/* ── Tab 1: Betting ── */}
      {tab === 1 && <BettingPage />}

      {/* ── Tab 2: Shop ── */}
      {tab === 2 && <>

      {/* Catalogue sections */}
      {SECTIONS.map(section => {
        const items = catalogue.filter(i => section.types.includes(i.item_type));
        if (items.length === 0) return null;
        return (
          <Box key={section.label} sx={{ mb: 4 }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              {section.label}
            </Typography>
            <Grid container spacing={2}>
              {items.map(item => {
                const owned = isOwned(item.item_type, user);
                const canAfford = points >= item.cost;
                const isBuying = purchasing === item.item_type;
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.item_type}>
                    <Card
                      sx={{
                        height: '100%',
                        bgcolor: owned
                          ? 'rgba(52,211,153,0.06)'
                          : 'rgba(255,255,255,0.03)',
                        border: owned
                          ? '1px solid rgba(52,211,153,0.3)'
                          : '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          {itemIcon(item.item_type)}
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            {item.label}
                          </Typography>
                          {owned && (
                            <Chip label="Active" size="small" color="success" sx={{ ml: 'auto', height: 20, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {item.description}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                            {item.cost} pts
                          </Typography>
                          <Button
                            variant={owned ? 'outlined' : 'contained'}
                            size="small"
                            disabled={!canAfford || isBuying || owned}
                            onClick={() => buy(item.item_type, item.cost)}
                            startIcon={isBuying ? <CircularProgress size={14} /> : undefined}
                            sx={{ minWidth: 80 }}
                          >
                            {owned ? 'Owned' : isBuying ? 'Buying…' : 'Buy'}
                          </Button>
                        </Box>
                        {!canAfford && !owned && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                            Need {item.cost - points} more pts
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        );
      })}

      {/* Coaching sessions */}
      {coaches.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Typography variant="overline" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            Coaching
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Book a coaching session — your points transfer directly to the coach.
          </Typography>
          <Stack spacing={2}>
            {coaches.filter(c => c.hourly_rate != null).map(coach => {
              const sessionCost = coach.hourly_rate ?? 0;
              const canAfford = points >= sessionCost;
              const coachKey = `coaching_${coach.user_id}`;
              const isBuying = purchasing === coachKey;
              return (
                <Card
                  key={coach.id}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar
                      src={coach.profiles?.avatar_url ?? undefined}
                      sx={{ width: 48, height: 48, border: '2px solid rgba(245,158,11,0.3)' }}
                    >
                      {coach.profiles?.name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {coach.profiles?.name ?? 'Coach'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Rating value={coach.rating} precision={0.5} size="small" readOnly />
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {(coach.domains ?? []).slice(0, 3).map(d => (
                            <Chip key={d} label={d} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                          ))}
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right', minWidth: 'fit-content' }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
                        {sessionCost} pts/hr
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={!canAfford || isBuying}
                        onClick={() => buy('coaching_session', sessionCost, coach.user_id)}
                        startIcon={isBuying ? <CircularProgress size={14} /> : undefined}
                        sx={{ mt: 0.5, minWidth: 80 }}
                      >
                        {isBuying ? 'Booking…' : 'Book'}
                      </Button>
                      {!canAfford && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                          Need {sessionCost - points} more pts
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}
      </>}

      {/* ── Tab 3: Offers ── */}
      {tab === 3 && <OffersPanel currentUserId={user?.id} />}
    </Box>
  );
};

export default MarketplacePage;
