import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/common/GlassCard';
import {
  Container, Box, Typography, Button, Stack, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Avatar, Tooltip, IconButton,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlaceIcon from '@mui/icons-material/Place';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
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
  created_at: string;
  creator: { id: string; full_name: string; avatar_url: string | null } | null;
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

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => setCurrentUserId(u?.id));
  }, []);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const fetchEvents = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/events`, { headers });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

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
      }, { headers });
      toast.success('Event created!');
      setDialogOpen(false);
      setTitle(''); setDescription(''); setEventDate(''); setEventTime(''); setLocation('');
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
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ borderRadius: '12px', fontWeight: 700, px: 3 }}
          >
            Create Event
          </Button>
        </Box>

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
                      {isCreator && (
                        <Tooltip title="Delete event">
                          <IconButton size="small" onClick={() => handleDelete(event.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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
                      {event.location && (
                        <Chip
                          icon={<PlaceIcon />}
                          label={event.location}
                          size="small"
                          sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.7rem' }}
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
                            {event.creator.full_name?.[0]}
                          </Avatar>
                          <Typography variant="caption" color="text.disabled" noWrap>
                            {event.creator.full_name}
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
              label="Location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Zoom, Central Park, Discord #voice"
            />
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
