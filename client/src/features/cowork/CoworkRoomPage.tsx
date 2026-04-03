import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Button, Stack, Chip, Grid,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Avatar, AvatarGroup, IconButton, LinearProgress,
  Paper, Divider, Alert,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import TimerIcon from '@mui/icons-material/Timer';
import CoffeeIcon from '@mui/icons-material/Coffee';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GlassCard from '../../components/common/GlassCard';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';

const DOMAINS = ['Fitness', 'Business', 'Creative', 'Tech', 'Education', 'Health', 'Finance', 'Mindfulness'];

interface CoworkRoom {
  id: string;
  name: string;
  description: string;
  domain: string;
  session_duration_minutes: number;
  break_duration_minutes: number;
  active_count: number;
  created_at: string;
}

interface ActiveUser {
  user_id: string;
  name: string;
  avatar_url: string;
  online_at: string;
}

interface CoworkStats {
  total_sessions: number;
  total_minutes: number;
  completed_sessions: number;
  current_streak_days: number;
}

const CoworkRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [rooms, setRooms] = useState<CoworkRoom[]>([]);
  const [myRoom, setMyRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [stats, setStats] = useState<CoworkStats | null>(null);
  
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isBreak, setIsBreak] = useState(false);
  const [goalDescription, setGoalDescription] = useState('');
  const [goalDomain, setGoalDomain] = useState('Fitness');
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    domain: 'Fitness',
    session_duration_minutes: 25,
    break_duration_minutes: 5,
  });

  useEffect(() => {
    loadRooms();
    loadMyRoom();
    loadStats();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user?.id]);

  useEffect(() => {
    if (myRoom?.in_room && myRoom.room) {
      loadActiveUsers(myRoom.room.id);
      const interval = setInterval(() => loadActiveUsers(myRoom.room.id), 10000);
      return () => clearInterval(interval);
    }
  }, [myRoom?.in_room]);

  const loadRooms = async () => {
    try {
      const res = await api.get('/cowork');
      setRooms(res.data || []);
    } catch (err) {
      console.error('Failed to load cowork rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyRoom = async () => {
    if (!user?.id) return;
    try {
      const res = await api.get('/cowork/my-room');
      setMyRoom(res.data);
      if (res.data.in_room && res.data.room) {
        setForm(prev => ({
          ...prev,
          session_duration_minutes: res.data.room.session_duration_minutes || 25,
          break_duration_minutes: res.data.room.break_duration_minutes || 5,
        }));
      }
    } catch (err) {
      console.error('Failed to load my room:', err);
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;
    try {
      const res = await api.get('/cowork/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadActiveUsers = async (roomId: string) => {
    try {
      const res = await api.get(`/cowork/${roomId}/coworkers`);
      setActiveUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load active users:', err);
    }
  };

  const handleCreate = async () => {
    if (!form.name) {
      toast.error('Room name is required');
      return;
    }
    try {
      await api.post('/cowork', form);
      toast.success('Cowork room created!');
      setCreateOpen(false);
      loadRooms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    }
  };

  const handleJoin = async (roomId: string) => {
    try {
      await api.post(`/cowork/${roomId}/join`);
      toast.success('Joined cowork room!');
      loadMyRoom();
      loadRooms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to join');
    }
  };

  const handleLeave = async (roomId: string) => {
    try {
      await api.delete(`/cowork/${roomId}/leave`);
      toast.success('Left cowork room');
      setSessionActive(false);
      setSessionId(null);
      if (timerRef.current) clearInterval(timerRef.current);
      loadMyRoom();
      loadRooms();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to leave');
    }
  };

  const startSession = async () => {
    if (!myRoom?.room?.id) return;
    try {
      const res = await api.post(`/cowork/${myRoom.room.id}/session`, {
        goal_domain: goalDomain,
        goal_description: goalDescription,
      });
      setSessionId(res.data.session_id);
      setTimeLeft(res.data.duration_minutes * 60);
      setSessionActive(true);
      setIsBreak(false);
      toast.success('Session started! Focus time begin.');
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (isBreak) {
              handleEndSession(true);
              return form.session_duration_minutes * 60;
            } else {
              setIsBreak(true);
              toast.success('Session complete! Take a break.');
              return form.break_duration_minutes * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start session');
    }
  };

  const handleEndSession = async (completed: boolean = false) => {
    if (!sessionId) return;
    try {
      await api.delete(`/cowork/sessions/${sessionId}`, { data: { completed } });
      if (timerRef.current) clearInterval(timerRef.current);
      setSessionActive(false);
      setSessionId(null);
      setIsBreak(false);
      setGoalDescription('');
      loadStats();
      if (completed) {
        toast.success('Session completed! Great focus!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to end session');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (myRoom?.in_room) {
    const room = myRoom.room;
    const progress = sessionActive 
      ? ((isBreak ? form.break_duration_minutes * 60 : form.session_duration_minutes * 60 - timeLeft) / 
         (isBreak ? form.break_duration_minutes * 60 : form.session_duration_minutes * 60)) * 100
      : 0;

    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate(-1)}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              <TimerIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              {room.name}
            </Typography>
          </Box>
          <Button variant="outlined" color="error" onClick={() => handleLeave(room.id)}>
            Leave Room
          </Button>
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Chip icon={<GroupsIcon />} label={`${activeUsers.length} focusers`} />
          {myRoom.stats && (
            <Chip icon={<TimerIcon />} label={`${myRoom.stats.focus_minutes} min focused`} />
          )}
        </Stack>

        <GlassCard sx={{ p: 4, textAlign: 'center', mb: 3 }}>
          <Typography variant="h2" sx={{ fontWeight: 900, mb: 2, fontFamily: 'monospace' }}>
            {isBreak ? '☕ BREAK' : formatTime(timeLeft)}
          </Typography>
          
          {sessionActive && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.1)' }}
              />
            </Box>
          )}

          {sessionActive && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {isBreak ? 'Take a break, you earned it!' : '🎯 Focusing...'}
            </Typography>
          )}

          {!sessionActive && (
            <Stack spacing={2} sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
              <TextField
                label="What are you working on?"
                fullWidth
                multiline
                rows={2}
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="e.g., Write 500 words, Complete math exercises..."
              />
              <Box>
                <Typography variant="body2" gutterBottom>Domain</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                  {DOMAINS.map(d => (
                    <Chip
                      key={d}
                      label={d}
                      onClick={() => setGoalDomain(d)}
                      sx={{
                        bgcolor: goalDomain === d ? 'rgba(167,139,250,0.3)' : 'transparent',
                        border: goalDomain === d ? '1px solid #A78BFA' : '1px solid',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Stack>
          )}

          <Stack direction="row" spacing={2} justifyContent="center">
            {!sessionActive ? (
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={startSession}
                sx={{ bgcolor: '#22C55E', '&:hover': { bgcolor: '#16A34A' }, px: 4 }}
              >
                Start Focus Session ({form.session_duration_minutes} min)
              </Button>
            ) : (
              <Button
                variant="contained"
                size="large"
                color="error"
                startIcon={<StopIcon />}
                onClick={() => handleEndSession(false)}
                sx={{ px: 4 }}
              >
                End Session
              </Button>
            )}
          </Stack>
        </GlassCard>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Currently Focusing ({activeUsers.length})
        </Typography>
        
        {activeUsers.length === 0 ? (
          <Typography color="text.secondary">No one else is focusing right now</Typography>
        ) : (
          <Stack spacing={1}>
            {activeUsers.map((u) => (
              <Paper key={u.user_id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar src={u.avatar_url}>{u.name?.[0]}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={600}>{u.name}</Typography>
                  <Typography variant="caption" color="text.secondary">Focusing now</Typography>
                </Box>
                <Box sx={{ 
                  width: 8, height: 8, borderRadius: '50%', bgcolor: '#22C55E',
                  animation: 'pulse 2s infinite' 
                }} />
              </Paper>
            ))}
          </Stack>
        )}

        {stats && (
          <GlassCard sx={{ p: 2, mt: 3 }}>
            <Typography variant="subtitle2" color="text.secondary">Your Stats</Typography>
            <Grid container spacing={2}>
              <Grid size={3}>
                <Typography variant="h5" fontWeight={800}>{stats.total_sessions}</Typography>
                <Typography variant="caption" color="text.secondary">Sessions</Typography>
              </Grid>
              <Grid size={3}>
                <Typography variant="h5" fontWeight={800}>{stats.total_minutes}</Typography>
                <Typography variant="caption" color="text.secondary">Minutes</Typography>
              </Grid>
              <Grid size={3}>
                <Typography variant="h5" fontWeight={800}>{stats.completed_sessions}</Typography>
                <Typography variant="caption" color="text.secondary">Completed</Typography>
              </Grid>
              <Grid size={3}>
                <Typography variant="h5" fontWeight={800}>{stats.current_streak_days}</Typography>
                <Typography variant="caption" color="text.secondary">Day Streak</Typography>
              </Grid>
            </Grid>
          </GlassCard>
        )}
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            <TimerIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Co-working Rooms
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{ bgcolor: '#A78BFA', '&:hover': { bgcolor: '#8B5CF6' } }}
        >
          Create Room
        </Button>
      </Box>

      {rooms.length === 0 ? (
        <GlassCard sx={{ p: 4, textAlign: 'center' }}>
          <TimerIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            No cowork rooms yet. Create one to start focusing together!
          </Typography>
        </GlassCard>
      ) : (
        <Grid container spacing={2}>
          {rooms.map((room) => (
            <Grid size={{ xs: 12, md: 6 }} key={room.id}>
              <GlassCard sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {room.name}
                  </Typography>
                  <Chip 
                    icon={<GroupsIcon />} 
                    label={`${room.active_count} focusing`}
                    size="small"
                    sx={{ bgcolor: 'rgba(34,197,94,0.1)', color: '#22C55E' }}
                  />
                </Box>
                
                {room.description && (
                  <Typography variant="body2" color="text.secondary">
                    {room.description}
                  </Typography>
                )}

                <Stack direction="row" spacing={1}>
                  <Chip label={`${room.session_duration_minutes}m focus`} size="small" />
                  <Chip label={`${room.break_duration_minutes}m break`} size="small" />
                </Stack>

                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => handleJoin(room.id)}
                  disabled={!user?.id}
                  sx={{ mt: 'auto', bgcolor: '#22C55E', '&:hover': { bgcolor: '#16A34A' } }}
                >
                  Join & Focus
                </Button>
              </GlassCard>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Co-working Room</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Room Name"
              fullWidth
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Morning Focus Crew"
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What kind of work happens here?"
            />
            <TextField
              select
              label="Domain"
              fullWidth
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              SelectProps={{ native: true }}
            >
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </TextField>
            <Box>
              <Typography variant="body2">Focus Session: {form.session_duration_minutes} min</Typography>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={form.session_duration_minutes}
                onChange={(e) => setForm({ ...form, session_duration_minutes: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </Box>
            <Box>
              <Typography variant="body2">Break: {form.break_duration_minutes} min</Typography>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={form.break_duration_minutes}
                onChange={(e) => setForm({ ...form, break_duration_minutes: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} sx={{ bgcolor: '#A78BFA' }}>
            Create Room
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CoworkRoomPage;
