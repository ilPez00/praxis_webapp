import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Stack, Chip, Grid, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel,
  IconButton, Tooltip, Avatar, Container,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PlaceIcon from '@mui/icons-material/Place';
import NearMeIcon from '@mui/icons-material/NearMe';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PeopleIcon from '@mui/icons-material/People';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import GlassCard from '../../components/common/GlassCard';
import LocationMap from '../../components/common/LocationMap';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import { usePlaces } from '../../hooks/useFetch';

const PLACE_TYPES = [
  { value: 'gym', label: '🏋️ Gym', color: '#F97316' },
  { value: 'museum', label: '🏛️ Museum', color: '#60A5FA' },
  { value: 'church', label: '⛪ Church', color: '#A78BFA' },
  { value: 'library', label: '📚 Library', color: '#34D399' },
  { value: 'coworking', label: '💼 Coworking', color: '#F59E0B' },
  { value: 'studio', label: '🎨 Studio', color: '#EC4899' },
  { value: 'club', label: '🎵 Club / Bar', color: '#8B5CF6' },
  { value: 'park', label: '🌳 Park', color: '#10B981' },
  { value: 'cafe', label: '☕ Café', color: '#D97706' },
  { value: 'other', label: '📍 Other', color: '#6B7280' },
];

const typeConfig = (type: string) =>
  PLACE_TYPES.find(t => t.value === type) ?? { value: type, label: `📍 ${type}`, color: '#6B7280' };

interface Place {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  website: string | null;
  schedule: string | null;
  distance_km: number | null;
  created_at: string;
  owner: { id: string; name: string; avatar_url: string | null } | null;
  members: { user_id: string }[];
}

