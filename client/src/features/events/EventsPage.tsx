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
import QrCodeIcon from '@mui/icons-material/QrCode2';
import PeopleIcon from '@mui/icons-material/People';

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

const EventsPage: React.FC = () => {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrDialog, setQrDialog] = useState<{ open: boolean; token: string; eventTitle: string; eventId: string }>({ open: false, token: '', eventTitle: '', eventId: '' });
  const [scanDialog, setScanDialog] = useState<{ open: boolean; eventId: string; eventTitle: string }>({ open: false, eventId: '', eventTitle: '' });
  const [scanning, setScanning] = useState(false);

  // Geo filter
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Form
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
      // Expecting URL format: .../events/checkin?token=xxx&eventId=yyy
      const url = new URL(qrValue);
      const token = url.searchParams.get('token');
      const eventId = url.searchParams.get('eventId');

      if (!token || !eventId) throw new Error('Invalid QR code format.');
      if (eventId !== scanDialog.eventId) throw new Error('QR code is for a different event.');

      const headers = await getAuthHeader();
      const res = await axios.post(`${API_URL}/events/${eventId}/checkin`, { token }, { headers });
      
      if (res.data.alreadyCheckedIn) {
        toast.success('Attendee already checked in!', { icon: 'ℹ️' });
      } else {
        toast.success('Check-in successful! +50 PP awarded.');
      }
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
    if (nearbyMode) {
      setNearbyMode(false);
      setUserGeo(null);
      fetchEvents();
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGeo(geo);
        setNearbyMode(true);
        fetchEvents(geo);
        setGeoLoading(false);
      },
      () => {
        toast.error('Location access denied.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const autoFillGeo = () => {
    if (!navigator.geolocation) return;
    toast.loading('Detecting location…', { id: 'geo' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLat(String(pos.coords.latitude.toFixed(5)));
        setFormLng(String(pos.coords.longitude.toFixed(5)));
        toast.success('Location detected!', { id: 'geo' });
      },
      () => toast.error('Location access denied.', { id: 'geo' }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handleCreate = async () => {
    if (!title.trim() || !eventDate) {
      toast.error('Title and date are required.');
      return;
    }
    setSaving(true);
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/events`, {
        title: title.trim(),
        description: description.trim() || undefined,
        eventDate,
        eventTime: eventTime || undefined,
        location: location.trim() || undefined,
        city: city.trim() || undefined,
        latitude: formLat ? parseFloat(formLat) : undefined,
        longitude: formLng ? parseFloat(formLng) : undefined,
      }, { headers });
      toast.success('Event created!');
      setDialogOpen(false);
      setTitle(''); setDescription(''); setEventDate(''); setEventTime(''); setLocation('');
      setCity(''); setFormLat(''); setFormLng('');
      await fetchEvents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  const handleRsvp = async (eventId: string, status: 'going' | 'maybe' | 'not_going', currentStatus: string | undefined) => {
    if (!currentUserId) return;
    try {
      const headers = await getAuthHeader();
      if (currentStatus === status) {
        // Toggle off
        await axios.delete(`${API_URL}/events/${eventId}/rsvp`, { headers });
      } else {
        await axios.post(`${API_URL}/events/${eventId}/rsvp`, { status }, { headers });
      }
      await fetchEvents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update RSVP.');
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      const headers = await getAuthHeader();
      await axios.delete(`${API_URL}/events/${eventId}`, { headers });
      toast.success('Event deleted.');
      await fetchEvents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete event.');
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 0);
  const minDateStr = minDate.toISOString().slice(0, 10);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
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
            <Typography variant="h4" sx={{ fontWeight: 900 }}>Events</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Upcoming community events — create one and invite your accountability network.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant={nearbyMode ? 'contained' : 'outlined'}
              startIcon={geoLoading ? <CircularProgress size={16} color="inherit" /> : <NearMeIcon />}
              onClick={handleToggleNearby}
              disabled={geoLoading}
              sx={{ borderRadius: '12px', fontWeight: 700 }}
            >
              {nearbyMode ? 'Nearby (on)' : 'Near me'}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ borderRadius: '12px', fontWeight: 700, px: 3 }}
            >
              Create Event
            </Button>
          </Stack>
        </Box>

        {/* Map */}
        <LocationMap
          markers={events
            .filter(e => e.latitude != null && e.longitude != null)
            .map(e => ({
              id: e.id,
              title: e.title,
              subtitle: `${formatDate(e.event_date)}${e.city ? ' · ' + e.city : ''}`,
              lat: e.latitude!,
              lng: e.longitude!,
            }))}
        />

        {/* Events grid */}
        {events.length === 0 ? (
          <GlassCard sx={{ p: 6, textAlign: 'center' }}>
            <EventIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 700, mb: 1 }}>No upcoming events</Typography>
            <Typography variant="body2" color="text.disabled">
              Be the first to create an event for your community.
            </Typography>
            <Button variant="outlined" sx={{ mt: 3, borderRadius: '10px' }} onClick={() => setDialogOpen(true)}>
              Create Event
            </Button>
          </GlassCard>
        ) : (
          <Grid container spacing={3}>
            {events.map(event => {
              const myRsvp = event.rsvps?.find(r => r.user_id === currentUserId);
              const going = event.rsvps?.filter(r => r.status === 'going').length ?? 0;
              const maybe = event.rsvps?.filter(r => r.status === 'maybe').length ?? 0;
              const isCreator = event.creator_id === currentUserId;
              const canManage = isCreator || isAdmin;

              return (
                <Grid key={event.id} size={{ xs: 12, md: 6, lg: 4 }}>
                  <GlassCard sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Date badge + delete */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Box sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        borderRadius: '10px',
                        px: 1.5,
                        py: 0.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}>
                        <EventIcon sx={{ fontSize: 14 }} />
                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.75rem' }}>
                          {formatDate(event.event_date)}
                        </Typography>
                      </Box>
                      {canManage && (
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Show Check-in QR (for you to show)">
                            <IconButton size="small" onClick={() => handleShowQR(event.id, event.title)} sx={{ opacity: 0.6, '&:hover': { opacity: 1, color: '#10B981' } }}>
                              <QrCodeIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Scan Attendee QR (you scan them)">
                            <IconButton size="small" onClick={() => handleScanAttendee(event.id, event.title)} sx={{ opacity: 0.6, '&:hover': { opacity: 1, color: '#3B82F6' } }}>
                              <MyLocationIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete event">
                            <IconButton size="small" onClick={() => handleDelete(event.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </Box>

                    {/* Title */}
                    <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.3 }}>
                      {event.title}
                    </Typography>

                    {/* Description */}
                    {event.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                        {event.description}
                      </Typography>
                    )}

                    {/* Meta chips */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {event.event_time && (
                        <Chip
                          icon={<AccessTimeIcon />}
                          label={formatTime(event.event_time)}
                          size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}
                        />
                      )}
                      {(event.city || event.location) && (
                        <Chip
                          icon={<PlaceIcon />}
                          label={event.city || event.location!}
                          size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}
                        />
                      )}
                      {event.distance_km !== null && (
                        <Chip
                          icon={<NearMeIcon />}
                          label={event.distance_km < 1 ? '<1 km away' : `${event.distance_km} km away`}
                          size="small"
                          sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#3B82F6', fontSize: '0.7rem' }}
                        />
                      )}
                    </Stack>

                    {/* Attendee counts */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <PeopleIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        <strong style={{ color: '#10B981' }}>{going}</strong> going
                        {maybe > 0 && <> · <strong style={{ color: '#F59E0B' }}>{maybe}</strong> maybe</>}
                      </Typography>
                      {event.creator && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                          <Avatar sx={{ width: 18, height: 18, fontSize: '0.6rem' }} src={event.creator.avatar_url ?? undefined}>
                            {event.creator.name?.[0]}
                          </Avatar>
                          <Typography variant="caption" color="text.disabled" noWrap>
                            {event.creator.name}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {/* RSVP buttons */}
                    <Stack direction="row" spacing={1}>
                      {RSVP_OPTIONS.map(opt => {
                        const selected = myRsvp?.status === opt.status;
                        return (
                          <Button
                            key={opt.status}
                            size="small"
                            variant={selected ? 'contained' : 'outlined'}
                            startIcon={opt.icon}
                            onClick={() => handleRsvp(event.id, opt.status, myRsvp?.status)}
                            sx={{
                              flex: 1,
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              borderColor: selected ? opt.color : 'rgba(255,255,255,0.1)',
                              bgcolor: selected ? `${opt.color}22` : 'transparent',
                              color: selected ? opt.color : 'text.secondary',
                              '&:hover': { borderColor: opt.color, color: opt.color, bgcolor: `${opt.color}11` },
                            }}
                          >
                            {opt.label}
                          </Button>
                        );
                      })}
                    </Stack>
                  </GlassCard>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>

      {/* Check-in QR Dialog */}
      <Dialog open={qrDialog.open} onClose={() => setQrDialog(q => ({ ...q, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center' }}>
          Check-in QR
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{qrDialog.eventTitle}</Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pb: 3 }}>
          <Box sx={{ bgcolor: '#fff', p: 2, borderRadius: 2 }}>
            <QRCodeSVG
              value={`${window.location.origin}/events/checkin?token=${qrDialog.token}&eventId=${qrDialog.eventId}`}
              size={220}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Attendees scan this code to check in and receive +50 PP.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button onClick={() => setQrDialog(q => ({ ...q, open: false }))} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>

      {/* Scan Attendee Dialog */}
      <Dialog open={scanDialog.open} onClose={() => setScanDialog(s => ({ ...s, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center' }}>
          Scan Attendee QR
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{scanDialog.eventTitle}</Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pb: 3 }}>
          <Box sx={{ width: '100%', maxWidth: 320, height: 240, bgcolor: '#000', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <BarcodeScanner
              onUpdate={(_err, result) => {
                if (result) processCheckinToken(result.getText());
              }}
              width="100%"
              height="100%"
            />
            {scanning && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Point your camera at the attendee's check-in QR code.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button onClick={() => setScanDialog(s => ({ ...s, open: false }))} variant="outlined">Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon sx={{ color: 'primary.main' }} />
            Create Event
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Title *"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Morning run at Central Park"
            />
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={3}
              placeholder="What's this event about?"
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Date *"
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  inputProps={{ min: minDateStr }}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Time"
                  type="time"
                  value={eventTime}
                  onChange={e => setEventTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              label="Venue / Location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Zoom, Central Park, Discord #voice"
            />
            <TextField
              fullWidth
              label="City"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Milan, London, Remote"
              helperText="Shown on the card — helps people find local events"
            />
            {/* Geo coordinates — optional, enables geo-search */}
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Geo coordinates (optional — enables "Near me" filter)
                </Typography>
                <Button size="small" startIcon={<MyLocationIcon />} onClick={autoFillGeo} sx={{ fontSize: '0.72rem' }}>
                  Detect
                </Button>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="Latitude"
                    value={formLat}
                    onChange={e => setFormLat(e.target.value)}
                    placeholder="e.g. 45.4654"
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="Longitude"
                    value={formLng}
                    onChange={e => setFormLng(e.target.value)}
                    placeholder="e.g. 9.1859"
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: '10px' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving || !title.trim() || !eventDate}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineIcon />}
            sx={{ borderRadius: '10px', fontWeight: 800, px: 3 }}
          >
            {saving ? 'Creating…' : 'Create Event'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventsPage;
