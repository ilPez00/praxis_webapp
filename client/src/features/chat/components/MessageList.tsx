import React, { useEffect, useRef } from 'react';
import {
  Box,
  Stack,
  Avatar,
  Typography,
  Chip,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import ReferenceCard from '../../../components/common/ReferenceCard';

interface Message {
  id: string;
  sender_id?: string;
  senderId?: string;
  receiver_id?: string;
  receiverId?: string;
  content: string;
  timestamp?: string;
  created_at?: string;
  message_type?: string;
  media_url?: string;
  goal_node_id?: string;
  metadata?: any;
}

interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
  partnerName: string;
  isPartnerTyping: boolean;
}

const formatTime = (timestamp?: string, createdAt?: string) => {
  const dateStr = timestamp ?? createdAt ?? new Date().toISOString();
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  partnerName,
  isPartnerTyping,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPartnerTyping]);

  const renderMessage = (msg: Message) => {
    const isMine = (msg.sender_id ?? msg.senderId) === currentUserId;
    const msgType: string = msg.message_type ?? 'text';

    if (msgType === 'system') {
      return (
        <Box key={msg.id} sx={{ display: 'flex', justifyContent: 'center', py: 0.75 }}>
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

    if (msgType === 'completion_request') {
      const isVerifier = msg.receiver_id === currentUserId;
      let meta: any = {};
      try {
        meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata ?? {});
      } catch {
        meta = {};
      }
      return (
        <Box key={msg.id} sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', py: 0.5 }}>
          <Box
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
              Requesting verification of: <strong>{meta.goalName || 'a goal'}</strong>
            </Typography>
            {isVerifier && (
              <Typography variant="caption" color="text.secondary">
                Respond in chat to verify or reject
              </Typography>
            )}
            {!isVerifier && (
              <Typography variant="caption" color="text.secondary">
                Waiting for verification…
              </Typography>
            )}
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 1, opacity: 0.5, fontSize: '0.63rem' }}>
              {formatTime(msg.timestamp, msg.created_at)}
            </Typography>
          </Box>
        </Box>
      );
    }

    if (msgType === 'image') {
      return (
        <Box key={msg.id} sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
          {!isMine && (
            <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {partnerName.charAt(0)}
            </Avatar>
          )}
          <Box sx={{ maxWidth: '60%' }}>
            {!isMine && (
              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mb: 0.25, ml: 0.5 }}>
                {partnerName}
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
            <Typography variant="caption" sx={{ display: 'block', textAlign: isMine ? 'right' : 'left', mt: 0.5, opacity: 0.5 }}>
              {formatTime(msg.timestamp, msg.created_at)}
            </Typography>
          </Box>
        </Box>
      );
    }

    if (msgType === 'bet_placed') {
      let meta: any = {};
      try {
        meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata ?? {});
      } catch { meta = {}; }
      return (
        <Box key={msg.id} sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
          <Chip
            label={`${isMine ? 'You' : partnerName} staked ${meta.amount || '?'} PP on "${meta.goalName || 'a goal'}"`}
            size="small"
            sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: '0.7rem' }}
          />
        </Box>
      );
    }

    let parsedMeta: any = {};
    try {
      parsedMeta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : (msg.metadata ?? {});
    } catch { parsedMeta = {}; }
    const hasReference = parsedMeta?.reference;

    return (
      <Box key={msg.id} sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
        {!isMine && (
          <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
            {partnerName.charAt(0)}
          </Avatar>
        )}
        <Box sx={{ maxWidth: '70%' }}>
          {!isMine && (
            <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mb: 0.25, ml: 0.5 }}>
              {partnerName}
            </Typography>
          )}
          {hasReference && (
            <Box sx={{ mb: 0.5 }}>
              <ReferenceCard reference={parsedMeta.reference} compact />
            </Box>
          )}
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              bgcolor: isMine ? 'primary.main' : 'rgba(255,255,255,0.07)',
              color: isMine ? '#0A0B14' : 'text.primary',
              border: isMine ? 'none' : '1px solid rgba(255,255,255,0.08)',
              wordBreak: 'break-word',
            }}
          >
            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
              {msg.content}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', textAlign: isMine ? 'right' : 'left', mt: 0.5, opacity: 0.5 }}>
            {formatTime(msg.timestamp, msg.created_at)}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
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
            {partnerName.charAt(0)}
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
  );
};

export default MessageList;
