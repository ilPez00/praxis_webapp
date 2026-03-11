/**
 * GroupBoard — Reddit-style topic board for a community room.
 *
 * Tab 0 (Posts): PostFeed scoped to this room (board mode — title + body).
 * Tab 1 (Chat):  Real-time group chat (original GroupChatRoom behaviour).
 */

import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import axios from 'axios';
import toast from 'react-hot-toast';
import PostFeed from '../posts/PostFeed';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Stack,
  Avatar,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Chip,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ListItemIcon,
  Menu,
  MenuItem,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import PeopleIcon from '@mui/icons-material/People';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ForumIcon from '@mui/icons-material/Forum';
import ChatIcon from '@mui/icons-material/Chat';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import CancelIcon from '@mui/icons-material/Cancel';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface Member {
  user_id: string;
  joined_at: string;
  profiles?: { name: string; avatar_url?: string } | null;
}

interface Room {
  id: string;
  name: string;
  description?: string;
  domain?: string;
}

interface Friend {
  id: string;
  name: string;
  avatar_url?: string;
}

const GroupChatRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState(0); // 0 = Posts, 1 = Chat
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [myProfile, setMyProfile] = useState<{ name: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [nameCache, setNameCache] = useState<Record<string, string>>({});

  const [roomMuted, setRoomMuted] = useState(false);

  // Axiom state
  const [axiomOpen, setAxiomOpen] = useState(false);
  const [axiomPrompt, setAxiomPrompt] = useState('');
  const [axiomResponse, setAxiomResponse] = useState('');
  const [axiomLoading, setAxiomLoading] = useState(false);

  // Invite friends state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
      if (user?.id) {
        const { data } = await supabase.from('profiles').select('name').eq('id', user.id).single();
        setMyProfile(data);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const init = async () => {
      try {
        const [roomRes, msgsRes, membersRes] = await Promise.all([
          axios.get(`${API_URL}/groups/${roomId}`),
          axios.get(`${API_URL}/groups/${roomId}/messages`),
          axios.get(`${API_URL}/groups/${roomId}/members`),
        ]);
        setRoom(roomRes.data);
        setMessages(Array.isArray(msgsRes.data) ? msgsRes.data : []);
        setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);

        const cache: Record<string, string> = {};
        (membersRes.data || []).forEach((m: Member) => {
          if (m.profiles?.name) cache[m.user_id] = m.profiles.name;
        });
        setNameCache(cache);
      } catch (err) {
        console.error('Failed to load group board:', err);
      } finally {
        setLoading(false);
      }
    };
    init();

    // Check mute status for this room
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await axios.get(`${API_URL}/mutes`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const mutedRooms: string[] = res.data?.mutedRooms ?? [];
        setRoomMuted(mutedRooms.includes(roomId!));
      } catch { /* ignore */ }
    })();

    channelRef.current = supabase
      .channel(`group_${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => setMessages(prev => [...prev, payload.new]),
      )
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId]);

  useEffect(() => {
    if (tab === 1) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  const getSenderName = (senderId: string): string => {
    if (senderId === currentUserId) return myProfile?.name || 'You';
    return nameCache[senderId] || senderId.slice(0, 8);
  };

  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<{ el: HTMLElement; msg: any } | null>(null);

  const handleMessageMenuOpen = (event: React.MouseEvent<HTMLElement>, msg: any) => {
    setMessageMenuAnchor({ el: event.currentTarget, msg });
  };

  const handleMessageMenuClose = () => {
    setMessageMenuAnchor(null);
  };

  const startReply = (msg: any) => {
    setReplyTo(msg);
    handleMessageMenuClose();
  };

  const replyPrivately = (msg: any) => {
    handleMessageMenuClose();
    if (msg.sender_id === currentUserId) return;
    navigate(`/chat/${currentUserId}/${msg.sender_id}`);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !roomId) return;
    const content = newMessage.trim();
    setNewMessage('');
    const replyData = replyTo ? {
      replyToId: replyTo.id,
      replyPreview: {
        id: replyTo.id,
        senderName: getSenderName(replyTo.sender_id),
        content: replyTo.content.length > 50 ? replyTo.content.slice(0, 50) + '...' : replyTo.content
      }
    } : {};
    setReplyTo(null);
    try {
      await axios.post(`${API_URL}/groups/${roomId}/messages`, { 
        senderId: currentUserId, 
        content,
        ...replyData
      });
    } catch (err) {
      toast.error('Failed to send message.');
      setNewMessage(content);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId || !roomId) return;
    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `group-${roomId}/${currentUserId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path);
      const isImage = file.type.startsWith('image/');
      await axios.post(`${API_URL}/groups/${roomId}/messages`, {
        senderId: currentUserId,
        content: isImage ? '📷 Image' : `📎 ${file.name}`,
        messageType: isImage ? 'image' : 'file',
        mediaUrl: publicUrl,
      });
    } catch (err) {
      toast.error('Failed to upload file.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAskAxiom = async () => {
    if (!axiomPrompt.trim()) return;
    setAxiomLoading(true);
    setAxiomResponse('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await axios.post(
        `${API_URL}/ai-coaching/request`,
        { prompt: axiomPrompt },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      setAxiomResponse(res.data.response || res.data.message || JSON.stringify(res.data));
    } catch (err: any) {
      setAxiomResponse(err.response?.data?.message || 'Failed to get a response from Axiom.');
    } finally {
      setAxiomLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentUserId || !roomId) return;
    if (!window.confirm('Leave this group? You can rejoin later.')) return;
    try {
      await axios.delete(`${API_URL}/groups/${roomId}/leave`, { data: { userId: currentUserId } });
      toast.success('You left the group.');
      navigate('/boards');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to leave group.');
    }
  };

  const fetchFriendsForInvite = async () => {
    setInviteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await axios.get(`${API_URL}/friends`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setFriends(data.map((f: any) => ({
        id: f.id ?? f.friend_id ?? f.user_id,
        name: f.name ?? f.friend_name ?? 'User',
        avatar_url: f.avatar_url ?? f.friend_avatar_url,
      })));
    } catch {
      setFriends([]);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!roomId) return;
    setInvitingIds(prev => new Set(Array.from(prev).concat(friendId)));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(
        `${API_URL}/groups/${roomId}/invite`,
        { userId: friendId },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      toast.success('Friend invited!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to invite friend.');
    } finally {
      setInvitingIds(prev => {
        const next = new Set(Array.from(prev));
        next.delete(friendId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<null | HTMLElement>(null);

  const handleHeaderMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setHeaderMenuAnchor(event.currentTarget);
  };

  const handleHeaderMenuClose = () => {
    setHeaderMenuAnchor(null);
  };

  return (
    <>
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

        {/* Header */}
        <Box sx={{
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}>
          <IconButton edge="start" onClick={() => navigate('/communication')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
              {room?.name || 'Board'}
            </Typography>
            <Typography variant="caption" color="text.disabled">{members.length} members</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Invite Friends">
              <IconButton
                size="small"
                onClick={() => { fetchFriendsForInvite(); setInviteOpen(true); }}
                sx={{ color: 'text.secondary' }}
              >
                <PersonAddIcon />
              </IconButton>
            </Tooltip>
            
            <IconButton
              size="small"
              onClick={handleHeaderMenuOpen}
              sx={{ color: 'text.secondary' }}
            >
              <MoreVertIcon />
            </IconButton>

            <Menu
              anchorEl={headerMenuAnchor}
              open={Boolean(headerMenuAnchor)}
              onClose={handleHeaderMenuClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={() => { handleHeaderMenuClose(); setMemberDrawerOpen(true); }}>
                <ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Group Members</ListItemText>
              </MenuItem>
              
              <MenuItem onClick={() => { handleHeaderMenuClose(); setAxiomOpen(true); }}>
                <ListItemIcon><AutoAwesomeIcon fontSize="small" sx={{ color: '#A78BFA' }} /></ListItemIcon>
                <ListItemText>Ask Axiom</ListItemText>
              </MenuItem>

              <MenuItem onClick={async () => {
                handleHeaderMenuClose();
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session?.access_token || !roomId) return;
                  const headers = { Authorization: `Bearer ${session.access_token}` };
                  if (roomMuted) {
                    await axios.delete(`${API_URL}/mutes/room/${roomId}`, { headers });
                    setRoomMuted(false);
                    toast('Board unmuted', { icon: '🔔' });
                  } else {
                    await axios.post(`${API_URL}/mutes/room/${roomId}`, {}, { headers });
                    setRoomMuted(true);
                    toast('Board muted', { icon: '🔕' });
                  }
                } catch { toast.error('Failed to update mute status.'); }
              }}>
                <ListItemIcon>{roomMuted ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}</ListItemIcon>
                <ListItemText>{roomMuted ? 'Unmute' : 'Mute'}</ListItemText>
              </MenuItem>

              <Divider />

              <MenuItem onClick={() => { handleHeaderMenuClose(); handleLeaveRoom(); }} sx={{ color: 'error.main' }}>
                <ListItemIcon><ExitToAppIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Leave Group</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            flexShrink: 0,
            borderBottom: '1px solid', borderColor: 'divider',
            bgcolor: 'rgba(17,24,39,0.6)',
            '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 44, fontSize: '0.9rem' },
          }}
        >
          <Tab label="Posts" icon={<ForumIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          <Tab label="Chat" icon={<ChatIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>

        {/* Posts tab */}
        {tab === 0 && (
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
            {room?.description && (
              <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography variant="body2" color="text.secondary">{room.description}</Typography>
              </Box>
            )}
            {roomId && <PostFeed context={roomId} isBoard />}
          </Box>
        )}

        {/* Chat tab */}
        {tab === 1 && (
          <>
            {/* Messages */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2, py: 2 }}>
              {messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', mt: 6, opacity: 0.5 }}>
                  <Typography color="text.secondary">No messages yet — say something!</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {messages.map((msg) => {
                    const isMine = msg.sender_id === currentUserId;
                    const senderName = getSenderName(msg.sender_id);
                    const msgType: string = msg.message_type ?? 'text';

                    if (msgType === 'image') {
                      return (
                        <Box key={msg.id} sx={{ display: 'flex', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          {!isMine && (
                            <Avatar
                              sx={{ width: 30, height: 30, fontSize: '0.8rem', flexShrink: 0, cursor: 'pointer' }}
                              onClick={() => navigate('/profile/' + msg.sender_id)}
                            >
                              {senderName.charAt(0)}
                            </Avatar>
                          )}
                          <Box sx={{ maxWidth: '60%' }}>
                            {!isMine && (
                              <Typography
                                sx={{ fontSize: '0.7rem', color: 'text.disabled', mb: 0.25, ml: 0.5, cursor: 'pointer', '&:hover': { color: 'text.secondary' } }}
                                onClick={() => navigate('/profile/' + msg.sender_id)}
                              >
                                {senderName}
                              </Typography>
                            )}
                            <Box component="img" src={msg.media_url} alt="shared" onClick={() => window.open(msg.media_url, '_blank')} sx={{ width: '100%', maxWidth: 240, borderRadius: 2, display: 'block', cursor: 'pointer' }} />
                          </Box>
                        </Box>
                      );
                    }

                    if (msgType === 'file') {
                      return (
                        <Box key={msg.id} sx={{ display: 'flex', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          {!isMine && (
                            <Avatar
                              sx={{ width: 30, height: 30, fontSize: '0.8rem', flexShrink: 0, cursor: 'pointer' }}
                              onClick={() => navigate('/profile/' + msg.sender_id)}
                            >
                              {senderName.charAt(0)}
                            </Avatar>
                          )}
                          <Box>
                            {!isMine && (
                              <Typography
                                sx={{ fontSize: '0.7rem', color: 'text.disabled', mb: 0.25, ml: 0.5, cursor: 'pointer', '&:hover': { color: 'text.secondary' } }}
                                onClick={() => navigate('/profile/' + msg.sender_id)}
                              >
                                {senderName}
                              </Typography>
                            )}
                            <Box onClick={() => window.open(msg.media_url, '_blank')} sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: isMine ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                              <Typography variant="body2" sx={{ color: isMine ? 'primary.main' : 'text.primary' }}>📎 {msg.content?.replace('📎 ', '') || 'File'}</Typography>
                            </Box>
                          </Box>
                        </Box>
                      );
                    }

                    return (
                      <Box key={msg.id} sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                        {!isMine && (
                          <Avatar
                            sx={{ width: 30, height: 30, fontSize: '0.8rem', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}
                            onClick={() => navigate('/profile/' + msg.sender_id)}
                          >
                            {senderName.charAt(0)}
                          </Avatar>
                        )}
                        <Box sx={{ maxWidth: '70%' }}>
                          {!isMine && (
                            <Typography
                              sx={{ fontSize: '0.7rem', color: 'text.disabled', mb: 0.25, ml: 0.5, cursor: 'pointer', '&:hover': { color: 'text.secondary' } }}
                              onClick={() => navigate('/profile/' + msg.sender_id)}
                            >
                              {senderName}
                            </Typography>
                          )}
                          <Box 
                            onClick={(e) => handleMessageMenuOpen(e, msg)}
                            sx={{
                              px: 2, py: 1,
                              borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              background: isMine ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(255,255,255,0.07)',
                              border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                          >
                            {msg.metadata?.reply_preview && (
                              <Box sx={{ 
                                mb: 1, p: 1, 
                                borderRadius: 1, 
                                bgcolor: isMine ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)',
                                borderLeft: '3px solid',
                                borderColor: 'primary.main',
                                fontSize: '0.75rem'
                              }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block' }}>
                                  {msg.metadata.reply_preview.senderName}
                                </Typography>
                                <Typography variant="caption" noWrap sx={{ opacity: 0.8, display: 'block' }}>
                                  {msg.metadata.reply_preview.content}
                                </Typography>
                              </Box>
                            )}
                            <Typography variant="body2" sx={{ color: isMine ? '#0A0B14' : 'text.primary', wordBreak: 'break-word', fontWeight: isMine ? 500 : 400 }}>
                              {msg.content}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.25, opacity: 0.55, color: isMine ? '#0A0B14' : 'text.secondary', fontSize: '0.62rem' }}>
                              {new Date(msg.timestamp ?? msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Chat input */}
            <Box sx={{
              px: 2, pt: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))',
              borderTop: '1px solid', borderColor: 'divider',
              bgcolor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(20px)',
              flexShrink: 0,
            }}>
              {replyTo && (
                <Box sx={{ 
                  mb: 1, p: 1, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(255,255,255,0.05)', 
                  borderLeft: '4px solid', 
                  borderColor: 'primary.main',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block' }}>
                      Replying to {getSenderName(replyTo.sender_id)}
                    </Typography>
                    <Typography variant="caption" noWrap sx={{ opacity: 0.7, display: 'block' }}>
                      {replyTo.content}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setReplyTo(null)}>
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="Attach file">
                  <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                    {uploadingFile ? <CircularProgress size={18} /> : <AttachFileIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={`Message #${room?.name || 'room'}...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.05)' } }}
                />
                <IconButton onClick={sendMessage} disabled={!newMessage.trim()} sx={{ bgcolor: 'primary.main', color: '#0A0B14', '&:hover': { bgcolor: 'primary.light' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.disabled' } }}>
                  <SendIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          </>
        )}
      </Box>

      {/* Members Drawer */}
      <Drawer anchor="right" open={memberDrawerOpen} onClose={() => setMemberDrawerOpen(false)} PaperProps={{ sx: { width: 260, bgcolor: '#111827', borderLeft: '1px solid rgba(255,255,255,0.08)' } }}>
        <Box sx={{ px: 2, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Members ({members.length})</Typography>
        </Box>
        <List dense>
          {members.map((m, i) => {
            const name = m.profiles?.name || m.user_id.slice(0, 8);
            const avatarUrl = m.profiles?.avatar_url ?? undefined;
            const isMe = m.user_id === currentUserId;
            return (
              <React.Fragment key={m.user_id}>
                <ListItem
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }, borderRadius: 1 }}
                  onClick={() => { setMemberDrawerOpen(false); navigate('/profile/' + m.user_id); }}
                >
                  <ListItemAvatar>
                    <Avatar src={avatarUrl} sx={{ width: 36, height: 36, fontSize: '0.9rem' }}>{name.charAt(0)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={isMe ? `${name} (you)` : name} primaryTypographyProps={{ fontWeight: isMe ? 700 : 400, fontSize: '0.9rem' }} />
                </ListItem>
                {i < members.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
              </React.Fragment>
            );
          })}
        </List>
      </Drawer>

      {/* Ask Axiom Dialog */}
      <Dialog open={axiomOpen} onClose={() => setAxiomOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: '#A78BFA' }} />
          Ask Axiom
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder="Ask Axiom anything about this board, your goals, or for motivation..."
            value={axiomPrompt}
            onChange={e => setAxiomPrompt(e.target.value)}
            sx={{ mb: 2 }}
          />
          {axiomResponse && (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {axiomResponse}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setAxiomOpen(false); setAxiomPrompt(''); setAxiomResponse(''); }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={handleAskAxiom}
            disabled={axiomLoading || !axiomPrompt.trim()}
            endIcon={axiomLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
            sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}
          >
            Ask Axiom
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite Friends Dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Invite Friends</DialogTitle>
        <DialogContent>
          {inviteLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : friends.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No friends yet. Add friends from their profiles.
            </Typography>
          ) : (
            <List disablePadding>
              {friends.map((friend, i) => (
                <React.Fragment key={friend.id}>
                  <ListItem
                    sx={{ px: 0, py: 1 }}
                    secondaryAction={
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleInviteFriend(friend.id)}
                        disabled={invitingIds.has(friend.id)}
                        sx={{ borderRadius: 2, fontSize: '0.75rem' }}
                      >
                        {invitingIds.has(friend.id) ? <CircularProgress size={14} /> : 'Invite'}
                      </Button>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={friend.avatar_url} sx={{ width: 36, height: 36 }}>
                        {friend.name?.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={friend.name}
                      primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                    />
                  </ListItem>
                  {i < friends.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInviteOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Message Options Menu */}
      <Menu
        anchorEl={messageMenuAnchor?.el}
        open={Boolean(messageMenuAnchor)}
        onClose={handleMessageMenuClose}
      >
        <MenuItem onClick={() => startReply(messageMenuAnchor?.msg)}>
          <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Reply</ListItemText>
        </MenuItem>
        {messageMenuAnchor?.msg.sender_id !== currentUserId && (
          <MenuItem onClick={() => replyPrivately(messageMenuAnchor?.msg)}>
            <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Reply Privately</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default GroupChatRoom;
