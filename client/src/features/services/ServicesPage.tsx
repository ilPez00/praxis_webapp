import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, Card, CardContent, CardActions,
  Button, TextField, InputAdornment, Chip, Avatar, CircularProgress,
  Tabs, Tab, Grid, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Divider, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import WorkIcon from '@mui/icons-material/Work';
import BuildIcon from '@mui/icons-material/Build';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SchoolIcon from '@mui/icons-material/School';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import api from '../../lib/api';
import PageSkeleton from '../../components/common/PageSkeleton';
import CoachingMarketplace from '../coaching/CoachingMarketplace';
import { DOMAIN_COLORS } from '../../types/goal';
import { Domain } from '../../models/Domain';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ServiceListing {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar_url?: string;
  title: string;
  description?: string;
  type: 'service' | 'job' | 'gig' | 'coaching';
  domain?: string;
  price?: number;
  price_currency: 'USD' | 'PP' | 'negotiable' | 'free';
  tags: string[];
  contact_info?: string;
  active: boolean;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META = {
  service:  { label: 'Service', color: '#60A5FA', icon: <BuildIcon fontSize="small" /> },
  job:      { label: 'Job / Role', color: '#34D399', icon: <WorkIcon fontSize="small" /> },
  gig:      { label: 'Gig / Freelance', color: '#FBBF24', icon: <FlashOnIcon fontSize="small" /> },
  coaching: { label: 'Coaching', color: '#A78BFA', icon: <SchoolIcon fontSize="small" /> },
};

const CURRENCY_LABEL: Record<string, string> = {
  USD: '$',
  PP: '⚡',
  negotiable: 'Negotiable',
  free: 'Free',
};

function priceLabel(listing: ServiceListing) {
  if (listing.price_currency === 'free') return 'Free';
  if (listing.price_currency === 'negotiable') return 'Negotiable';
  if (listing.price == null) return listing.price_currency === 'PP' ? '⚡ Ask' : 'Ask';
  const sym = CURRENCY_LABEL[listing.price_currency] ?? listing.price_currency;
  return `${sym}${listing.price}`;
}

// ── Empty form ────────────────────────────────────────────────────────────────

const emptyForm = () => ({
  title: '', description: '', type: 'service' as 'service' | 'job' | 'gig' | 'coaching',
  domain: '' as string, price: '' as string | number,
  price_currency: 'negotiable' as 'USD' | 'PP' | 'negotiable' | 'free',
  tags: '' as string, contact_info: '',
});

// ── Main component ────────────────────────────────────────────────────────────

const ServicesPage: React.FC = () => {
  const { user } = useUser();
  const [tab, setTab] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [myListings, setMyListings] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceListing | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // ── Fetch browse listings ──────────────────────────────────────────────────

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (search.trim()) params.set('q', search.trim());
      const res = await api.get(`/services?${params}`);
      setListings(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [typeFilter, search]);

  const fetchMine = useCallback(async () => {
    try {
      const res = await api.get('/services/mine');
      setMyListings(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (tab === 0) fetchListings(); }, [tab, typeFilter, fetchListings]);
  useEffect(() => { if (tab === 1) fetchMine(); }, [tab, fetchMine]);

  // ── Search on Enter ────────────────────────────────────────────────────────
  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fetchListings();
  };

  // ── Open form ──────────────────────────────────────────────────────────────
  const openCreate = () => { setEditTarget(null); setForm(emptyForm()); setFormOpen(true); };
  const openEdit = (l: ServiceListing) => {
    setEditTarget(l);
    setForm({
      title: l.title, description: l.description ?? '', type: l.type as 'service' | 'job' | 'gig' | 'coaching',
      domain: l.domain ?? '', price: l.price ?? '',
      price_currency: l.price_currency, tags: (l.tags ?? []).join(', '),
      contact_info: l.contact_info ?? '',
    });
    setFormOpen(true);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required.'); return; }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        type: form.type,
        domain: form.domain || null,
        price: form.price !== '' ? Number(form.price) : null,
        price_currency: form.price_currency,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        contact_info: form.contact_info || null,
      };

      let res;
      if (editTarget) {
        res = await api.put(`/services/${editTarget.id}`, body);
      } else {
        res = await api.post('/services', body);
      }

      const data = res.data;
      if (editTarget) {
        setMyListings(prev => prev.map(l => l.id === data.id ? data : l));
        toast.success('Listing updated.');
      } else {
        setMyListings(prev => [data, ...prev]);
        toast.success('Listing published!');
      }
      setFormOpen(false);
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to save.'); } finally { setSaving(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/services/${id}`);
      setMyListings(prev => prev.filter(l => l.id !== id));
      toast.success('Listing removed.');
    } catch { toast.error('Failed to delete.'); }
  };

  const navigate = useNavigate();

  // ── Listing card ───────────────────────────────────────────────────────────
  const ListingCard = ({ l, mine = false }: { l: ServiceListing; mine?: boolean }) => {
    const meta = TYPE_META[l.type];
    const domainColor = l.domain ? (DOMAIN_COLORS as Record<string, string>)[l.domain] : '#6B7280';

    return (
      <Card sx={{
        borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column',
        border: `1px solid ${meta.color}18`,
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: `${meta.color}40` },
      }}>
        <CardContent sx={{ flex: 1 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
            <Box sx={{ cursor: 'pointer' }} onClick={() => navigate('/profile/' + l.user_id)}>
              <Avatar src={l.user_avatar_url} sx={{ width: 36, height: 36, fontSize: '0.9rem' }}>
                {l.user_name?.[0]?.toUpperCase()}
              </Avatar>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{l.title}</Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => navigate('/profile/' + l.user_id)}
              >
                {l.user_name}
              </Typography>
            </Box>
            <Chip
              icon={meta.icon}
              label={meta.label}
              size="small"
              sx={{
                height: 20, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
                bgcolor: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30`,
                '& .MuiChip-icon': { fontSize: 12, color: `${meta.color} !important` },
              }}
            />
          </Box>

          {/* Description */}
          {l.description && (
            <Typography variant="caption" color="text.secondary" sx={{
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              mb: 1.5, lineHeight: 1.5,
            }}>
              {l.description}
            </Typography>
          )}

          {/* Tags */}
          {l.tags?.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
              {l.tags.slice(0, 4).map(t => (
                <Chip key={t} label={t} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.06)' }} />
              ))}
            </Box>
          )}

          {/* Domain + Price row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
            {l.domain && (
              <Chip label={l.domain} size="small" sx={{
                height: 18, fontSize: '0.62rem', bgcolor: `${domainColor}18`, color: domainColor, border: `1px solid ${domainColor}30`,
              }} />
            )}
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', ml: 'auto' }}>
              {priceLabel(l)}
            </Typography>
          </Box>
        </CardContent>

        <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
          {l.contact_info && (
            <Button
              size="small" variant="outlined" endIcon={<OpenInNewIcon />}
              onClick={() => {
                const href = l.contact_info!.startsWith('http') ? l.contact_info! : `mailto:${l.contact_info}`;
                window.open(href, '_blank');
              }}
              sx={{ borderRadius: 2, fontSize: '0.75rem', flex: 1 }}
            >
              Contact
            </Button>
          )}
          {mine && (
            <>
              <IconButton size="small" onClick={() => openEdit(l)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => handleDelete(l.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </CardActions>
      </Card>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)' }}>
            <StorefrontIcon sx={{ fontSize: 26, color: '#60A5FA', display: 'block' }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Services</Typography>
            <Typography variant="body2" color="text.secondary">
              Hire, collaborate, or offer your skills to the Praxis community
            </Typography>
          </Box>
        </Box>
        {user && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ borderRadius: 2 }}>
            Post Listing
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Tab label="Browse All" />
        {user && <Tab label="My Listings" />}
        <Tab label="Coaching" />
      </Tabs>

      {/* ── Tab 0: Browse ── */}
      {tab === 0 && (
        <>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder="Search listings…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 260 }}
            />
            <ToggleButtonGroup
              size="small"
              value={typeFilter}
              exclusive
              onChange={(_, v) => setTypeFilter(v ?? '')}
            >
              <ToggleButton value="" sx={{ px: 1.5, fontSize: '0.75rem' }}>All</ToggleButton>
              <ToggleButton value="service" sx={{ px: 1.5, fontSize: '0.75rem', color: '#60A5FA' }}>Services</ToggleButton>
              <ToggleButton value="job" sx={{ px: 1.5, fontSize: '0.75rem', color: '#34D399' }}>Jobs</ToggleButton>
              <ToggleButton value="gig" sx={{ px: 1.5, fontSize: '0.75rem', color: '#FBBF24' }}>Gigs</ToggleButton>
              <ToggleButton value="coaching" sx={{ px: 1.5, fontSize: '0.75rem', color: '#A78BFA' }}>Coaching</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {loading ? (
            <PageSkeleton cards={3} header={false} />
          ) : listings.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
              <StorefrontIcon sx={{ fontSize: 56, mb: 2, opacity: 0.2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No listings yet</Typography>
              <Typography variant="body2">Be the first to post a service, job, gig, or coaching offer!</Typography>
              {user && (
                <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate} sx={{ mt: 3, borderRadius: 2 }}>
                  Post the first listing
                </Button>
              )}
            </Box>
          ) : (
            <Grid container spacing={2}>
              {listings.map(l => (
                <Grid key={l.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <ListingCard l={l} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* ── Tab 1: My Listings ── */}
      {tab === 1 && user && (
        <>
          {myListings.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No listings yet</Typography>
              <Typography variant="body2">Post a service, job, or gig to connect with the community.</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ mt: 3, borderRadius: 2 }}>
                Create your first listing
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {myListings.map(l => (
                <Grid key={l.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <ListingCard l={l} mine />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* ── Tab 2: Coaching ── */}
      {tab === 2 && <CoachingMarketplace />}

      {/* ── Create / Edit dialog ── */}
      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editTarget ? 'Edit Listing' : 'Post a New Listing'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth size="small" label="Title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Type *</InputLabel>
              <Select label="Type *" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'service' | 'job' | 'gig' | 'coaching' }))}>
                <MenuItem value="service">Service — I offer a skill or expertise</MenuItem>
                <MenuItem value="job">Job — I&apos;m looking for candidates / collaborators</MenuItem>
                <MenuItem value="gig">Gig — Short freelance project or task</MenuItem>
                <MenuItem value="coaching">Coaching — I offer personal or group coaching</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth size="small" label="Description" multiline rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Domain (optional)</InputLabel>
                  <Select label="Domain (optional)" value={form.domain}
                    onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}>
                    <MenuItem value="">Any domain</MenuItem>
                    {Object.values(Domain).map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Currency</InputLabel>
                  <Select label="Currency" value={form.price_currency}
                    onChange={e => setForm(f => ({ ...f, price_currency: e.target.value as any }))}>
                    <MenuItem value="negotiable">Negotiable</MenuItem>
                    <MenuItem value="free">Free</MenuItem>
                    <MenuItem value="USD">USD ($)</MenuItem>
                    <MenuItem value="PP">⚡ Praxis Points</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField
                  fullWidth size="small" label="Price" type="number"
                  disabled={form.price_currency === 'free' || form.price_currency === 'negotiable'}
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth size="small" label="Tags (comma-separated)"
              placeholder="e.g. React, TypeScript, UI/UX"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            />
            <TextField
              fullWidth size="small" label="Contact / Link"
              placeholder="email, URL, Telegram handle…"
              value={form.contact_info}
              onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained" disabled={saving || !form.title.trim()}
            endIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
            onClick={handleSave}
            sx={{ borderRadius: 2 }}
          >
            {editTarget ? 'Save Changes' : 'Publish'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ServicesPage;
