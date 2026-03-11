/**
 * GroupBoard — Reddit-style topic board for a community room.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Collapse,
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
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import FlagIcon from '@mui/icons-material/Flag';

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

  const [tab, setTab] = useState(1); // Default to Chat for rework
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);

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

    // Check mute status
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
      navigate('/communication');
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

  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<null | HTMLElement>(null);

  if (loading) return <Container sx={{ mt: 4, textAlign: 'center' }}><CircularProgress /></Container>;

  return (
    <>
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

        {/* ── Consolidated Header ── */}
        <Box sx={{
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(20px)',
          flexShrink: 0, zIndex: 10,
        }}>
          <IconButton edge="start" onClick={() => navigate('/communication')} size="small">
            <ArrowBackIcon />
          </IconButton>
          
          <Box sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setHeaderExpanded(!headerExpanded)}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                {room?.name}
              </Typography>
              {headerExpanded ? <KeyboardArrowUpIcon fontSize="inherit" sx={{ opacity: 0.5 }} /> : <KeyboardArrowDownIcon fontSize="inherit" sx={{ opacity: 0.5 }} />}
            </Box>
            <Typography variant="caption" color="text.disabled">{members.length} members · {room?.domain || 'General'}</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Group Board">
              <IconButton size="small" onClick={() => setTab(tab === 0 ? 1 : 0)} sx={{ color: tab === 0 ? 'primary.main' : 'text.secondary' }}>
                <ForumIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={(e) => setHeaderMenuAnchor(e.currentTarget)} sx={{ color: 'text.secondary' }}><MoreVertIcon /></IconButton>
          </Box>
        </Box>

        {/* ── Axiom Context Header (Pinned) ── */}
        <Collapse in={headerExpanded}>
          <Box sx={{ bgcolor: 'rgba(139,92,246,0.05)', p: 2, borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FlagIcon sx={{ color: '#10B981', fontSize: 20 }} />
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase' }}>Shared Objective</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Mastering {room?.domain || 'this discipline'} through collective accountability.</Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg, #78350F, #92400E)', fontSize: '0.8rem', border: '1px solid rgba(245,158,11,0.3)' }}>🥋</Avatar>
                <Box>
                  <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800 }}>AXIOM TIP</Typography>
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>"Competition drives speed, but shared context drives mastery. Use this board to review each other's progress daily."</Typography>
                </Box>
              </Box>

              <Button fullWidth size="small" variant="outlined" onClick={() => { setHeaderExpanded(false); setMemberDrawerOpen(true); }} sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}>
                View {members.length} Active Members
              </Button>
            </Stack>
          </Box>
        </Collapse>

        {/* ── Main Content Area ── */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {tab === 0 ? (
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
              {room?.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)' }}>{room.description}</Typography>
              )}
              {roomId && <PostFeed context={roomId} isBoard />}
            </Box>
          ) : (
            <>
              {/* Chat Messages */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2, py: 2 }}>
                {messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', mt: 6, opacity: 0.5 }}>
                    <Typography color="text.secondary">Starting a new collective journey...</Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    {messages.map((msg) => {
                      const isMine = msg.sender_id === currentUserId;
                      const senderName = getSenderName(msg.sender_id);
                      
                      return (
                        <Box key={msg.id} sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          {!isMine && (
                            <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0, cursor: 'pointer' }} onClick={() => navigate('/profile/' + msg.sender_id)}>
                              {senderName.charAt(0)}
                            </Avatar>
                          )}
                          <Box sx={{ maxWidth: '75%' }}>
                            {!isMine && <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mb: 0.5, ml: 1 }}>{senderName}</Typography>}
                            
                            <Box 
                              onClick={(e) => handleMessageMenuOpen(e, msg)}
                              sx={{
                                px: 2, py: 1,
                                borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                background: isMine ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(255,255,255,0.06)',
                                border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                cursor: 'pointer', position: 'relative'
                              }}
                            >
                              {msg.metadata?.reply_preview && (
                                <Box sx={{ 
                                  mb: 1, p: 1, borderLeft: '3px solid #F59E0B', 
                                  bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 1, opacity: 0.8
                                }}>
                                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', display: 'block' }}>{msg.metadata.reply_preview.senderName}</Typography>
                                  <Typography variant="caption" noWrap sx={{ display: 'block', fontSize: '0.7rem' }}>{msg.metadata.reply_preview.content}</Typography>
                                </Box>
                              )}
                              
                              {msg.message_type === 'image' ? (
                                <Box component="img" src={msg.media_url} sx={{ width: '100%', maxWidth: 240, borderRadius: 1, display: 'block' }} />
                              ) : msg.message_type === 'file' ? (
                                <Typography variant="body2" sx={{ color: isMine ? '#0A0B14' : 'primary.main' }}>📎 {msg.content?.replace('📎 ', '')}</Typography>
                              ) : (
                                <Typography variant="body2" sx={{ color: isMine ? '#0A0B14' : 'text.primary', fontWeight: isMine ? 600 : 400 }}>{msg.content}</Typography>
                              )}
                              
                              <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.25, opacity: 0.5, fontSize: '0.6rem', color: isMine ? '#0A0B14' : 'inherit' }}>
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

              {/* Chat Input */}
              <Box sx={{ p: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(20px)' }}>
                {replyTo && (
                  <Box sx={{ mb: 1, p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', borderLeft: '4px solid #F59E0B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>Replying to {getSenderName(replyTo.sender_id)}</Typography>
                      <Typography variant="caption" noWrap sx={{ display: 'block', opacity: 0.7 }}>{replyTo.content}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setReplyTo(null)}><CancelIcon fontSize="small" /></IconButton>
                  </Box>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} sx={{ color: 'text.disabled' }}>
                    {uploadingFile ? <CircularProgress size={18} /> : <AttachFileIcon fontSize="small" />}
                  </IconButton>
                  <TextField
                    fullWidth size="small" placeholder="Message collective..." value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.04)' } }}
                  />
                  <IconButton onClick={sendMessage} disabled={!newMessage.trim()} sx={{ bgcolor: 'primary.main', color: '#0A0B14', '&:hover': { bgcolor: 'primary.light' } }}>
                    <SendIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Menus & Dialogs */}
      <Menu anchorEl={headerMenuAnchor} open={Boolean(headerMenuAnchor)} onClose={() => setHeaderMenuAnchor(null)}>
        <MenuItem onClick={() => { setHeaderMenuAnchor(null); setMemberDrawerOpen(true); }}><ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon><ListItemText>Members</ListItemText></MenuItem>
        <MenuItem onClick={() => { setHeaderMenuAnchor(null); setAxiomOpen(true); }}><ListItemIcon><AutoAwesomeIcon fontSize="small" sx={{ color: '#A78BFA' }} /></ListItemIcon><ListItemText>Ask Axiom</ListItemText></MenuItem>
        <MenuItem onClick={handleLeaveRoom} sx={{ color: 'error.main' }}><ListItemIcon><ExitToAppIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Leave Group</ListItemText></MenuItem>
      </Menu>

      <Menu anchorEl={messageMenuAnchor?.el} open={Boolean(messageMenuAnchor)} onClose={() => setMessageMenuAnchor(null)}>
        <MenuItem onClick={() => startReply(messageMenuAnchor?.msg)}><ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon><ListItemText>Reply</ListItemText></MenuItem>
        <MenuItem onClick={() => replyPrivately(messageMenuAnchor?.msg)}><ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon><ListItemText>Reply Privately</ListItemText></MenuItem>
      </Menu>

      <Drawer anchor="right" open={memberDrawerOpen} onClose={() => setMemberDrawerOpen(false)} PaperProps={{ sx: { width: 280, bgcolor: '#111827' } }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Members ({members.length})</Typography></Box>
        <List dense>
          {members.map(m => (
            <ListItem key={m.user_id} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }} onClick={() => { setMemberDrawerOpen(false); navigate('/profile/' + m.user_id); }}>
              <ListItemAvatar><Avatar src={m.profiles?.avatar_url ?? undefined} sx={{ width: 36, height: 36 }}>{m.profiles?.name?.[0]}</Avatar></ListItemAvatar>
              <ListItemText primary={m.profiles?.name || m.user_id.slice(0, 8)} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Dialog open={axiomOpen} onClose={() => setAxiomOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Ask Axiom</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline minRows={3} placeholder="Ask about this group..." value={axiomPrompt} onChange={e => setAxiomPrompt(e.target.value)} sx={{ mb: 2, mt: 1 }} />
          {axiomResponse && <Box sx={{ p: 2, bgcolor: 'rgba(167,139,250,0.05)', borderRadius: 2, border: '1px solid rgba(167,139,250,0.2)' }}><Typography variant="body2">{axiomResponse}</Typography></Box>}
        </DialogContent>
        <DialogActions><Button onClick={() => setAxiomOpen(false)}>Close</Button><Button variant="contained" onClick={handleAskAxiom} disabled={axiomLoading}>Ask</Button></DialogActions>
      </Dialog>
    </>
  );
};

export default GroupChatRoom;
