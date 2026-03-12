import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Button, Stack, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Avatar, Tooltip, IconButton,
  MenuItem, FormControl, InputLabel, Select,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlaceIcon from '@mui/icons-material/Place';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import NearMeIcon from '@mui/icons-material/NearMe';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FilterListIcon from '@mui/icons-material/FilterList';

import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import { useEvents } from '../../hooks/useFetch';
import GlassCard from '../../components/common/GlassCard';
import LocationMap from '../../components/common/LocationMap';
import { PRAXIS_DOMAINS, getDomainConfig } from '../../types/Domain';

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

interface EventRsvp {
  user_id: string;
  status: 'going' | 'maybe' | 'not_going';
}

interface CalendarEvent {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  created_at: string;
  creator: { id: string; name: string; avatar_url: string | null } | null;
  rsvps: EventRsvp[];
  type: string | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const RSVP_OPTIONS: { status: 'going' | 'maybe' | 'not_going'; label: string; color: string; icon: React.ReactNode }[] = [
  { status: 'going',     label: 'Going',     color: '#10B981', icon: <CheckCircleIcon fontSize="small" /> },
  { status: 'maybe',     label: 'Maybe',     color: '#F59E0B', icon: <HelpOutlineIcon fontSize="small" /> },
  { status: 'not_going', label: 'Not going', color: '#6B7280', icon: <CancelIcon fontSize="small" /> },
];

const EventsPage: React.FC<{ compact?: boolean; hideMap?: boolean }> = ({ compact = false, hideMap = false }) => {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);

  // Optimized fetch using SWR
  const { data: rawEvents = [], loading, mutate: refetchEvents } = useEvents();

