import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Button, Stack, Chip, Grid, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
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
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import ShareIcon from '@mui/icons-material/Share';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import GlassCard from '../../components/common/GlassCard';
import ShareDialog from '../../components/common/ShareDialog';
import LocationMap from '../../components/common/LocationMap';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import { PRAXIS_DOMAINS, getDomainConfig } from '../../types/Domain';

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
  hideMap?: boolean;
}

const PlacesTab: React.FC<PlacesTabProps> = ({ currentUserId, compact = false, hideMap = false }) => {
  const [searchParams] = useSearchParams();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [sharePlace, setSharePlace] = useState<Place | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formSchedule, setFormSchedule] = useState('');
  
  // Bookmark place state
  const [bookmarkName, setBookmarkName] = useState('');
  const [bookmarkType, setBookmarkType] = useState('personal');
  const [bookmarkDesc, setBookmarkDesc] = useState('');
  const [bookmarkCity, setBookmarkCity] = useState('');
  const [bookmarkLat, setBookmarkLat] = useState('');
  const [bookmarkLng, setBookmarkLng] = useState('');
  const [bookmarkPrivate, setBookmarkPrivate] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!currentUserId) return;
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', currentUserId).single();
      setIsAdmin(!!data?.is_admin);
    };
    checkAdmin();
  }, [currentUserId]);

  // Auto-detect user location on mount (silent — no error toast)
  useEffect(() => {
    if (userGeo || hideMap) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { /* silent fail — map will center on places instead */ },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect bookmark action from URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'bookmark') {
      setBookmarkDialogOpen(true);
      // Auto-fill location if available
      if (userGeo) {
        setBookmarkLat(userGeo.lat.toFixed(5));
        setBookmarkLng(userGeo.lng.toFixed(5));
      }
    }
  }, [searchParams, userGeo]);

  const fetchPlaces = useCallback(async (geo?: { lat: number; lng: number }) => {
    try {
      const params = new URLSearchParams();
      // Only filter by type on the backend if it's an exact match
      // But we will also use frontend filtering for better responsiveness
      if (filterType) params.set('type', filterType);
      if (geo) { params.set('lat', String(geo.lat)); params.set('lng', String(geo.lng)); params.set('radius', '100'); }
      const { data } = await api.get(`/places?${params}`);
      setPlaces(Array.isArray(data) ? data : []);
    } catch { setPlaces([]); }
    finally { setLoading(false); }
  }, [filterType]);

  // Always pass geo if available — backend returns 10 closest when geo is provided
  useEffect(() => { fetchPlaces(userGeo || undefined); }, [fetchPlaces, userGeo]);

  const filteredPlaces = useMemo(() => {
    if (!filterType) return places;
    return places.filter(p => p.type === filterType);
  }, [places, filterType]);

  const handleNearby = () => {
    if (nearbyMode) { setNearbyMode(false); return; }
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

  const openEditDialog = (place: Place) => {
    setEditingId(place.id);
    setFormName(place.name);
    setFormType(place.type || '');
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
    setFormName(''); setFormType(''); setFormAddress(''); setFormCity('');
    setFormLat(''); setFormLng(''); setFormDesc(''); setFormWebsite(''); setFormSchedule('');
  };

  const resetBookmarkForm = () => {
    setBookmarkName('');
    setBookmarkType('personal');
    setBookmarkDesc('');
    setBookmarkCity('');
    setBookmarkLat('');
    setBookmarkLng('');
    setBookmarkPrivate(true);
  };

  const handleBookmarkSave = async () => {
    if (!bookmarkName.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: bookmarkName.trim(),
        type: bookmarkType || 'personal',
        description: bookmarkDesc.trim() || null,
        city: bookmarkCity.trim() || null,
        latitude: bookmarkLat ? parseFloat(bookmarkLat) : null,
        longitude: bookmarkLng ? parseFloat(bookmarkLng) : null,
        is_private: bookmarkPrivate,
        owner_id: currentUserId,
      };

      await api.post('/places', payload);
      toast.success('Place bookmarked!');
      setBookmarkDialogOpen(false);
      resetBookmarkForm();
      fetchPlaces();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to bookmark place');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(), type: formType || null,
        address: formAddress.trim() || null, city: formCity.trim() || null,
        latitude: formLat ? parseFloat(formLat) : null, longitude: formLng ? parseFloat(formLng) : null,
        description: formDesc.trim() || null, website: formWebsite.trim() || null,
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
      fetchPlaces(nearbyMode && userGeo ? userGeo : undefined);
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to save place.'); }
    finally { setSaving(false); }
  };

  const handleJoin = async (place: Place) => {
    const isMember = place.members.some(m => m.user_id === currentUserId);
    try {
      if (isMember) {
        await api.delete(`/places/${place.id}/join`);
        toast.success('Left place.');
      } else {
        await api.post(`/places/${place.id}/join`, {});
        toast.success('Joined place!');
      }
      fetchPlaces(nearbyMode && userGeo ? userGeo : undefined);
    } catch { toast.error('Failed to update membership.'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this place?')) return;
    try {
      await api.delete(`/places/${id}`);
      toast.success('Place removed.');
      fetchPlaces(nearbyMode && userGeo ? userGeo : undefined);
    } catch { toast.error('Failed to delete place.'); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box sx={compact ? {} : { py: 4 }}>
      {!compact && (
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Category</InputLabel>
              <Select 
                value={filterType} 
                label="Category" 
                onChange={e => setFilterType(e.target.value)} 
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value="">All categories</MenuItem>
                {PRAXIS_DOMAINS.map(d => (
                  <MenuItem key={d.value} value={d.value}>{d.icon} {d.label}</MenuItem>
                ))}
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

          {!hideMap && (
            <LocationMap
              userLocation={userGeo || undefined}
              markers={filteredPlaces
                .filter(p => p.latitude != null && p.longitude != null)
                .map(p => ({
                  id: p.id,
                  title: p.name,
                  subtitle: p.city || p.address || undefined,
                  lat: p.latitude!,
                  lng: p.longitude!,
                  type: 'place'
                }))}
            />
          )}
        </Container>
      )}

      <Container maxWidth={compact ? false : "lg"} sx={compact ? { p: 0 } : {}}>
        {filteredPlaces.length === 0 ? (
          <GlassCard sx={{ p: 5, textAlign: 'center' }}>
            <PlaceIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" fontWeight={700}>No places found</Typography>
            {filterType && (
              <Button variant="text" sx={{ mt: 1 }} onClick={() => setFilterType('')}>
                Clear filters
              </Button>
            )}
          </GlassCard>
        ) : (
          <Grid container spacing={2}>
            {filteredPlaces.map(place => {
              const dConfig = getDomainConfig(place.type || '');
              const isMember = place.members.some(m => m.user_id === currentUserId);
              const isOwner = place.owner_id === currentUserId;
              const canManage = isOwner || isAdmin;
              return (
                <Grid key={place.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <GlassCard sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Chip
                        label={dConfig.label}
                        size="small"
                        sx={{ bgcolor: `${dConfig.color}15`, color: dConfig.color, fontWeight: 700, fontSize: '0.72rem' }}
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
                        <Typography variant="caption" sx={{ color: dConfig.color, fontWeight: 600, display: 'block', mb: 1 }}>🕐 {place.schedule}</Typography>
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
                            bgcolor: isMember ? `${dConfig.color}22` : 'transparent',
                            color: isMember ? dConfig.color : 'text.secondary',
                            borderColor: isMember ? dConfig.color : 'rgba(255,255,255,0.12)',
                          }}
                        >
                          {isMember ? 'Joined' : 'Join'}
                        </Button>
                        <Tooltip title="Save to Diary">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSharePlace(place); }} sx={{ color: '#A78BFA' }}>
                            <BookmarkAddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </GlassCard>
                </Grid>
              );
            })}
          </Grid>
        )}

        <ShareDialog
          open={!!sharePlace}
          onClose={() => setSharePlace(null)}
          sourceTable="places"
          sourceId={sharePlace?.id || ''}
          title={sharePlace?.name}
          content={sharePlace?.description || ''}
        />
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
              <InputLabel>Category</InputLabel>
              <Select value={formType} label="Category" onChange={e => setFormType(e.target.value)}>
                <MenuItem value=""><em>None</em></MenuItem>
                {PRAXIS_DOMAINS.map(d => (
                  <MenuItem key={d.value} value={d.value}>{d.icon} {d.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField fullWidth label="Description" value={formDesc} onChange={e => setFormDesc(e.target.value)} multiline rows={2} />
            <TextField fullWidth label="Address" value={formAddress} onChange={e => setFormAddress(e.target.value)} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="City" value={formCity} onChange={e => setFormCity(e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Schedule" value={formSchedule} onChange={e => setFormSchedule(e.target.value)} /></Grid>
            </Grid>
            <TextField fullWidth label="Website" value={formWebsite} onChange={e => setFormWebsite(e.target.value)} />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Location</Typography>
                <Button size="small" startIcon={<MyLocationIcon />} onClick={autoFillGeo}>Detect</Button>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Lat" value={formLat} onChange={e => setFormLat(e.target.value)} /></Grid>
                <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Lng" value={formLng} onChange={e => setFormLng(e.target.value)} /></Grid>
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

      {/* Bookmark Place Dialog */}
      <Dialog open={bookmarkDialogOpen} onClose={() => { setBookmarkDialogOpen(false); resetBookmarkForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlaceIcon sx={{ color: 'primary.main' }} /> Bookmark Place
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Save a personal place you can keep private or share
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField 
              fullWidth 
              label="Place Name *" 
              value={bookmarkName} 
              onChange={e => setBookmarkName(e.target.value)} 
              placeholder="e.g., My Favorite Cafe, Home Gym, Study Spot"
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={bookmarkType} label="Type" onChange={e => setBookmarkType(e.target.value)}>
                <MenuItem value="personal">📍 Personal</MenuItem>
                <MenuItem value="cafe">☕ Cafe</MenuItem>
                <MenuItem value="gym">💪 Gym</MenuItem>
                <MenuItem value="park">🌳 Park</MenuItem>
                <MenuItem value="library">📚 Library</MenuItem>
                <MenuItem value="coworking">💼 Coworking</MenuItem>
                <MenuItem value="restaurant">🍽️ Restaurant</MenuItem>
                <MenuItem value="other">🏷️ Other</MenuItem>
              </Select>
            </FormControl>
            <TextField 
              fullWidth 
              label="Description" 
              value={bookmarkDesc} 
              onChange={e => setBookmarkDesc(e.target.value)} 
              multiline 
              rows={2}
              placeholder="What makes this place special?"
            />
            <TextField 
              fullWidth 
              label="City" 
              value={bookmarkCity} 
              onChange={e => setBookmarkCity(e.target.value)} 
            />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Location (optional)</Typography>
                <Button 
                  size="small" 
                  startIcon={geoLoading ? <CircularProgress size={14} /> : <MyLocationIcon />} 
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error('Geolocation not supported by your browser');
                      return;
                    }
                    setGeoLoading(true);
                    const onSuccess = (pos: GeolocationPosition) => {
                      const lat = pos.coords.latitude.toFixed(5);
                      const lng = pos.coords.longitude.toFixed(5);
                      setBookmarkLat(lat);
                      setBookmarkLng(lng);
                      setUserGeo({ lat: parseFloat(lat), lng: parseFloat(lng) });
                      setGeoLoading(false);
                      toast.success('Location detected!');
                    };
                    const onError = (err: GeolocationPositionError) => {
                      // If high-accuracy failed, retry with low accuracy
                      if (err.code === 2) {
                        navigator.geolocation.getCurrentPosition(
                          onSuccess,
                          () => { setGeoLoading(false); toast('Location not available — you can type coordinates manually.', { icon: '📍' }); },
                          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
                        );
                        return;
                      }
                      setGeoLoading(false);
                      if (err.code === 1) {
                        toast.error('Location permission denied. Enable it in browser settings.');
                      } else {
                        toast('Location timed out — you can enter coordinates manually.', { icon: '📍' });
                      }
                    };
                    navigator.geolocation.getCurrentPosition(
                      onSuccess,
                      onError,
                      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
                    );
                  }}
                  disabled={geoLoading}
                >
                  {geoLoading ? 'Detecting...' : 'Detect'}
                </Button>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Latitude" value={bookmarkLat} onChange={e => setBookmarkLat(e.target.value)} /></Grid>
                <Grid size={{ xs: 6 }}><TextField fullWidth size="small" label="Longitude" value={bookmarkLng} onChange={e => setBookmarkLng(e.target.value)} /></Grid>
              </Grid>
            </Box>
            <FormControlLabel
              control={
                <Switch 
                  checked={bookmarkPrivate} 
                  onChange={(e) => setBookmarkPrivate(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {bookmarkPrivate ? <LockIcon fontSize="small" /> : <PublicIcon fontSize="small" />}
                  <Typography variant="body2" fontWeight={600}>
                    {bookmarkPrivate ? 'Private (only I can see)' : 'Public (visible to everyone)'}
                  </Typography>
                </Box>
              }
            />
            <Box sx={{ p: 2, bgcolor: 'rgba(139,92,246,0.08)', borderRadius: 2, border: '1px solid rgba(139,92,246,0.2)' }}>
              <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700, display: 'block', mb: 1 }}>
                💡 What can you do with bookmarked places?
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                • Keep personal spots private (home gym, favorite study spot)
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                • Share with your accountability partner
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                • Make public to help the community
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => { setBookmarkDialogOpen(false); resetBookmarkForm(); }}>Cancel</Button>
          <Button variant="contained" onClick={handleBookmarkSave} disabled={saving || !bookmarkName.trim()} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <PlaceIcon />}>
            {saving ? 'Saving...' : 'Bookmark Place'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlacesTab;
