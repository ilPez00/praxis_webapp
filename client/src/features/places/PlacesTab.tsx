import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Stack, Chip, Grid, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, FormControlLabel,
  Switch, IconButton, Tooltip, Avatar,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PlaceIcon from '@mui/icons-material/Place';
import NearMeIcon from '@mui/icons-material/NearMe';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PeopleIcon from '@mui/icons-material/People';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import GlassCard from '../../components/common/GlassCard';
import LocationMap from '../../components/common/LocationMap';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';

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

// Optional OpenStreetMap link
function MapsFrame({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  return (
    <Box
      component="a"
      href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        color: '#60A5FA', fontSize: '0.75rem', textDecoration: 'none',
        mt: 1,
        '&:hover': { textDecoration: 'underline' },
      }}
    >
      <OpenInNewIcon sx={{ fontSize: 14 }} /> View on OpenStreetMap
    </Box>
  );
}

interface PlacesTabProps {
  currentUserId?: string;
}

const PlacesTab: React.FC<PlacesTabProps> = ({ currentUserId }) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('gym');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formSchedule, setFormSchedule] = useState('');
  const [formRemote, setFormRemote] = useState(false);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const fetchPlaces = useCallback(async (geo?: { lat: number; lng: number }) => {
    try {
      const headers = await getAuthHeader();
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (geo) { params.set('lat', String(geo.lat)); params.set('lng', String(geo.lng)); params.set('radius', '100'); }
      const { data } = await axios.get(`${API_URL}/places?${params}`, { headers });
      setPlaces(Array.isArray(data) ? data : []);
    } catch { setPlaces([]); }
    finally { setLoading(false); }
  }, [filterType]);

  useEffect(() => { fetchPlaces(nearbyMode && userGeo ? userGeo : undefined); }, [fetchPlaces, nearbyMode, userGeo]);

  const handleNearby = () => {
    if (nearbyMode) { setNearbyMode(false); setUserGeo(null); fetchPlaces(); return; }
    if (!navigator.geolocation) { toast.error('Geolocation not supported.'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGeo(geo); setNearbyMode(true); fetchPlaces(geo); setGeoLoading(false);
      },
      () => { toast.error('Location access denied.'); setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const autoFillGeo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setFormLat(String(pos.coords.latitude.toFixed(5))); setFormLng(String(pos.coords.longitude.toFixed(5))); toast.success('Location detected!'); },
      () => toast.error('Location access denied.'),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/places`, {
        name: formName.trim(), type: formType,
        address: formAddress.trim() || undefined, city: formCity.trim() || undefined,
        latitude: formLat ? parseFloat(formLat) : undefined, longitude: formLng ? parseFloat(formLng) : undefined,
        description: formDesc.trim() || undefined, website: formWebsite.trim() || undefined,
        schedule: formSchedule.trim() || undefined,
      }, { headers });
      toast.success('Place added!');
      setDialogOpen(false);
      setFormName(''); setFormType('gym'); setFormAddress(''); setFormCity('');
      setFormLat(''); setFormLng(''); setFormDesc(''); setFormWebsite(''); setFormSchedule(''); setFormRemote(false);
      fetchPlaces(nearbyMode && userGeo ? userGeo : undefined);
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to add place.'); }
    finally { setSaving(false); }
  };

  const handleJoin = async (place: Place) => {
    const headers = await getAuthHeader();
    const isMember = place.members.some(m => m.user_id === currentUserId);
    try {
      if (isMember) {
        await axios.delete(`${API_URL}/places/${place.id}/join`, { headers });
        toast.success('Left place.');
      } else {
        await axios.post(`${API_URL}/places/${place.id}/join`, {}, { headers });
        toast.success('Joined place!');
      }
      fetchPlaces(nearbyMode && userGeo ? userGeo : undefined);
    } catch { toast.error('Failed to update membership.'); }
  };

  const handleDelete = async (id: string) => {
    try {
      const headers = await getAuthHeader();
      await axios.delete(`${API_URL}/places/${id}`, { headers });
      toast.success('Place removed.');
      fetchPlaces(nearbyMode && userGeo ? userGeo : undefined);
    } catch { toast.error('Failed to delete place.'); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      {/* Toolbar */}
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

      {/* Map */}
      <LocationMap
        markers={places
          .filter(p => p.latitude != null && p.longitude != null)
          .map(p => ({
            id: p.id,
            title: p.name,
            subtitle: p.city || p.address || undefined,
            lat: p.latitude!,
            lng: p.longitude!,
          }))}
      />

      {places.length === 0 ? (
        <GlassCard sx={{ p: 5, textAlign: 'center' }}>
          <PlaceIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" fontWeight={700}>No places yet</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
            Add gyms, churches, coworking spaces, museums — any place your community gathers.
          </Typography>
          <Button variant="outlined" sx={{ borderRadius: '10px' }} onClick={() => setDialogOpen(true)}>
            Add the first place
          </Button>
        </GlassCard>
      ) : (
        <Grid container spacing={2}>
          {places.map(place => {
            const cfg = typeConfig(place.type);
            const isMember = place.members.some(m => m.user_id === currentUserId);
            const isOwner = place.owner_id === currentUserId;
            return (
              <Grid key={place.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <GlassCard sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Chip
                      label={cfg.label}
                      size="small"
                      sx={{ bgcolor: `${cfg.color}18`, color: cfg.color, fontWeight: 700, fontSize: '0.72rem' }}
                    />
                    {isOwner && (
                      <Tooltip title="Delete place">
                        <IconButton size="small" onClick={() => handleDelete(place.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.3 }}>{place.name}</Typography>
                    {(place.city || place.address) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PlaceIcon sx={{ fontSize: 12 }} />{place.city || place.address}
                      </Typography>
                    )}
                  </Box>

                  {place.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, fontSize: '0.8125rem' }}>
                      {place.description}
                    </Typography>
                  )}

                  {place.schedule && (
                    <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600 }}>🕐 {place.schedule}</Typography>
                  )}

                  {place.distance_km !== null && (
                    <Chip
                      icon={<NearMeIcon />}
                      label={place.distance_km < 1 ? '<1 km away' : `${place.distance_km} km away`}
                      size="small"
                      sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontSize: '0.7rem', alignSelf: 'flex-start' }}
                    />
                  )}

                  {/* Map preview */}
                  {place.latitude != null && place.longitude != null && (
                    <MapsFrame lat={place.latitude} lng={place.longitude} name={place.name} />
                  )}

                  {/* Footer */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
                      <PeopleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">{place.members.length} member{place.members.length !== 1 ? 's' : ''}</Typography>
                    </Box>
                    {place.website && (
                      <Tooltip title="Visit website">
                        <IconButton
                          size="small"
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Button
                      size="small"
                      variant={isMember ? 'contained' : 'outlined'}
                      onClick={() => handleJoin(place)}
                      sx={{
                        borderRadius: '8px', fontWeight: 700, fontSize: '0.7rem',
                        bgcolor: isMember ? `${cfg.color}22` : 'transparent',
                        color: isMember ? cfg.color : 'text.secondary',
                        borderColor: isMember ? cfg.color : 'rgba(255,255,255,0.12)',
                        '&:hover': { borderColor: cfg.color, color: cfg.color },
                      }}
                    >
                      {isMember ? 'Joined ✓' : 'Join'}
                    </Button>
                  </Box>
                </GlassCard>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Add Place Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlaceIcon sx={{ color: 'primary.main' }} /> Add a Place
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth label="Name *" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Iron Paradise Gym" />
            <FormControl fullWidth>
              <InputLabel>Type *</InputLabel>
              <Select value={formType} label="Type *" onChange={e => setFormType(e.target.value)}>
                {PLACE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField fullWidth label="Description" value={formDesc} onChange={e => setFormDesc(e.target.value)} multiline rows={2} placeholder="What happens here?" />
            <TextField fullWidth label="Address" value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="123 Main St" />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="City" value={formCity} onChange={e => setFormCity(e.target.value)} placeholder="Milan" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Schedule" value={formSchedule} onChange={e => setFormSchedule(e.target.value)} placeholder="Mon–Fri 6am–10pm" />
              </Grid>
            </Grid>
            <TextField fullWidth label="Website" value={formWebsite} onChange={e => setFormWebsite(e.target.value)} placeholder="https://..." />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Coordinates (enables map + "Near me")</Typography>
                <Button size="small" startIcon={<MyLocationIcon />} onClick={autoFillGeo} sx={{ fontSize: '0.72rem' }}>Auto-detect</Button>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth size="small" label="Latitude" value={formLat} onChange={e => setFormLat(e.target.value)} placeholder="45.4654" />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth size="small" label="Longitude" value={formLng} onChange={e => setFormLng(e.target.value)} placeholder="9.1859" />
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !formName.trim()}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineIcon />}
            sx={{ borderRadius: '10px', fontWeight: 800 }}
          >
            {saving ? 'Adding…' : 'Add place'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlacesTab;