function MapsFrame({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(name)}`;
  return (
    <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
      <Box
        component="a"
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          color: '#60A5FA', fontSize: '0.75rem', textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' }
        }}
      >
        <PlaceIcon sx={{ fontSize: 14 }} />
        Map
      </Box>
      <Box
        component="a"
        href={googleSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          color: '#60A5FA', fontSize: '0.75rem', textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' }
        }}
      >
        <OpenInNewIcon sx={{ fontSize: 14 }} />
        Search
      </Box>
    </Stack>
  );
}

interface PlacesTabProps {
  currentUserId?: string;
  compact?: boolean;
}

const PlacesTab: React.FC<PlacesTabProps> = ({ currentUserId, compact = false }) => {
  const [filterType, setFilterType] = useState('');
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number } | null>(null);

  // Optimized fetch using SWR
  const { data: places = [], loading, mutate: refetchPlaces } = usePlaces(
    filterType,
    nearbyMode && userGeo ? userGeo : undefined
  );

  const [geoLoading, setGeoLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('gym');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formSchedule, setFormSchedule] = useState('');

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!currentUserId) return;
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', currentUserId).single();
      setIsAdmin(!!data?.is_admin);
    };
    checkAdmin();
  }, [currentUserId]);

  const handleNearby = () => {
    if (nearbyMode) {
      setNearbyMode(false);
      setUserGeo(null);
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearbyMode(true);
        setGeoLoading(false);
      },
      () => {
        toast.error('Location access denied.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const autoFillGeo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLat(String(pos.coords.latitude.toFixed(5)));
        setFormLng(String(pos.coords.longitude.toFixed(5)));
        toast.success('Location detected!');
      },
      () => toast.error('Location access denied.'),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const openEditDialog = (place: Place) => {
    setEditingId(place.id);
    setFormName(place.name);
    setFormType(place.type);
    setFormAddress(place.address || '');
    setFormCity(place.city || '');
    setFormLat(place.latitude ? String(place.latitude) : '');
    setFormLng(place.longitude ? String(place.longitude) : '');
    setFormDesc(place.description || '');
    setFormWebsite(place.website || '');
    setFormSchedule(place.schedule || '');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName(''); setFormType('gym'); setFormAddress(''); setFormCity('');
    setFormLat(''); setFormLng(''); setFormDesc(''); setFormWebsite(''); setFormSchedule('');
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        type: formType,
        address: formAddress.trim() || null,
        city: formCity.trim() || null,
        latitude: formLat ? parseFloat(formLat) : null,
        longitude: formLng ? parseFloat(formLng) : null,
        description: formDesc.trim() || null,
        website: formWebsite.trim() || null,
        schedule: formSchedule.trim() || null,
      };

      if (editingId) {
        await api.put(`/places/${editingId}`, payload);
        toast.success('Place updated!');
      } else {
        await api.post('/places', payload);
        toast.success('Place added!');
      }

      setDialogOpen(false);
      resetForm();
      refetchPlaces();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save place.');
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async (place: Place) => {
    const isMember = place.members.some(m => m.user_id === currentUserId);
    try {
      if (isMember) {
        await api.delete(`/places/${place.id}/join`);
        toast.success('Left place.');
      } else {
        await api.post(`/places/${place.id}/join`);
        toast.success('Joined place!');
      }
      refetchPlaces();
    } catch {
      toast.error('Failed to update membership.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this place?')) return;
    try {
      await api.delete(`/places/${id}`);
      toast.success('Place removed.');
      refetchPlaces();
    } catch {
      toast.error('Failed to delete place.');
    }
  };

  if (loading && places.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={compact ? {} : { py: 4 }}>
      {!compact && (
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Type</InputLabel>
              <Select value={filterType} label="Type" onChange={e => setFilterType(e.target.value)} sx={{ borderRadius: '10px' }}>
                <MenuItem value="">All types</MenuItem>
                {PLACE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Button
              variant={nearbyMode ? 'contained' : 'outlined'}
              size="small"
              startIcon={geoLoading ? <CircularProgress size={14} color="inherit" /> : <NearMeIcon />}
              onClick={handleNearby}
              disabled={geoLoading}
              sx={{ borderRadius: '10px', fontWeight: 700 }}
            >
              {nearbyMode ? 'Nearby (on)' : 'Near me'}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              size="small"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ borderRadius: '10px', fontWeight: 700 }}
            >
              Add place
            </Button>
          </Box>

          <LocationMap
            userLocation={userGeo || undefined}
            markers={places
              .filter((p: any) => p.latitude != null && p.longitude != null)
              .map((p: any) => ({
                id: p.id,
                title: p.name,
                subtitle: p.city || p.address || undefined,
                lat: p.latitude!,
                lng: p.longitude!,
                type: 'place'
              }))}
          />
        </Container>
      )}

      <Container maxWidth={compact ? false : "lg"} sx={compact ? { p: 0 } : {}}>
        {places.length === 0 ? (
          <GlassCard sx={{ p: 5, textAlign: 'center' }}>
            <PlaceIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" fontWeight={700}>No places yet</Typography>
            {!compact && (
              <Button variant="outlined" sx={{ borderRadius: '10px', mt: 2 }} onClick={() => setDialogOpen(true)}>
                Add the first place
              </Button>
            )}
          </GlassCard>
        ) : (
          <Grid container spacing={2}>
            {places.map((place: Place) => {
              const cfg = typeConfig(place.type);
              const isMember = place.members.some(m => m.user_id === currentUserId);
              const isOwner = place.owner_id === currentUserId;
              const canManage = isOwner || isAdmin;
              return (
                <Grid key={place.id} item xs={12} sm={6} md={4}>
                  <GlassCard sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Chip
                        label={cfg.label}
                        size="small"
                        sx={{ bgcolor: `${cfg.color}18`, color: cfg.color, fontWeight: 700, fontSize: '0.72rem' }}
                      />
                      {canManage && (
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={() => openEditDialog(place)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'primary.main' } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDelete(place.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </Box>

                    <Typography
                      variant="h6"
                      component="a"
                      href={`https://www.google.com/search?q=${encodeURIComponent(place.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ fontWeight: 800, lineHeight: 1.2, color: 'inherit', textDecoration: 'none', '&:hover': { color: 'primary.main', textDecoration: 'underline' } }}
                    >
                      {place.name}
                    </Typography>

                    {(place.city || place.address) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PlaceIcon sx={{ fontSize: 12 }} />{place.city || place.address}
                      </Typography>
                    )}

                    {place.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, fontSize: '0.8125rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {place.description}
                      </Typography>
                    )}

                    <Box sx={{ mt: 'auto' }}>
                      {place.schedule && (
                        <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600, display: 'block', mb: 1 }}>🕐 {place.schedule}</Typography>
                      )}

                      {place.latitude != null && place.longitude != null && (
                        <MapsFrame lat={place.latitude} lng={place.longitude} name={place.name} />
                      )}

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
                          <PeopleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">{place.members.length}</Typography>
                        </Box>
                        <Button
                          size="small"
                          variant={isMember ? 'contained' : 'outlined'}
                          onClick={() => handleJoin(place)}
                          sx={{
                            borderRadius: '8px', fontWeight: 700, fontSize: '0.7rem',
                            bgcolor: isMember ? `${cfg.color}22` : 'transparent',
                            color: isMember ? cfg.color : 'text.secondary',
                            borderColor: isMember ? cfg.color : 'rgba(255,255,255,0.12)',
                          }}
                        >
                          {isMember ? 'Joined' : 'Join'}
                        </Button>
                      </Box>
                    </Box>
                  </GlassCard>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); resetForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlaceIcon sx={{ color: 'primary.main' }} /> {editingId ? 'Edit Place' : 'Add a Place'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth label="Name *" value={formName} onChange={e => setFormName(e.target.value)} />
            <FormControl fullWidth>
              <InputLabel>Type *</InputLabel>
              <Select value={formType} label="Type *" onChange={e => setFormType(e.target.value)}>
                {PLACE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth label="Description" value={formDesc} onChange={e => setFormDesc(e.target.value)} multiline rows={2} />
            <TextField fullWidth label="Address" value={formAddress} onChange={e => setFormAddress(e.target.value)} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="City" value={formCity} onChange={e => setFormCity(e.target.value)} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Schedule" value={formSchedule} onChange={e => setFormSchedule(e.target.value)} /></Grid>
            </Grid>
            <TextField fullWidth label="Website" value={formWebsite} onChange={e => setFormWebsite(e.target.value)} />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Location</Typography>
                <Button size="small" startIcon={<MyLocationIcon />} onClick={autoFillGeo}>Detect</Button>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={6}><TextField fullWidth size="small" label="Lat" value={formLat} onChange={e => setFormLat(e.target.value)} /></Grid>
                <Grid item xs={6}><TextField fullWidth size="small" label="Lng" value={formLng} onChange={e => setFormLng(e.target.value)} /></Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <PlaceIcon />}>
            {editingId ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlacesTab;
