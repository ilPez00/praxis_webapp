import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Stack, Avatar, Chip,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import PeopleIcon from '@mui/icons-material/People';
import GlassCard from '../../components/common/GlassCard';
import api from '../../lib/api';

interface LiveStream {
  id: string;
  title: string;
  stream_type: string;
  viewer_count: number;
  started_at: string;
  profiles: { name: string; avatar_url: string; username: string };
}

interface LiveStreamsWidgetProps {
  roomId?: string;  // Filter by group room
}

export default function LiveStreamsWidget({ roomId }: LiveStreamsWidgetProps) {
  const navigate = useNavigate();
  const [streams, setStreams] = useState<LiveStream[]>([]);

  useEffect(() => {
    const url = roomId ? `/streams/live?room_id=${roomId}` : '/streams/live';
    api.get(url)
      .then(({ data }) => setStreams(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [roomId]);

  if (streams.length === 0) return null;

  return (
    <GlassCard sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <span style={{ color: '#EF4444' }}>🔴</span> Live Now
        </Typography>
        <Button
          size="small"
          startIcon={<VideocamIcon />}
          onClick={() => navigate('/go-live')}
          sx={{ color: '#EF4444', fontWeight: 700, fontSize: '0.75rem' }}
        >
          Go Live
        </Button>
      </Box>

      <Stack spacing={1}>
        {streams.map(s => (
          <Box
            key={s.id}
            onClick={() => navigate(`/stream/${s.id}`)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: '10px',
              bgcolor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.15)' },
            }}
          >
            <Avatar src={s.profiles?.avatar_url} sx={{ width: 36, height: 36 }}>
              {s.profiles?.name?.[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {s.profiles?.name}
              </Typography>
            </Box>
            <Chip
              icon={<PeopleIcon sx={{ fontSize: 14 }} />}
              label={s.viewer_count}
              size="small"
              sx={{ bgcolor: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '0.7rem' }}
            />
          </Box>
        ))}
      </Stack>
    </GlassCard>
  );
}
