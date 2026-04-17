/**
 * GroupRoom — unified group space with Posts board + real-time Chat.
 * - Tab 0 "Posts": long-form board posts (title + body + attachments + references)
 * - Tab 1 "Chat":  real-time discussion with WhatsApp-style replies + content references
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import {
  Box, Typography, TextField, IconButton, Stack, Avatar,
  Container, Drawer, List, ListItem, ListItemAvatar, ListItemText,
  Divider, Chip, CircularProgress, Tooltip, Tabs, Tab,
} from '@mui/material';
import LiveStreamsWidget from '../streaming/LiveStreamsWidget';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import PeopleIcon from '@mui/icons-material/People';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ReplyIcon from '@mui/icons-material/Reply';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import ArticleIcon from '@mui/icons-material/Article';
import ForumIcon from '@mui/icons-material/Forum';
import PostFeed from '../posts/PostFeed';
import ReferenceCard, { Reference } from '../../components/common/ReferenceCard';
import ReferencePicker from '../../components/common/ReferencePicker';
import ContentRenderer from '../../components/common/ContentRenderer';

interface Member {
  user_id: string;
  joined_at: string;
  profiles?: { name: string; avatar_url?: string | null } | null;
}
interface Room { id: string; name: string; description?: string; domain?: string; }
interface ReplyPreview { id: string; senderName: string; content: string; }
interface Message {
  id: string;
  sender_id: string;
  content: string;
  message_type: string;
  media_url?: string | null;
  timestamp?: string;
  created_at?: string;
  reply_to_id?: string | null;
  metadata?: {
    reply_preview?: ReplyPreview;
    reference?: Reference;
  } | null;
}

const GroupRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // ── shared state ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState(0);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [myProfile, setMyProfile] = useState<{ name: string } | null>(null);

  // ── chat state ────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [nameCache, setNameCache] = useState<Record<string, string>>({});
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  // reply + reference
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);
  const [chatRef, setChatRef] = useState<Reference | null>(null);
  const [refPickerOpen, setRefPickerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id);
      if (user?.id) {
        supabase.from('profiles').select('name').eq('id', user.id).single()
          .then(({ data }) => setMyProfile(data));
      }
    });
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const init = async () => {
      try {
        const [roomRes, msgsRes, membersRes] = await Promise.all([
          api.get(`/groups/${roomId}`),
          api.get(`/groups/${roomId}/messages`),
          api.get(`/groups/${roomId}/members`),
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
        console.error('Failed to load group room:', err);
      } finally {
        setLoading(false);
      }
    };
    init();

    channelRef.current = supabase
      .channel(`group_${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message]))
      .subscribe();

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const getSenderName = useCallback((senderId: string): string => {
    if (senderId === currentUserId) return myProfile?.name || 'You';
    return nameCache[senderId] || senderId.slice(0, 8);
  }, [currentUserId, myProfile, nameCache]);

  // ── send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !roomId) return;
    const content = newMessage.trim();
    setNewMessage('');
    const replySnapshot = replyTo;
    const refSnapshot = chatRef;
    setReplyTo(null);
    setChatRef(null);
    try {
      await api.post(`/groups/${roomId}/messages`, {
        senderId: currentUserId,
        content,
        replyToId:    replySnapshot?.id,
        replyPreview: replySnapshot ? { id: replySnapshot.id, senderName: replySnapshot.senderName, content: replySnapshot.content.slice(0, 120) } : undefined,
        reference:    refSnapshot ?? undefined,
      });
    } catch {
      toast.error('Failed to send message.');
      setNewMessage(content);
      setReplyTo(replySnapshot);
      setChatRef(refSnapshot);
    }
  };

  // ── file upload ───────────────────────────────────────────────────────────
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
      await api.post(`/groups/${roomId}/messages`, {
        senderId:    currentUserId,
        content:     isImage ? '📷 Image' : `📎 ${file.name}`,
        messageType: isImage ? 'image' : 'file',
        mediaUrl:    publicUrl,
      });
    } catch { toast.error('Failed to upload file.'); }
    finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── message bubble ────────────────────────────────────────────────────────
  const renderMessage = (msg: Message) => {
    const isMine = msg.sender_id === currentUserId;
    const senderName = getSenderName(msg.sender_id);
    const msgType = msg.message_type ?? 'text';
    const rp = msg.metadata?.reply_preview;
    const ref = msg.metadata?.reference;
    const ts = new Date(msg.timestamp ?? msg.created_at ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <Box
        key={msg.id}
        onMouseEnter={() => setHoveredMsgId(msg.id)}
        onMouseLeave={() => setHoveredMsgId(null)}
        sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start', position: 'relative' }}
      >
        {!isMine && (
          <Avatar sx={{ width: 30, height: 30, fontSize: '0.8rem', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {senderName.charAt(0)}
          </Avatar>
        )}

        <Box sx={{ maxWidth: '72%', minWidth: 0 }}>
          {!isMine && <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mb: 0.25, ml: 0.5 }}>{senderName}</Typography>}

          {/* Reply preview */}
          {rp && (
            <Box sx={{
              px: 1.5, py: 0.5, mb: 0.5,
              borderRadius: '10px',
              borderLeft: '3px solid rgba(245,158,11,0.6)',
              bgcolor: 'rgba(255,255,255,0.04)',
              cursor: 'default',
            }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#F59E0B', mb: 0.25 }}>
                ↩ {rp.senderName}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', lineHeight: 1.3 }} noWrap>
                {rp.content}
              </Typography>
            </Box>
          )}

          {/* Bubble */}
          {msgType === 'image' ? (
            <Box component="img" src={msg.media_url ?? ''} alt="shared"
              onClick={() => window.open(msg.media_url ?? '', '_blank')}
              sx={{ width: '100%', maxWidth: 240, borderRadius: 2, display: 'block', cursor: 'pointer' }} />
          ) : msgType === 'file' ? (
            <Box onClick={() => window.open(msg.media_url ?? '', '_blank')}
              sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: isMine ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
              <Typography variant="body2" sx={{ color: isMine ? 'primary.main' : 'text.primary' }}>📎 {msg.content?.replace('📎 ', '') || 'File'}</Typography>
            </Box>
          ) : (
            <Box sx={{
              px: 2, py: 1,
              borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: isMine ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'rgba(255,255,255,0.07)',
              border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}>
              <ContentRenderer 
                content={msg.content}
                variant="chat"
                sx={{ 
                  color: isMine ? '#0A0B14' : 'text.primary',
                  fontWeight: isMine ? 500 : 400,
                }}
              />
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.25, opacity: 0.55, color: isMine ? '#0A0B14' : 'text.secondary', fontSize: '0.62rem' }}>
                {ts}
              </Typography>
            </Box>
          )}

          {/* Inline reference card */}
          {ref && (
            <Box sx={{ mt: 0.5 }}>
              <ReferenceCard reference={ref} compact />
            </Box>
          )}
        </Box>

        {/* Hover reply button */}
        {hoveredMsgId === msg.id && (
          <Tooltip title="Reply">
            <IconButton
              size="small"
              onClick={() => setReplyTo({ id: msg.id, senderName, content: msg.content })}
              sx={{
                position: 'absolute',
                [isMine ? 'left' : 'right']: -32,
                bottom: 0,
                p: 0.25,
                color: 'text.disabled',
                '&:hover': { color: 'primary.main' },
              }}
            >
              <ReplyIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };

  // ── loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return <Container sx={{ mt: 4, textAlign: 'center' }}><CircularProgress /></Container>;
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

        {/* Header */}
        <Box sx={{
          px: 2, py: 1,
          display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: 'rgba(17,24,39,0.9)', backdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}>
          <IconButton edge="start" onClick={() => navigate('/groups')} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
              {room?.name || 'Group'}
            </Typography>
            {room?.domain && <Chip label={room.domain} size="small" sx={{ height: 16, fontSize: '0.62rem', mt: 0.25 }} />}
          </Box>
          <Typography variant="caption" color="text.disabled">{members.length} members</Typography>
          <Tooltip title="Members">
            <IconButton size="small" onClick={() => setMemberDrawerOpen(true)} sx={{ color: 'text.secondary' }}>
              <PeopleIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Tab bar */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(17,24,39,0.8)', flexShrink: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              minHeight: 42,
              '& .MuiTab-root': { minHeight: 42, textTransform: 'none', fontWeight: 600, fontSize: '0.88rem' },
              '& .MuiTabs-indicator': { bgcolor: 'primary.main' },
            }}
          >
            <Tab label="Posts" icon={<ArticleIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
            <Tab label="Chat" icon={<ForumIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Posts tab */}
        {tab === 0 && (
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
            {room?.description && (
              <Box sx={{ mb: 2, px: 2, py: 1.5, borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="body2" color="text.secondary">{room.description}</Typography>
              </Box>
            )}
            <LiveStreamsWidget roomId={roomId} />
            <PostFeed context={roomId!} isBoard />
          </Box>
        )}

        {/* Chat tab */}
        {tab === 1 && (
          <>
            {/* Messages */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2, py: 2 }}>
              {messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', mt: 6, opacity: 0.5 }}>
                  <Typography color="text.secondary">No messages yet — start the discussion!</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>{messages.map(renderMessage)}</Stack>
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Compose bar */}
            <Box sx={{
              px: 2, pt: 1, pb: 'max(12px, env(safe-area-inset-bottom))',
              borderTop: '1px solid', borderColor: 'divider',
              bgcolor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(20px)',
              flexShrink: 0,
            }}>
              {/* Reply banner */}
              {replyTo && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1.5, py: 0.75, mb: 1,
                  borderRadius: '8px',
                  borderLeft: '3px solid',
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(245,158,11,0.06)',
                }}>
                  <ReplyIcon sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'primary.main' }}>
                      Replying to {replyTo.senderName}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>
                      {replyTo.content.slice(0, 80)}{replyTo.content.length > 80 ? '…' : ''}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setReplyTo(null)} sx={{ p: 0.25, color: 'text.disabled' }}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              )}

              {/* Reference preview */}
              {chatRef && (
                <Box sx={{ mb: 1 }}>
                  <ReferenceCard reference={chatRef} onRemove={() => setChatRef(null)} compact />
                </Box>
              )}

              <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFileUpload} />
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="Attach file">
                  <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                    {uploadingFile ? <CircularProgress size={18} /> : <AttachFileIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Link a goal, service or post">
                  <IconButton size="small" onClick={() => setRefPickerOpen(true)} sx={{ color: chatRef ? 'primary.main' : 'text.disabled', '&:hover': { color: 'primary.main' } }}>
                    <LinkIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={`Message #${room?.name || 'group'}…`}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.05)' } }}
                />
                <IconButton onClick={sendMessage} disabled={!newMessage.trim()}
                  sx={{ bgcolor: 'primary.main', color: '#0A0B14', '&:hover': { bgcolor: 'primary.light' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.disabled' } }}>
                  <SendIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          </>
        )}
      </Box>

      {/* Members Drawer */}
      <Drawer anchor="right" open={memberDrawerOpen} onClose={() => setMemberDrawerOpen(false)}
        PaperProps={{ sx: { width: 260, bgcolor: '#111827', borderLeft: '1px solid rgba(255,255,255,0.08)' } }}>
        <Box sx={{ px: 2, py: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Members ({members.length})</Typography>
        </Box>
        <List dense>
          {members.map((m, i) => {
            const name = m.profiles?.name || m.user_id.slice(0, 8);
            const isMe = m.user_id === currentUserId;
            return (
              <React.Fragment key={m.user_id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar src={m.profiles?.avatar_url ?? undefined} sx={{ width: 34, height: 34, fontSize: '0.9rem' }}>{name.charAt(0)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={isMe ? `${name} (you)` : name} primaryTypographyProps={{ fontWeight: isMe ? 700 : 400, fontSize: '0.88rem' }} />
                </ListItem>
                {i < members.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
              </React.Fragment>
            );
          })}
        </List>
      </Drawer>

      {/* Reference picker dialog */}
      {currentUserId && (
        <ReferencePicker
          open={refPickerOpen}
          userId={currentUserId}
          onSelect={(ref) => { setChatRef(ref); setRefPickerOpen(false); }}
          onClose={() => setRefPickerOpen(false)}
        />
      )}
    </>
  );
};

export default GroupRoom;
