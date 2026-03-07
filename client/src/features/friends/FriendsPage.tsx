import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Avatar,
  Button,
  Chip,
  Badge,
  Tabs,
  Tab,
  Grid,
  CircularProgress,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import ChatIcon from '@mui/icons-material/Chat';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_URL } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';
import GlassCard from '../../components/common/GlassCard';

interface Friend {
  id: string;
  name: string;
  avatar_url?: string;
  current_streak?: number;
  friendship_id?: string;
}

interface FriendRequest {
  id: string;
  requester_id: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

const FriendsPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [tab, setTab] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actingIds, setActingIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      setCurrentUserId(u?.id ?? null);
    };
    getUser();
  }, []);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  };

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/friends`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setFriends(data.map((f: any) => ({
        id: f.id ?? f.friend_id ?? f.user_id,
        name: f.name ?? f.friend_name ?? 'User',
        avatar_url: f.avatar_url ?? f.friend_avatar_url,
        current_streak: f.current_streak ?? 0,
        friendship_id: f.friendship_id ?? f.id,
      })));
    } catch {
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const headers = await getAuthHeader();
      const res = await axios.get(`${API_URL}/friends/requests/incoming`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setRequests(data.map((r: any) => ({
        id: r.id,
        requester_id: r.requester_id ?? r.sender_id ?? r.from_user_id,
        name: r.name ?? r.requester_name ?? r.sender_name ?? 'User',
        avatar_url: r.avatar_url ?? r.requester_avatar,
        created_at: r.created_at,
      })));
    } catch {
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    // Always fetch requests so the badge shows on the Friends tab
    fetchRequests();
    if (tab === 0) fetchFriends();
  }, [tab, fetchFriends, fetchRequests]);

  const setActing = (id: string, acting: boolean) => {
    setActingIds(prev => {
      const next = new Set(Array.from(prev));
      if (acting) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleUnfriend = async (friend: Friend) => {
    setActing(friend.id, true);
    try {
      const headers = await getAuthHeader();
      await axios.delete(`${API_URL}/friends/${friend.id}`, { headers });
      setFriends(prev => prev.filter(f => f.id !== friend.id));
      toast.success(`Removed ${friend.name} from friends.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to unfriend.');
    } finally {
      setActing(friend.id, false);
    }
  };

  const handleAccept = async (request: FriendRequest) => {
    setActing(request.id, true);
    try {
      const headers = await getAuthHeader();
      await axios.post(`${API_URL}/friends/accept/${request.id}`, {}, { headers });
      setRequests(prev => prev.filter(r => r.id !== request.id));
      toast.success(`You are now friends with ${request.name}!`);
      if (tab === 0) fetchFriends();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to accept.');
    } finally {
      setActing(request.id, false);
    }
  };

  const handleDecline = async (request: FriendRequest) => {
    setActing(request.id, true);
    try {
      const headers = await getAuthHeader();
      await axios.delete(`${API_URL}/friends/requests/${request.id}`, { headers });
      setRequests(prev => prev.filter(r => r.id !== request.id));
      toast.success('Request declined.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to decline.');
    } finally {
      setActing(request.id, false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <PeopleIcon sx={{ fontSize: 28, color: 'primary.main', display: 'block' }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Friends</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your connections and friend requests
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Tab label="My Friends" />
        <Tab
          label={
            <Badge badgeContent={requests.length} color="error" invisible={tab === 1 || requests.length === 0}>
              Requests
            </Badge>
          }
        />
      </Tabs>

      {/* Tab 0: Friends */}
      {tab === 0 && (
        <>
          {loadingFriends ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : friends.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
              <PeopleIcon sx={{ fontSize: 64, mb: 2, opacity: 0.2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No friends yet</Typography>
              <Typography variant="body2">
                Visit someone's profile and hit "Add Friend" to connect.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {friends.map(friend => (
                <Grid key={friend.id} size={{ xs: 12, sm: 6 }}>
                  <GlassCard sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={friend.avatar_url}
                        sx={{ width: 48, height: 48, cursor: 'pointer', border: '2px solid rgba(245,158,11,0.3)' }}
                        onClick={() => navigate('/profile/' + friend.id)}
                      >
                        {friend.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                          variant="body1"
                          sx={{ fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                          onClick={() => navigate('/profile/' + friend.id)}
                          noWrap
                        >
                          {friend.name}
                        </Typography>
                        {(friend.current_streak ?? 0) > 0 && (
                          <Chip
                            icon={<LocalFireDepartmentIcon sx={{ fontSize: '12px !important', color: '#F59E0B !important' }} />}
                            label={`${friend.current_streak}d streak`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              bgcolor: 'rgba(245,158,11,0.1)',
                              color: '#F59E0B',
                              border: '1px solid rgba(245,158,11,0.25)',
                              mt: 0.5,
                            }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ChatIcon />}
                          onClick={() => currentUserId && navigate(`/chat/${currentUserId}/${friend.id}`)}
                          sx={{
                            borderColor: 'rgba(245,158,11,0.3)',
                            color: 'primary.main',
                            fontSize: '0.7rem',
                            py: 0.25,
                            '&:hover': { borderColor: 'primary.main' },
                          }}
                        >
                          Message
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={actingIds.has(friend.id) ? <CircularProgress size={12} /> : <PersonRemoveIcon />}
                          onClick={() => handleUnfriend(friend)}
                          disabled={actingIds.has(friend.id)}
                          sx={{
                            borderColor: 'rgba(239,68,68,0.3)',
                            color: '#EF4444',
                            fontSize: '0.7rem',
                            py: 0.25,
                            '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.08)' },
                          }}
                        >
                          Unfriend
                        </Button>
                      </Box>
                    </Box>
                  </GlassCard>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Tab 1: Requests */}
      {tab === 1 && (
        <>
          {loadingRequests ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : requests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
              <PeopleIcon sx={{ fontSize: 64, mb: 2, opacity: 0.2 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No pending requests</Typography>
              <Typography variant="body2">Friend requests will appear here.</Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {requests.map(req => (
                <Grid key={req.id} size={{ xs: 12, sm: 6 }}>
                  <GlassCard sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={req.avatar_url}
                        sx={{ width: 48, height: 48, cursor: 'pointer', border: '2px solid rgba(245,158,11,0.3)' }}
                        onClick={() => navigate('/profile/' + req.requester_id)}
                      >
                        {req.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography
                          variant="body1"
                          sx={{ fontWeight: 700, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                          onClick={() => navigate('/profile/' + req.requester_id)}
                          noWrap
                        >
                          {req.name}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          Sent a friend request
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleAccept(req)}
                          disabled={actingIds.has(req.id)}
                          sx={{
                            bgcolor: '#10B981',
                            '&:hover': { bgcolor: '#059669' },
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            py: 0.25,
                          }}
                        >
                          {actingIds.has(req.id) ? <CircularProgress size={12} color="inherit" /> : 'Accept'}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleDecline(req)}
                          disabled={actingIds.has(req.id)}
                          sx={{
                            borderColor: 'rgba(239,68,68,0.3)',
                            color: '#EF4444',
                            fontSize: '0.7rem',
                            py: 0.25,
                            '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.08)' },
                          }}
                        >
                          Decline
                        </Button>
                      </Box>
                    </Box>
                  </GlassCard>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Container>
  );
};

export default FriendsPage;
