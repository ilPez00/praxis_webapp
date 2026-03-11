import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import BarcodeScanner from 'react-qr-barcode-scanner';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/common/GlassCard';
import LocationMap from '../../components/common/LocationMap';
import {
  Container, Box, Typography, Button, Stack, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Avatar, Tooltip, IconButton,
  MenuItem, List, ListItem, ListItemAvatar, ListItemText,
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
import QrCodeIcon from '@mui/icons-material/QrCode2';
import PeopleIcon from '@mui/icons-material/People';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

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

const EventsPage: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrDialog, setQrDialog] = useState<{ open: boolean; token: string; eventTitle: string; eventId: string }>({ open: false, token: '', eventTitle: '', eventId: '' });
  const [scanDialog, setScanDialog] = useState<{ open: boolean; eventId: string; eventTitle: string }>({ open: false, eventId: '', eventTitle: '' });
  const [scanning, setScanning] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [attendeeDialog, setAttendeeDialog] = useState<{ open: boolean; eventId: string; eventTitle: string; list: any[] }>({ open: false, eventId: '', eventTitle: '', list: [] });
  const [eventType, setEventType] = useState('');

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

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setCurrentUserId(u?.id);
      if (u?.id) {
        supabase.from('profiles').select('is_admin').eq('id', u.id).single()
          .then(({ data }) => setIsAdmin(!!data?.is_admin));
      }
    });
  }, []);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const handleShowQR = async (eventId: string, eventTitle: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/events/${eventId}/checkin-token`, { headers });
      const { token } = res.data as { token: string };
      setQrDialog({ open: true, token, eventTitle, eventId });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not generate check-in QR.');
    }
  };

  const handleScanAttendee = (eventId: string, eventTitle: string) => {
    setScanDialog({ open: true, eventId, eventTitle });
  };

  const processCheckinToken = async (qrValue: string) => {
    if (scanning) return;
    setScanning(true);
    try {
      const url = new URL(qrValue);
      const token = url.searchParams.get('token');
      const eventId = url.searchParams.get('eventId');
      if (!token || !eventId) throw new Error('Invalid QR code.');
      const headers = await getAuthHeader();
      const res = await axios.post(`${API_URL}/events/${eventId}/checkin`, { token }, { headers });
      if (res.data.alreadyCheckedIn) toast.success('Already checked in!', { icon: 'ℹ️' });
      else toast.success('Check-in successful! +50 PP awarded.');
      setScanDialog(s => ({ ...s, open: false }));
    } catch (err: any) {
      toast.error(err.message || 'Check-in failed.');
    } finally {
      setScanning(false);
    }
  };

  const fetchEvents = useCallback(async (geo?: { lat: number; lng: number }) => {
    try {
      const headers = await getAuthHeader();
      const params = geo ? `?lat=${geo.lat}&lng=${geo.lng}&radius=100` : '';
      const res = await axios.get(`${API_URL}/events${params}`, { headers });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleToggleNearby = () => {
    if (nearbyMode) { setNearbyMode(false); setUserGeo(null); fetchEvents(); return; }
    if (!navigator.geolocation) { toast.error('Geolocation not supported.'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGeo(geo); setNearbyMode(true); fetchEvents(geo); setGeoLoading(false);
      },
      () => { toast.error('Location access denied.'); setGeoLoading(false); },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const autoFillGeo = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setFormLat(String(pos.coords.latitude.toFixed(5))); setFormLng(String(pos.coords.longitude.toFixed(5))); toast.success('Detected!'); },
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
    setEventType((event as any).type || '');
    setDialogOpen(true);
  };

  const fetchAttendees = async (eventId: string, eventTitle: string) => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/events/${eventId}/attendees`, { headers });
      setAttendeeDialog({ open: true, eventId, eventTitle, list: res.data });
    } catch {
      toast.error('Failed to load list.');
    }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setEventDate(new Date().toISOString().slice(0, 10)); 
    setEventTime(''); setLocation(''); setCity(''); setFormLat(''); setFormLng('');
    setEventType(''); setEditingEvent(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !eventDate) { toast.error('Title and date required.'); return; }
    setSaving(true);
    try {
      const headers = await getAuthHeader();
      const payload = {
        title: title.trim(), description: description.trim() || undefined,
        eventDate, eventTime: eventTime || undefined,
        location: location.trim() || undefined, city: city.trim() || undefined,
        latitude: formLat ? parseFloat(formLat) : undefined, longitude: formLng ? parseFloat(formLng) : undefined,
        type: eventType || undefined,
      };
      if (editingEvent) {
        await axios.put(`${API_URL}/events/${editingEvent.id}`, payload, { headers });
        toast.success('Updated!');
      } else {
        await axios.post(`${API_URL}/events`, payload, { headers });
        toast.success('Created!');
      }
      setDialogOpen(false);
      resetForm();
      await fetchEvents();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleRsvp = async (eventId: string, status: 'going' | 'maybe' | 'not_going', currentStatus: string | undefined) => {
    if (!currentUserId) return;
    try {
      const headers = await getAuthHeader();
      if (currentStatus === status) await axios.delete(`${API_URL}/events/${eventId}/rsvp`, { headers });
      else await axios.post(`${API_URL}/events/${eventId}/rsvp`, { status }, { headers });
      await fetchEvents();
    } catch { toast.error('Failed to RSVP.'); }
  };

  const handleDelete = async (eventId: string) => {
    try {
      const headers = await getAuthHeader();
      await axios.delete(`${API_URL}/events/${eventId}`, { headers });
      toast.success('Deleted.');
      await fetchEvents();
    } catch { toast.error('Failed to delete.'); }
  };

  const minDateStr = new Date().toISOString().slice(0, 10);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box sx={compact ? {} : { py: 4 }}>
      {!compact && (
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>Events</Typography>
            </Box>
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

          <LocationMap
            userLocation={userGeo || undefined}
            markers={events
              .filter(e => e.latitude != null && e.longitude != null)
              .map(e => ({
                id: e.id,
                title: e.title,
                subtitle: `${formatDate(e.event_date)}${e.city ? ' · ' + e.city : ''}`,
                lat: e.latitude!,
                lng: e.longitude!,
                type: 'event'
              }))}
          />
        </Container>
      )}

      <Container maxWidth={compact ? false : "lg"} sx={compact ? { p: 0 } : {}}>
        {events.length === 0 ? (
          <GlassCard sx={{ p: 6, textAlign: 'center' }}>
            <EventIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700 }}>No upcoming events</Typography>
            {!compact && (
              <Button variant="outlined" sx={{ mt: 3, borderRadius: '10px' }} onClick={() => setDialogOpen(true)}>
                Add Event
              </Button>
            )}
          </GlassCard>
        ) : (
          <Grid container spacing={3}>
            {events.map(event => {
              const myRsvp = event.rsvps?.find(r => r.user_id === currentUserId);
              const going = event.rsvps?.filter(r => r.status === 'going').length ?? 0;
              const canManage = event.creator_id === currentUserId || isAdmin;

              return (
                <Grid key={event.id} size={{ xs: 12, md: 6, lg: 4 }}>
                  <GlassCard sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '8px', px: 1.2, py: 0.4, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <EventIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.7rem' }}>{formatDate(event.event_date)}</Typography>
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
            <TextField select fullWidth label="Event Type" value={eventType} onChange={e => setEventType(e.target.value)}>
              <MenuItem value=""><em>None</em></MenuItem>
              <MenuItem value="Work">Work</MenuItem>
              <MenuItem value="Study">Study</MenuItem>
              <MenuItem value="Fitness">Fitness</MenuItem>
              <MenuItem value="Social">Social</MenuItem>
              <MenuItem value="Performance">Performance</MenuItem>
            </TextField>
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
