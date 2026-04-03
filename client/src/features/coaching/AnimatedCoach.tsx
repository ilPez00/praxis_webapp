import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Stack, Avatar, Chip, Paper,
  IconButton, Slide, Grow, Zoom,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { useUser } from '../../hooks/useUser';
import api from '../../lib/api';
import GlassCard from '../../components/common/GlassCard';

interface Personality {
  id: string;
  name: string;
  description: string;
  avatar: string;
  primaryColor: string;
  emoji: string;
}

interface Message {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: Date;
}

interface AnimatedCoachProps {
  personality: Personality;
  onClose?: () => void;
  compact?: boolean;
}

const AnimatedCoach: React.FC<AnimatedCoachProps> = ({ personality, onClose, compact = false }) => {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [coachTyping, setCoachTyping] = useState(false);
  const [showAnimation, setShowAnimation] = useState(true);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    const greeting = personality.emoji + ' ' + getGreeting(personality.id);
    setMessages([{
      id: '1',
      role: 'coach',
      content: greeting,
      timestamp: new Date(),
    }]);
  }, [personality.id]);

  const getGreeting = (id: string): string => {
    const greetings: Record<string, string[]> = {
      cheerleader: ['Hey rockstar! Ready to crush some goals today? 🌟', 'You got this! Let\'s make today amazing! 💪'],
      mentor: ['Welcome, traveler. What shall we explore today? 📚', 'Greetings. The path to progress awaits. 🌱'],
      drill_sergeant: ['Atten-tion! Time to get to work! 🫡', 'Listen up! We\'ve got goals to crush! 💥'],
      philosophical: ['The unexamined life is not worth living. What shall we examine today? 🌿', 'Welcome. What is it you truly seek? 💭'],
      buddy: ['Hey buddy! Good to see you! 👋', 'What\'s up! Ready to get stuff done? 😎'],
    };
    const arr = greetings[id] || greetings.buddy;
    return arr[Math.floor(Math.random() * arr.length)];
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setCoachTyping(true);

    try {
      const res = await api.post('/ai-coaching/chat', {
        message: userMsg.content,
        personality: personality.id,
      });

      const coachMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'coach',
        content: res.data.message || res.data.response,
        timestamp: new Date(),
      };

      setCoachTyping(false);
      setLastAction(res.data.action || 'advice');
      setMessages(prev => [...prev, coachMsg]);
    } catch (err) {
      setCoachTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'coach',
        content: 'I\'m here for you. Tell me more about what\'s going on.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string | null): string => {
    switch (action) {
      case 'celebrate': return '#F59E0B';
      case 'challenge': return '#EF4444';
      case 'encourage': return '#22C55E';
      default: return personality.primaryColor;
    }
  };

  if (compact) {
    return (
      <GlassCard sx={{ p: 2, maxWidth: 300 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ 
            fontSize: 24, 
            animation: 'bounce 1s infinite',
            '@keyframes bounce': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-5px)' },
            }
          }}>
            {personality.avatar}
          </Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: personality.primaryColor }}>
            {personality.name}
          </Typography>
        </Box>
        
        {messages.length > 0 && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            {messages[messages.length - 1].content}
          </Typography>
        )}

        <TextField
          size="small"
          fullWidth
          placeholder="Message your coach..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          InputProps={{
            endAdornment: (
              <IconButton size="small" onClick={handleSend} disabled={loading || !input.trim()}>
                <SendIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
      </GlassCard>
    );
  }

  return (
    <GlassCard sx={{ 
      p: 3, 
      maxWidth: 500, 
      mx: 'auto',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {onClose && (
        <IconButton 
          onClick={onClose} 
          sx={{ position: 'absolute', top: 8, right: 8 }}
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Zoom in={showAnimation}>
          <Box sx={{ 
            fontSize: 48, 
            animation: 'float 3s ease-in-out infinite',
            '@keyframes float': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-10px)' },
            }
          }}>
            {personality.avatar}
          </Box>
        </Zoom>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: personality.primaryColor }}>
            {personality.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {personality.description}
          </Typography>
        </Box>
      </Box>

      {lastAction && (
        <Chip 
          size="small"
          icon={<AutoAwesomeIcon />}
          label={lastAction.charAt(0).toUpperCase() + lastAction.slice(1)}
          sx={{ 
            mb: 2,
            bgcolor: `${getActionColor(lastAction)}20`,
            color: getActionColor(lastAction),
            fontWeight: 700,
          }}
        />
      )}

      <Box sx={{ 
        maxHeight: 300, 
        overflowY: 'auto', 
        mb: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}>
        {messages.map((msg) => (
          <Slide direction="up" in key={msg.id} mountOnEnter>
            <Box sx={{ 
              display: 'flex', 
              gap: 1,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}>
              {msg.role === 'coach' && (
                <Avatar sx={{ width: 32, height: 32, bgcolor: personality.primaryColor }}>
                  {personality.avatar}
                </Avatar>
              )}
              <Paper sx={{ 
                p: 1.5, 
                maxWidth: '80%',
                bgcolor: msg.role === 'user' 
                  ? `${personality.primaryColor}20` 
                  : 'rgba(255,255,255,0.05)',
                borderRadius: 2,
              }}>
                <Typography variant="body2">{msg.content}</Typography>
              </Paper>
            </Box>
          </Slide>
        ))}
        {coachTyping && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: personality.primaryColor }}>
              {personality.avatar}
            </Avatar>
            <Box sx={{ 
              display: 'flex', 
              gap: 0.5,
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.05)',
            }}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: personality.primaryColor,
                    animation: `typing 1.4s infinite ${i * 0.2}s`,
                    '@keyframes typing': {
                      '0%, 60%, 100%': { transform: 'translateY(0)' },
                      '30%': { transform: 'translateY(-5px)' },
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Ask your coach..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          sx={{ 
            minWidth: 'auto',
            bgcolor: personality.primaryColor,
            '&:hover': { bgcolor: personality.primaryColor, filter: 'brightness(1.1)' },
          }}
        >
          <SendIcon />
        </Button>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
        {['How do I stay motivated?', 'I\'m struggling with my goals', 'Give me a challenge'].map((suggestion) => (
          <Chip
            key={suggestion}
            label={suggestion}
            size="small"
            onClick={() => {
              setInput(suggestion);
              setTimeout(() => handleSend(), 100);
            }}
            sx={{ 
              cursor: 'pointer',
              '&:hover': { bgcolor: `${personality.primaryColor}20` },
            }}
          />
        ))}
      </Stack>
    </GlassCard>
  );
};

export default AnimatedCoach;
