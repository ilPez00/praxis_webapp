import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { DOMAIN_COLORS, Domain } from '../../types/goal';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  CircularProgress,
  Avatar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupsIcon from '@mui/icons-material/Groups';
import PeopleIcon from '@mui/icons-material/People';

interface Room {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  creator_id: string;
  created_at: string;
  chat_room_members?: { count: number }[];
}

const domainOptions = Object.values(Domain);

const GroupsPage: React.FC = () => {
  const navigate = useNavigate();

  // Get userId directly from auth (fast JWT check, no DB round-trip)
  // This avoids the issue where fetchRooms would get stuck if useUser()'s
  // profiles query was slow or transiently failing.
  const [userId, setUserId] = useState<string | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [joiningRoom, setJoiningRoom] = useState<string | null>(null);

  // Create room dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomDomain, setRoomDomain] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [allRes, joinedRes] = await Promise.allSettled([
        axios.get(`${API_URL}/groups`),
        axios.get(`${API_URL}/groups/joined?userId=${userId}`),
      ]);
      if (allRes.status === 'fulfilled') {
        setAllRooms(Array.isArray(allRes.value.data) ? allRes.value.data : []);
      } else {
        console.error('[Groups] GET /groups failed:', allRes.reason);
        setAllRooms([]);
      }
      if (joinedRes.status === 'fulfilled') {
        const raw = Array.isArray(joinedRes.value.data) ? joinedRes.value.data : [];
        const joinedData: Room[] = raw.map((entry: any) => entry.chat_rooms).filter(Boolean);
        setJoinedRooms(joinedData);
      } else {
        console.error('[Groups] GET /groups/joined failed:', joinedRes.reason);
        setJoinedRooms([]);
      }
    } catch (err: any) {
      console.error('[Groups] fetchRooms threw:', err);
      toast.error(`Groups error: ${err?.response?.data?.message || err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleJoin = async (roomId: string) => {
    if (!userId) return;
    setJoiningRoom(roomId);
    try {
      await axios.post(`${API_URL}/groups/${roomId}/join`, { userId });
      toast.success('Joined room!');
      await fetchRooms();
      navigate(`/groups/${roomId}`);
    } catch (err) {
      toast.error('Failed to join room.');
    } finally {
      setJoiningRoom(null);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim() || !userId) return;
    setCreating(true);
    try {
      const { data } = await axios.post(`${API_URL}/groups`, {
        name: roomName.trim(),
        description: roomDesc.trim() || undefined,
        domain: roomDomain || undefined,
        creatorId: userId,
      });
      toast.success('Room created!');
      setCreateOpen(false);
      setRoomName('');
      setRoomDesc('');
      setRoomDomain('');
      await fetchRooms();
      navigate(`/groups/${data.id}`);
    } catch (err) {
      toast.error('Failed to create room.');
    } finally {
      setCreating(false);
    }
  };

  const isJoined = (roomId: string) => joinedRooms.some(r => r.id === roomId);

  const RoomCard: React.FC<{ room: Room }> = ({ room }) => {
    const color = room.domain ? (DOMAIN_COLORS[room.domain] || '#9CA3AF') : '#9CA3AF';
    const memberCount = room.chat_room_members?.[0]?.count ?? 0;
    const joined = isJoined(room.id);

    return (
      <Card
        elevation={0}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'rgba(255,255,255,0.04)',
          border: joined ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 3,
          transition: 'border-color 0.2s',
          '&:hover': { borderColor: `${color}88` },
        }}
      >
        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
            <Avatar
              sx={{
                width: 44,
                height: 44,
                bgcolor: `${color}22`,
                border: `2px solid ${color}55`,
                fontSize: '1.2rem',
              }}
            >
              {room.name?.charAt(0).toUpperCase() ?? '?'}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                {room.name}
              </Typography>
              {room.domain && (
                <Chip
                  label={room.domain}
                  size="small"
                  sx={{
                    mt: 0.5,
                    height: 20,
                    fontSize: '0.7rem',
                    bgcolor: `${color}22`,
                    color,
                    border: `1px solid ${color}44`,
                  }}
                />
              )}
            </Box>
          </Box>
          {room.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.5,
              }}
            >
              {room.description}
            </Typography>
          )}
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PeopleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Typography>
          </Box>
          <Button
            size="small"
            variant={joined ? 'outlined' : 'contained'}
            onClick={() => joined ? navigate(`/groups/${room.id}`) : handleJoin(room.id)}
            disabled={joiningRoom === room.id}
            sx={{
              borderRadius: 3,
              fontSize: '0.78rem',
              ...(joined
                ? { borderColor: color, color, '&:hover': { borderColor: color, bgcolor: `${color}11` } }
                : { bgcolor: color, color: '#fff', '&:hover': { bgcolor: color, opacity: 0.9 } }),
            }}
          >
            {joiningRoom === room.id ? (
              <CircularProgress size={14} sx={{ color: 'inherit' }} />
            ) : joined ? (
              'Enter'
            ) : (
              'Join'
            )}
          </Button>
        </CardActions>
      </Card>
    );
  };

  const displayedRooms = tab === 0 ? allRooms : joinedRooms;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, pb: 6 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>
            Community Rooms
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Find and join goal-aligned communities
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{ borderRadius: 3, fontWeight: 700 }}
        >
          Create Room
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.95rem' },
        }}
      >
        <Tab label="All Rooms" icon={<GroupsIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab
          label={`My Rooms${joinedRooms.length > 0 ? ` (${joinedRooms.length})` : ''}`}
          icon={<PeopleIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
        />
      </Tabs>

      {/* Room grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : displayedRooms.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <GroupsIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
            {tab === 0 ? 'No rooms yet' : 'No joined rooms'}
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
            {tab === 0
              ? 'Be the first to create a community room!'
              : 'Join a room from the "All Rooms" tab.'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {displayedRooms.map((room) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={room.id}>
              <RoomCard room={room} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Room Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupsIcon sx={{ color: 'primary.main' }} />
            Create a Community Room
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              fullWidth
              required
              inputProps={{ maxLength: 60 }}
              helperText={`${roomName.length}/60`}
            />
            <TextField
              label="Description (optional)"
              value={roomDesc}
              onChange={(e) => setRoomDesc(e.target.value)}
              fullWidth
              multiline
              rows={2}
              inputProps={{ maxLength: 200 }}
              helperText={`${roomDesc.length}/200`}
            />
            <FormControl fullWidth>
              <InputLabel>Domain (optional)</InputLabel>
              <Select
                value={roomDomain}
                onChange={(e) => setRoomDomain(e.target.value as string)}
                label="Domain (optional)"
              >
                <MenuItem value=""><em>None — general room</em></MenuItem>
                {domainOptions.map((d) => (
                  <MenuItem key={d} value={d}>{d}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateRoom}
            disabled={!roomName.trim() || creating}
            sx={{ borderRadius: 3 }}
          >
            {creating ? <CircularProgress size={18} /> : 'Create Room'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GroupsPage;