  const [filterType, setFilterType] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formType, setFormType] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setCurrentUserId(u?.id);
      if (u?.id) {
        supabase.from('profiles').select('is_admin').eq('id', u.id).single()
          .then(({ data }) => setIsAdmin(!!data?.is_admin));
      }
    });
  }, []);

  const filteredEvents = useMemo(() => {
    let list = Array.isArray(rawEvents) ? rawEvents : [];
    if (filterType) {
      list = list.filter((e: any) => e.type === filterType);
    }
    return list;
  }, [rawEvents, filterType]);

  const handleToggleNearby = () => {
    if (nearbyMode) { 
      setNearbyMode(false); 
      setUserGeo(null); 
      return; 
    }
    if (!navigator.geolocation) { toast.error('Geolocation not supported.'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); 
        setNearbyMode(true); 
        setGeoLoading(false);
      },
      () => { toast.error('Location access denied.'); setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const autoFillGeo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { 
        setFormLat(String(pos.coords.latitude.toFixed(5))); 
        setFormLng(String(pos.coords.longitude.toFixed(5))); 
        toast.success('Detected!'); 
      },
      () => toast.error('Denied.'),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || '');
    setEventDate(event.event_date);
    setEventTime(event.event_time || '');
    setLocation(event.location || '');
    setCity(event.city || '');
    setFormLat(event.latitude?.toString() || '');
    setFormLng(event.longitude?.toString() || '');
    setFormType(event.type || '');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setEventDate(new Date().toISOString().slice(0, 10)); 
    setEventTime(''); setLocation(''); setCity(''); setFormLat(''); setFormLng('');
    setFormType(''); setEditingEvent(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !eventDate) { toast.error('Title and date required.'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(), description: description.trim() || undefined,
        eventDate, eventTime: eventTime || undefined,
        location: location.trim() || undefined, city: city.trim() || undefined,
        latitude: formLat ? parseFloat(formLat) : undefined, longitude: formLng ? parseFloat(formLng) : undefined,
        type: formType || undefined,
      };
      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, payload);
        toast.success('Updated!');
      } else {
        await api.post('/events', payload);
        toast.success('Created!');
      }
      setDialogOpen(false);
      resetForm();
      refetchEvents();
    } catch (err: any) { 
      toast.error(err.response?.data?.message || 'Failed to save.'); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleRsvp = async (eventId: string, status: 'going' | 'maybe' | 'not_going', currentStatus: string | undefined) => {
    if (!currentUserId) return;
    try {
      if (currentStatus === status) {
        await api.delete(`/events/${eventId}/rsvp`);
      } else {
        await api.post(`/events/${eventId}/rsvp`, { status });
      }
      refetchEvents();
    } catch { 
      toast.error('Failed to RSVP.'); 
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${eventId}`);
      toast.success('Deleted.');
      refetchEvents();
    } catch { 
      toast.error('Failed to delete.'); 
    }
  };

  const minDateStr = new Date().toISOString().slice(0, 10);

  if (loading && rawEvents.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={compact ? {} : { py: 4 }}>
      {!compact && (
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 4 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>Events</Typography>
            </Box>
            
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

            <Stack direction="row" spacing={1}>
              <Button
                variant={nearbyMode ? 'contained' : 'outlined'}
                startIcon={geoLoading ? <CircularProgress size={16} color="inherit" /> : <NearMeIcon />}
                onClick={handleToggleNearby}
                sx={{ borderRadius: '12px', fontWeight: 700 }}
              >
                {nearbyMode ? 'Nearby (on)' : 'Near me'}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => setDialogOpen(true)}
                sx={{ borderRadius: '12px', fontWeight: 700 }}
              >
                Create
              </Button>
            </Stack>
          </Box>

          {!hideMap && (
            <LocationMap
              userLocation={userGeo || undefined}
              markers={filteredEvents
                .filter((e: any) => e.latitude != null && e.longitude != null)
                .map((e: any) => ({
                  id: e.id,
                  title: e.title,
                  subtitle: `${formatDate(e.event_date)}${e.city ? ' · ' + e.city : ''}`,
                  lat: e.latitude!,
                  lng: e.longitude!,
                  type: 'event'
                }))}
            />
          )}
        </Container>
      )}

      <Container maxWidth={compact ? false : "lg"} sx={compact ? { p: 0, mt: 2 } : { mt: 4 }}>
        {filteredEvents.length === 0 ? (
          <GlassCard sx={{ p: 6, textAlign: 'center' }}>
            <EventIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No events found</Typography>
            {filterType && (
              <Button variant="text" sx={{ mt: 1 }} onClick={() => setFilterType('')}>
                Clear filters
              </Button>
            )}
          </GlassCard>
        ) : (
          <Grid container spacing={3}>
            {filteredEvents.map((event: CalendarEvent) => {
              const myRsvp = event.rsvps?.find(r => r.user_id === currentUserId);
              const going = event.rsvps?.filter(r => r.status === 'going').length ?? 0;
              const canManage = event.creator_id === currentUserId || isAdmin;
              const dConfig = getDomainConfig(event.type || '');

              return (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={event.id}>
                  <GlassCard sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '8px', px: 1.2, py: 0.4, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <EventIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>{formatDate(event.event_date)}</Typography>
                        </Box>
                        {event.type && (
                          <Chip 
                            label={dConfig.label} 
                            size="small" 
                            sx={{ height: 24, bgcolor: `${dConfig.color}15`, color: dConfig.color, fontWeight: 700, fontSize: '0.65rem' }} 
                          />
                        )}
                      </Box>
                      {canManage && (
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={() => handleEdit(event)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'primary.main' } }}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => handleDelete(event.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon fontSize="small" /></IconButton>
                        </Stack>
                      )}
                    </Box>

                    <Typography variant="h6" component="a" href={`https://www.google.com/search?q=${encodeURIComponent(event.title)}`} target="_blank" rel="noopener noreferrer" sx={{ fontWeight: 800, lineHeight: 1.2, color: 'inherit', textDecoration: 'none', '&:hover': { color: 'primary.main', textDecoration: 'underline' } }}>
                      {event.title}
                    </Typography>

                    {event.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, fontSize: '0.8125rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {event.description}
                      </Typography>
                    )}

                    <Box sx={{ mt: 'auto' }}>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                        {event.event_time && <Chip icon={<AccessTimeIcon />} label={formatTime(event.event_time)} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.05)' }} />}
                        {(event.city || event.location) && <Chip icon={<PlaceIcon />} label={event.city || event.location!} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.05)' }} />}
                      </Stack>

                      {event.latitude != null && event.longitude != null && <MapsFrame lat={event.latitude} lng={event.longitude} name={event.title} />}

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 2 }}>
                        <PeopleIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary"><strong style={{ color: '#10B981' }}>{going}</strong> going</Typography>
                      </Box>

                      <Stack direction="row" spacing={1}>
                        {RSVP_OPTIONS.map(opt => {
                          const selected = myRsvp?.status === opt.status;
                          return (
                            <Button key={opt.status} size="small" variant={selected ? 'contained' : 'outlined'} onClick={() => handleRsvp(event.id, opt.status, myRsvp?.status)} sx={{ flex: 1, borderRadius: '8px', fontWeight: 700, fontSize: '0.65rem', borderColor: selected ? opt.color : 'rgba(255,255,255,0.1)', color: selected ? opt.color : 'text.secondary', bgcolor: selected ? `${opt.color}15` : 'transparent' }}>
                              {opt.label}
                            </Button>
                          );
                        })}
                      </Stack>
                    </Box>
                  </GlassCard>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField fullWidth label="Title *" value={title} onChange={e => setTitle(e.target.value)} />
            
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formType}
                label="Category"
                onChange={e => setFormType(e.target.value)}
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {PRAXIS_DOMAINS.map(d => (
                  <MenuItem key={d.value} value={d.value}>{d.icon} {d.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField fullWidth label="Description" value={description} onChange={e => setDescription(e.target.value)} multiline rows={3} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Date *" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} inputProps={{ min: minDateStr }} InputLabelProps={{ shrink: true }} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Time" type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
            </Grid>
            <TextField fullWidth label="Venue" value={location} onChange={e => setLocation(e.target.value)} />
            <TextField fullWidth label="City" value={city} onChange={e => setCity(e.target.value)} />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">Coordinates</Typography>
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
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : <EventIcon />}>
            {editingEvent ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventsPage;
