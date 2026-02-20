import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../lib/api';
import toast from 'react-hot-toast';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import axios from 'axios';
import { FeedbackGrade } from '../../models/FeedbackGrade';
import { GoalTree } from '../../models/GoalTree';
import { GoalNode } from '../../models/GoalNode';
import VideoCall from './VideoCall';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Avatar,

  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import VideocamIcon from '@mui/icons-material/Videocam';
import VerifiedIcon from '@mui/icons-material/Verified';
import CallIcon from '@mui/icons-material/Call';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

const ChatRoom: React.FC = () => {
  const { user1Id, user2Id } = useParams<{ user1Id: string; user2Id: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [receiverName, setReceiverName] = useState<string>('Partner');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [userGoalTree, setUserGoalTree] = useState<GoalTree | null>(null);
  const [receiverGoalTree, setReceiverGoalTree] = useState<GoalTree | null>(null);
  const [selectedGoalNode, setSelectedGoalNode] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<FeedbackGrade>(FeedbackGrade.SUCCEEDED);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Video call state
  const [videoCallOpen, setVideoCallOpen] = useState(false);
  const [isCallInitiator, setIsCallInitiator] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);

  // Mutual grading
  const [sentMessageCount, setSentMessageCount] = useState(0);
  const [gradingTriggered, setGradingTriggered] = useState(false);
  const [showGradingDialog, setShowGradingDialog] = useState(false);
  const [gradingSubmitted, setGradingSubmitted] = useState(false);
  const [partnerGradedReceived, setPartnerGradedReceived] = useState(false);

  // Goal-focused chat
  const [searchParams] = useSearchParams();
  const [focusGoalId, setFocusGoalId] = useState(searchParams.get('goalNodeId') || '');
  const [focusGoalName, setFocusGoalName] = useState('');
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const channelName = [user1Id, user2Id].sort().join('-');

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (!user2Id) return;
    const fetchReceiverName = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user2Id)
          .single();
        if (error) throw error;
        setReceiverName(data.name || 'Partner');
      } catch (error) {
        console.error('Error fetching receiver name:', error);
      }
    };
    fetchReceiverName();
  }, [user2Id]);

  useEffect(() => {
    if (!currentUserId) return;
    axios.get(`${API_URL}/goals/${currentUserId}`)
      .then(r => setUserGoalTree(r.data))
      .catch(() => {});
  }, [currentUserId]);

  useEffect(() => {
    if (!user2Id) return;
    axios.get(`${API_URL}/goals/${user2Id}`)
      .then(r => setReceiverGoalTree(r.data))
      .catch(() => {});
  }, [user2Id]);

  useEffect(() => {
    if (!user1Id || !user2Id) return;

    const fetchMessages = async () => {
      try {
        const response = await axios.get(`${API_URL}/messages/${user1Id}/${user2Id}`);
        setMessages(response.data || []);
      } catch (error) {
        console.error('Fetch messages error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();

    channelRef.current = supabase.channel(`chat_${channelName}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `or(sender_id.eq.${user1Id},sender_id.eq.${user2Id})`,
      }, (payload) => {
        const newMsg = payload.new;
        if (
          (newMsg.sender_id === user1Id && newMsg.receiver_id === user2Id) ||
          (newMsg.sender_id === user2Id && newMsg.receiver_id === user1Id)
        ) {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.senderId && payload.senderId !== user1Id) {
          setIsPartnerTyping(true);
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setIsPartnerTyping(false), 3000);
        }
      })
      .on('broadcast', { event: 'call-invite' }, ({ payload }) => {
        // Only show dialog if the invite is from the other user
        if (payload?.from && payload.from !== currentUserId) {
          setIncomingCall(true);
        }
      })
      .on('broadcast', { event: 'call-declined' }, () => {
        setVideoCallOpen(false);
        setIsCallInitiator(false);
        toast('Call declined.', { icon: '📵' });
      })
      .on('broadcast', { event: 'grading-submitted' }, () => {
        setPartnerGradedReceived(true);
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user1Id, user2Id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!focusGoalId || !userGoalTree) return;
    const node = userGoalTree.nodes.find((n: GoalNode) => n.id === focusGoalId);
    if (node) setFocusGoalName(node.name);
  }, [focusGoalId, userGoalTree]);

  useEffect(() => {
    if (focusGoalId && showFeedbackForm && !selectedGoalNode) {
      setSelectedGoalNode(focusGoalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGoalId, showFeedbackForm]);

  // When both parties have graded, close dialog and celebrate
  useEffect(() => {
    if (gradingSubmitted && partnerGradedReceived) {
      setShowGradingDialog(false);
      toast.success('Both grades submitted — goal weights recalibrated!', { icon: '🤝', duration: 5000 });
    }
  }, [gradingSubmitted, partnerGradedReceived]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !user2Id) return;
    try {
      await axios.post(`${API_URL}/messages/send`, {
        senderId: currentUserId,
        receiverId: user2Id,
        content: newMessage.trim(),
        ...(focusGoalId ? { goalNodeId: focusGoalId } : {}),
      });
      setNewMessage('');
      const newCount = sentMessageCount + 1;
      setSentMessageCount(newCount);
      // Auto-trigger grading dialog after 5 sent messages (one-shot per session)
      if (newCount >= 5 && !gradingTriggered) {
        setGradingTriggered(true);
        setShowGradingDialog(true);
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  const handleSubmitGrading = async () => {
    if (!currentUserId || !user2Id || !selectedGoalNode || !selectedGrade) {
      toast.error('Please select a goal and a grade.');
      return;
    }
    setSubmittingFeedback(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_URL}/feedback`, {
        giverId: currentUserId,
        receiverId: user2Id,
        goalNodeId: selectedGoalNode,
        grade: selectedGrade,
        comment: feedbackComment,
      }, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      // Notify partner via broadcast
      channelRef.current?.send({
        type: 'broadcast',
        event: 'grading-submitted',
        payload: { from: currentUserId },
      });
      setGradingSubmitted(true);
      toast.success('Grade submitted!');
    } catch {
      toast.error('Failed to submit grade. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId || !user2Id) return;

    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${currentUserId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(path);

      const isImage = file.type.startsWith('image/');
      await axios.post(`${API_URL}/messages/send`, {
        senderId: currentUserId,
        receiverId: user2Id,
        content: isImage ? '📷 Image' : `📎 ${file.name}`,
        messageType: isImage ? 'image' : 'file',
        mediaUrl: publicUrl,
        ...(focusGoalId ? { goalNodeId: focusGoalId } : {}),
      });
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCompletionResponse = async (requestId: string, approved: boolean) => {
    if (!currentUserId) return;
    try {
      await axios.patch(`${API_URL}/completions/${requestId}/respond`, {
        verifierId: currentUserId,
        approved,
      });
      toast.success(approved ? '✅ Goal verified!' : '❌ Verification declined.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to respond.');
    }
  };

  const handleVideoCallClick = () => {
    if (!currentUserId) return;
    setIsCallInitiator(true);
    setVideoCallOpen(true);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-invite',
      payload: { from: currentUserId },
    });
  };

  const handleAcceptCall = () => {
    setIncomingCall(false);
    setIsCallInitiator(false);
    setVideoCallOpen(true);
  };

  const handleDeclineCall = () => {
    setIncomingCall(false);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-declined',
      payload: { from: currentUserId },
    });
  };

  const handleSubmitFeedback = async () => {
    if (!currentUserId || !user2Id || !selectedGoalNode || !selectedGrade) {
      toast.error('Please select a goal and a grade before submitting.');
      return;
    }
    setSubmittingFeedback(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.post(`${API_URL}/feedback`, {
        giverId: currentUserId,
        receiverId: user2Id,
        goalNodeId: selectedGoalNode,
        grade: selectedGrade,
        comment: feedbackComment,
      }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      toast.success('Feedback submitted! Their goal weights have been updated.');
      setShowFeedbackForm(false);
      setSelectedGoalNode('');
      setSelectedGrade(FeedbackGrade.SUCCEEDED);
      setFeedbackComment('');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // ── Message renderers ────────────────────────────────────────────────────────

  const renderMessage = (msg: any) => {
    const isMine = (msg.sender_id ?? msg.senderId) === currentUserId;
    const msgType: string = msg.message_type ?? 'text';

    // System notification — centered, no bubble
    if (msgType === 'system') {
      return (
        <Box
          key={msg.id}
          sx={{ display: 'flex', justifyContent: 'center', py: 0.75 }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'text.disabled',
              fontStyle: 'italic',
              bgcolor: 'rgba(255,255,255,0.04)',
              px: 2,
              py: 0.5,
              borderRadius: 10,
              textAlign: 'center',
            }}
          >
            {msg.content}
          </Typography>
        </Box>
      );
    }

    // Completion request card
    if (msgType === 'completion_request') {
      const isVerifier = msg.receiver_id === currentUserId;
      const meta: any = typeof msg.metadata === 'string'
        ? JSON.parse(msg.metadata)
        : (msg.metadata ?? {});
      return (
        <Box
          key={msg.id}
          sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', py: 0.5 }}
        >
          <Paper
            elevation={0}
            sx={{
              maxWidth: '78%',
              p: 2,
              borderRadius: 3,
              border: '1px solid rgba(245,158,11,0.3)',
              bgcolor: 'rgba(245,158,11,0.07)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <VerifiedIcon sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                Completion Request
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mb: isVerifier ? 1.5 : 0 }}>
              Requesting verification of:{' '}
              <strong>{meta.goalName || 'a goal'}</strong>
            </Typography>
            {isVerifier && (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  onClick={() => handleCompletionResponse(meta.requestId, true)}
                  sx={{ borderRadius: 3, fontSize: '0.75rem', py: 0.5 }}
                >
                  ✓ Verify
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => handleCompletionResponse(meta.requestId, false)}
                  sx={{ borderRadius: 3, fontSize: '0.75rem', py: 0.5 }}
                >
                  ✗ Reject
                </Button>
              </Stack>
            )}
            {!isVerifier && (
              <Typography variant="caption" color="text.secondary">
                Waiting for verification…
              </Typography>
            )}
            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: 'right', mt: 1, opacity: 0.5, fontSize: '0.63rem' }}
            >
              {new Date(msg.timestamp ?? msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Paper>
        </Box>
      );
    }

    // Image message
    if (msgType === 'image') {
      return (
        <Box
          key={msg.id}
          sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}
        >
          {!isMine && (
            <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {receiverName.charAt(0)}
            </Avatar>
          )}
          <Box sx={{ maxWidth: '60%' }}>
            {!isMine && (
              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mb: 0.25, ml: 0.5 }}>
                {receiverName}
              </Typography>
            )}
            <Box
              component="img"
              src={msg.media_url}
              alt="shared image"
              onClick={() => window.open(msg.media_url, '_blank')}
              sx={{
                width: '100%',
                maxWidth: 280,
                borderRadius: 3,
                display: 'block',
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: isMine ? 'right' : 'left',
                mt: 0.25,
                opacity: 0.5,
                fontSize: '0.63rem',
              }}
            >
              {new Date(msg.timestamp ?? msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </Box>
      );
    }

    // File message
    if (msgType === 'file') {
      return (
        <Box
          key={msg.id}
          sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}
        >
          {!isMine && (
            <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {receiverName.charAt(0)}
            </Avatar>
          )}
          <Box sx={{ maxWidth: '68%' }}>
            {!isMine && (
              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mb: 0.25, ml: 0.5 }}>
                {receiverName}
              </Typography>
            )}
            <Box
              onClick={() => window.open(msg.media_url, '_blank')}
              sx={{
                px: 2,
                py: 1,
                borderRadius: 3,
                bgcolor: isMine ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                '&:hover': { opacity: 0.85 },
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: isMine ? 'primary.main' : 'text.primary', display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                📎 {msg.content?.replace('📎 ', '') || 'File'}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              sx={{ display: 'block', textAlign: isMine ? 'right' : 'left', mt: 0.25, opacity: 0.5, fontSize: '0.63rem' }}
            >
              {new Date(msg.timestamp ?? msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </Box>
      );
    }

    // Default: text bubble
    return (
      <Box
        key={msg.id}
        sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}
      >
        {!isMine && (
          <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
            {receiverName.charAt(0)}
          </Avatar>
        )}
        <Box sx={{ maxWidth: '68%' }}>
          {!isMine && (
            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mb: 0.25, ml: 0.5 }}>
              {receiverName}
            </Typography>
          )}
          <Box
            sx={{
              px: 2,
              py: 1,
              borderRadius: isMine ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              background: isMine
                ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                : 'rgba(255,255,255,0.07)',
              border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: isMine ? '0 2px 12px rgba(245,158,11,0.25)' : 'none',
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: isMine ? '#0A0B14' : 'text.primary', wordBreak: 'break-word', fontWeight: isMine ? 500 : 400 }}
            >
              {msg.content}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'right',
                mt: 0.25,
                opacity: 0.6,
                color: isMine ? '#0A0B14' : 'text.secondary',
                fontSize: '0.63rem',
              }}
            >
              {new Date(msg.timestamp ?? msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  if (loading || !currentUserId) {
    return (
      <Container sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary">Loading chat...</Typography>
      </Container>
    );
  }

  const receiverRootGoalsSummary = receiverGoalTree?.rootNodes
    ?.map(node => `${node.name} (${node.domain})`)
    .join(' · ');

  return (
    <>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
      <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

        {/* Chat Header */}
        <Box
          sx={{
            px: 2, py: 1.5,
            display: 'flex', alignItems: 'center', gap: 1.5,
            borderBottom: '1px solid', borderColor: 'divider',
            bgcolor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(20px)',
          }}
        >
          <IconButton edge="start" onClick={() => navigate(-1)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ width: 36, height: 36, fontSize: '0.9rem' }}>
            {receiverName.charAt(0)}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {receiverName}
            </Typography>
            {receiverRootGoalsSummary && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccountTreeIcon sx={{ fontSize: 11 }} />
                {receiverRootGoalsSummary}
              </Typography>
            )}
          </Box>
          <Tooltip title="Focus on goal">
            <Button
              size="small"
              startIcon={<AccountTreeIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => setShowGoalPicker(true)}
              sx={{
                color: focusGoalId ? 'primary.main' : 'text.secondary',
                borderColor: focusGoalId ? 'primary.main' : 'divider',
                border: '1px solid', borderRadius: 3, mr: 0.5,
              }}
            >
              {focusGoalId ? 'Goal' : 'Focus'}
            </Button>
          </Tooltip>
          <Tooltip title="Give feedback">
            <Button
              size="small"
              startIcon={<StarIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => setShowFeedbackForm(!showFeedbackForm)}
              sx={{
                color: showFeedbackForm ? 'primary.main' : 'text.secondary',
                borderColor: showFeedbackForm ? 'primary.main' : 'divider',
                border: '1px solid', borderRadius: 3, mr: 0.5,
              }}
            >
              Feedback
            </Button>
          </Tooltip>
          <Tooltip title="End session &amp; grade">
            <Button
              size="small"
              startIcon={<EmojiEventsIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => setShowGradingDialog(true)}
              sx={{
                color: 'text.secondary',
                borderColor: 'divider',
                border: '1px solid', borderRadius: 3, mr: 0.5,
                '&:hover': { color: '#F59E0B', borderColor: '#F59E0B' },
              }}
            >
              Grade
            </Button>
          </Tooltip>
          <Tooltip title="Video call">
            <IconButton
              size="small"
              onClick={handleVideoCallClick}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <VideocamIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Goal focus banner */}
        {focusGoalId && focusGoalName && (
          <Box sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
            <AccountTreeIcon sx={{ fontSize: 13, color: 'primary.main' }} />
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, flexGrow: 1 }}>
              Collaborating on: {focusGoalName}
            </Typography>
            <IconButton size="small" onClick={() => { setFocusGoalId(''); setFocusGoalName(''); }} sx={{ p: 0.25 }}>
              <CloseIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            </IconButton>
          </Box>
        )}

        {/* Feedback form */}
        <Collapse in={showFeedbackForm}>
          <Box sx={{ p: 2.5, bgcolor: 'rgba(17,24,39,0.9)', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Give Feedback</Typography>
              <IconButton size="small" onClick={() => setShowFeedbackForm(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
              <FormControl fullWidth size="small">
                <InputLabel>Goal</InputLabel>
                <Select
                  value={selectedGoalNode}
                  onChange={(e) => setSelectedGoalNode(e.target.value as string)}
                  label="Goal"
                  disabled={!userGoalTree || userGoalTree.nodes.length === 0}
                >
                  <MenuItem value=""><em>Select a goal</em></MenuItem>
                  {userGoalTree?.nodes.map((node: GoalNode) => (
                    <MenuItem key={node.id} value={node.id}>{node.name} ({node.domain})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Grade</InputLabel>
                <Select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value as FeedbackGrade)}
                  label="Grade"
                >
                  {Object.values(FeedbackGrade).map((grade) => (
                    <MenuItem key={grade} value={grade}>{grade}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <TextField
                size="small"
                placeholder="Optional comment..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                sx={{ flexGrow: 1 }}
              />
              <Button variant="contained" size="small" onClick={handleSubmitFeedback} disabled={submittingFeedback}>
                {submittingFeedback ? 'Submitting…' : 'Submit'}
              </Button>
            </Stack>
          </Box>
        </Collapse>

        {/* Messages list */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 2, py: 2 }}>
          {messages.length === 0 ? (
            <Box sx={{ textAlign: 'center', mt: 6, opacity: 0.5 }}>
              <Typography color="text.secondary">Say hi to start the conversation!</Typography>
            </Box>
          ) : (
            <Stack spacing={1}>
              {messages.map((msg) => renderMessage(msg))}
            </Stack>
          )}

          {isPartnerTyping && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {receiverName.charAt(0)}
              </Avatar>
              <Box sx={{ px: 2, py: 0.75, borderRadius: '20px 20px 20px 4px', bgcolor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {[0, 1, 2].map((i) => (
                  <Box key={i} sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'text.disabled', animation: 'typing-bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </Box>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input bar */}
        <Box
          sx={{
            px: 2, pt: 1.5, pb: 'max(12px, env(safe-area-inset-bottom))',
            borderTop: '1px solid', borderColor: 'divider',
            bgcolor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(20px)',
          }}
        >
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Attach file">
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
              >
                {uploadingFile ? <CircularProgress size={18} /> : <AttachFileIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <TextField
              fullWidth
              size="small"
              placeholder="Message..."
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (channelRef.current && currentUserId) {
                  channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { senderId: currentUserId } });
                }
              }}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.05)' } }}
            />
            <IconButton
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              sx={{
                bgcolor: 'primary.main', color: '#0A0B14',
                '&:hover': { bgcolor: 'primary.light' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.disabled' },
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </Box>

      {/* Goal picker dialog */}
      <Dialog open={showGoalPicker} onClose={() => setShowGoalPicker(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600, pr: 5 }}>
          Focus this chat on a goal
          <IconButton size="small" onClick={() => setShowGoalPicker(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <List dense sx={{ pb: 0 }}>
          {focusGoalId && (
            <ListItem disablePadding>
              <ListItemButton onClick={() => { setFocusGoalId(''); setFocusGoalName(''); setShowGoalPicker(false); }}>
                <ListItemText primary="No focus goal" primaryTypographyProps={{ fontSize: '0.85rem', color: 'text.secondary' }} />
              </ListItemButton>
            </ListItem>
          )}
          {userGoalTree?.nodes.map((node: GoalNode) => (
            <ListItem disablePadding key={node.id}>
              <ListItemButton
                selected={focusGoalId === node.id}
                onClick={() => { setFocusGoalId(node.id); setFocusGoalName(node.name); setShowGoalPicker(false); }}
              >
                <ListItemText
                  primary={node.name}
                  secondary={node.domain}
                  primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
                  secondaryTypographyProps={{ fontSize: '0.75rem' }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {(!userGoalTree || userGoalTree.nodes.length === 0) && (
            <ListItem>
              <ListItemText primary="No goals found — build your goal tree first" primaryTypographyProps={{ fontSize: '0.85rem', color: 'text.secondary' }} />
            </ListItem>
          )}
        </List>
        <DialogActions>
          <Button size="small" onClick={() => setShowGoalPicker(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Mutual grading dialog */}
      <Dialog open={showGradingDialog} onClose={() => !gradingSubmitted && setShowGradingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ color: '#F59E0B' }} />
            Grade this Session
            <IconButton
              size="small"
              onClick={() => setShowGradingDialog(false)}
              sx={{ ml: 'auto', color: 'text.disabled' }}
              disabled={gradingSubmitted}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {gradingSubmitted ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <EmojiEventsIcon sx={{ fontSize: 56, color: '#F59E0B', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Grade submitted!</Typography>
              <Typography color="text.secondary">
                {partnerGradedReceived
                  ? '✅ Both grades in — weights recalibrated!'
                  : 'Waiting for ' + receiverName + ' to grade…'}
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                How did <strong>{receiverName}</strong> perform toward their goals this session?
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Their Goal</InputLabel>
                <Select
                  label="Their Goal"
                  value={selectedGoalNode}
                  onChange={(e) => setSelectedGoalNode(e.target.value)}
                >
                  {(receiverGoalTree?.nodes || []).map((n: any) => (
                    <MenuItem key={n.id} value={n.id}>{n.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Grade</InputLabel>
                <Select
                  label="Grade"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value as any)}
                >
                  {Object.values(FeedbackGrade).map((g) => (
                    <MenuItem key={g} value={g}>{g}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth size="small" multiline rows={2}
                label="Comment (optional)"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        {!gradingSubmitted && (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowGradingDialog(false)}>Skip</Button>
            <Button
              variant="contained"
              onClick={handleSubmitGrading}
              disabled={submittingFeedback || !selectedGoalNode}
              sx={{ px: 3 }}
            >
              {submittingFeedback ? 'Submitting…' : 'Submit Grade'}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* Incoming call dialog */}
      <Dialog open={incomingCall} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, textAlign: 'center' }}>
          <CallIcon sx={{ color: 'primary.main', mr: 1, verticalAlign: 'middle' }} />
          Incoming Video Call
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 1.5, fontSize: '1.5rem' }}>
            {receiverName.charAt(0)}
          </Avatar>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>{receiverName}</Typography>
          <Typography variant="body2" color="text.secondary">is calling you…</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDeclineCall}
            sx={{ borderRadius: 3, px: 3 }}
          >
            Decline
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleAcceptCall}
            sx={{ borderRadius: 3, px: 3 }}
          >
            Accept
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video call */}
      {videoCallOpen && currentUserId && (
        <VideoCall
          open={videoCallOpen}
          onClose={() => { setVideoCallOpen(false); setIsCallInitiator(false); }}
          channelName={channelName}
          currentUserId={currentUserId}
          isInitiator={isCallInitiator}
        />
      )}
    </>
  );
};

export default ChatRoom;
