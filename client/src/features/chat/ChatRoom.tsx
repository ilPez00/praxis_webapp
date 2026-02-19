import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import axios from 'axios';
import { FeedbackGrade } from '../../models/FeedbackGrade';
import { GoalTree } from '../../models/GoalTree';
import { GoalNode } from '../../models/GoalNode';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Avatar,
  useTheme,
  Chip,
  Collapse,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

const ChatRoom: React.FC = () => {
  const { user1Id, user2Id } = useParams<{ user1Id: string; user2Id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [receiverName, setReceiverName] = useState<string>('Partner');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [userGoalTree, setUserGoalTree] = useState<GoalTree | null>(null);
  const [receiverGoalTree, setReceiverGoalTree] = useState<GoalTree | null>(null);
  const [selectedGoalNode, setSelectedGoalNode] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<FeedbackGrade>(FeedbackGrade.SUCCEEDED);
  const [feedbackComment, setFeedbackComment] = useState('');

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
    const fetchUserGoalTree = async () => {
      try {
        const response = await axios.get(`${API_URL}/goals/${currentUserId}`);
        setUserGoalTree(response.data);
      } catch (err) {
        console.error('Failed to fetch user goal tree for feedback:', err);
      }
    };
    fetchUserGoalTree();
  }, [currentUserId]);

  useEffect(() => {
    if (!user2Id) return;
    const fetchReceiverGoalTree = async () => {
      try {
        const response = await axios.get(`${API_URL}/goals/${user2Id}`);
        setReceiverGoalTree(response.data);
      } catch (err) {
        console.error('Failed to fetch receiver goal tree:', err);
      }
    };
    fetchReceiverGoalTree();
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

    const channelName = [user1Id, user2Id].sort().join('-');
    channelRef.current = supabase.channel(`chat_${channelName}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `or(sender_id.eq.${user1Id},sender_id.eq.${user2Id})`,
      }, (payload) => {
        const newMsg = payload.new;
        if ((newMsg.sender_id === user1Id && newMsg.receiver_id === user2Id) ||
            (newMsg.sender_id === user2Id && newMsg.receiver_id === user1Id)) {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user1Id, user2Id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !user2Id) return;
    try {
      await axios.post(`${API_URL}/messages/send`, {
        senderId: currentUserId,
        receiverId: user2Id,
        content: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!currentUserId || !user2Id || !selectedGoalNode || !selectedGrade) {
      alert('Please select a goal and a grade for feedback.');
      return;
    }
    try {
      await axios.post(`${API_URL}/feedback`, {
        giverId: currentUserId,
        receiverId: user2Id,
        goalNodeId: selectedGoalNode,
        grade: selectedGrade,
        comment: feedbackComment,
      });
      alert('Feedback submitted successfully!');
      setShowFeedbackForm(false);
      setSelectedGoalNode('');
      setSelectedGrade(FeedbackGrade.SUCCEEDED);
      setFeedbackComment('');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback.');
    }
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
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Chat Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(17,24,39,0.8)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <IconButton edge="start" onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Avatar sx={{ width: 36, height: 36, fontSize: '0.9rem' }}>
          {receiverName.charAt(0)}
        </Avatar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {receiverName}
          </Typography>
          {receiverRootGoalsSummary && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccountTreeIcon sx={{ fontSize: 11 }} />
              {receiverRootGoalsSummary}
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          startIcon={<StarIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => setShowFeedbackForm(!showFeedbackForm)}
          sx={{
            color: showFeedbackForm ? 'primary.main' : 'text.secondary',
            borderColor: showFeedbackForm ? 'primary.main' : 'divider',
            border: '1px solid',
            borderRadius: 3,
          }}
        >
          Feedback
        </Button>
      </Box>

      {/* Feedback form slide-down */}
      <Collapse in={showFeedbackForm}>
        <Box
          sx={{
            p: 2.5,
            bgcolor: 'rgba(17,24,39,0.9)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Give Feedback
            </Typography>
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
            <Button variant="contained" size="small" onClick={handleSubmitFeedback}>
              Submit
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
          <Stack spacing={0.75}>
            {messages.map((msg) => {
              const isMine = (msg.sender_id ?? msg.senderId) === currentUserId;
              return (
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: '70%',
                      px: 2,
                      py: 1,
                      borderRadius: isMine
                        ? '20px 20px 4px 20px'
                        : '20px 20px 20px 4px',
                      background: isMine
                        ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                        : 'rgba(255,255,255,0.07)',
                      border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: isMine
                        ? '0 2px 12px rgba(245,158,11,0.25)'
                        : 'none',
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
                        opacity: 0.65,
                        color: isMine ? '#0A0B14' : 'text.secondary',
                        fontSize: '0.65rem',
                      }}
                    >
                      {new Date(msg.timestamp ?? msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message input bar */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(17,24,39,0.8)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder="Message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '20px',
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          />
          <IconButton
            onClick={sendMessage}
            disabled={!newMessage.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: '#0A0B14',
              '&:hover': { bgcolor: 'primary.light' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.disabled' },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
};

export default ChatRoom;
