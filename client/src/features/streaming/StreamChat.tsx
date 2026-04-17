import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, TextField, IconButton, Stack, Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import GlassCard from '../../components/common/GlassCard';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';

interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  text: string;
  type: 'chat' | 'donation' | 'system';
  timestamp: number;
}

interface StreamChatProps {
  streamId: string;
  isHost?: boolean;
}

export default function StreamChat({ streamId, isHost }: StreamChatProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const channel = supabase.channel(`stream-chat:${streamId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        setMessages(prev => [...prev.slice(-200), payload as ChatMessage]);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !user || !channelRef.current) return;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      userId: user.id,
      name: user.name || 'Anonymous',
      avatarUrl: user.avatar_url,
      text: input.trim(),
      type: 'chat',
      timestamp: Date.now(),
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: msg,
    });

    setInput('');
  };

  return (
    <GlassCard sx={{ p: 0, display: 'flex', flexDirection: 'column', height: { xs: 300, md: 500 } }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          💬 Live Chat
        </Typography>
      </Box>

      {/* Messages */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 1.5,
          py: 1,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
        }}
      >
        {messages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            No messages yet. Say hi! 👋
          </Typography>
        )}
        {messages.map(msg => (
          <Box key={msg.id} sx={{ mb: 0.75 }}>
            {msg.type === 'donation' ? (
              <Box sx={{
                bgcolor: 'rgba(245, 158, 11, 0.15)',
                borderRadius: '8px',
                px: 1.5,
                py: 0.75,
                textAlign: 'center',
              }}>
                <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700 }}>
                  ⚡ {msg.name} sent {msg.text} PP
                </Typography>
              </Box>
            ) : (
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <Avatar
                  src={msg.avatarUrl}
                  sx={{ width: 22, height: 22, mt: 0.25, fontSize: 11 }}
                >
                  {msg.name[0]}
                </Avatar>
                <Box>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: msg.userId === user?.id ? '#F59E0B' : '#A78BFA',
                      mr: 0.5,
                    }}
                  >
                    {msg.name}
                  </Typography>
                  <Typography component="span" variant="caption" sx={{ color: 'text.primary' }}>
                    {msg.text}
                  </Typography>
                </Box>
              </Stack>
            )}
          </Box>
        ))}
      </Box>

      {/* Input */}
      <Box sx={{ p: 1, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 0.5 }}>
        <TextField
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          size="small"
          fullWidth
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '20px',
              fontSize: '0.85rem',
            },
          }}
        />
        <IconButton onClick={sendMessage} size="small" sx={{ color: '#F59E0B' }}>
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>
    </GlassCard>
  );
}
