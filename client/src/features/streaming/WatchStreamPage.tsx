import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Button, Chip, CircularProgress,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stack, Avatar,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import GlassCard from '../../components/common/GlassCard';
import StreamChat from './StreamChat';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';

export default function WatchStreamPage() {
  const { id: streamId } = useParams<{ id: string }>();
  const { user } = useUser();
  const navigate = useNavigate();

  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateAmount, setDonateAmount] = useState(10);
  const [donateMsg, setDonateMsg] = useState('');
  const [likes, setLikes] = useState(0);
  const [floatingHearts, setFloatingHearts] = useState<number[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);

  // Fetch stream info
  useEffect(() => {
    if (!streamId) return;
    api.get(`/streams/${streamId}`)
      .then(({ data }) => {
        setStream(data);
        if (data.status === 'ended') setEnded(true);
        setViewerCount(data.viewer_count || 0);
      })
      .catch(() => toast.error('Stream not found'))
      .finally(() => setLoading(false));
  }, [streamId]);

  // Connect to stream via WebRTC
  useEffect(() => {
    if (!streamId || !user || !stream || ended) return;

    const channel = supabase.channel(`stream:${streamId}`, {
      config: { broadcast: { self: false } },
    });

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    // When we receive remote track, display it
    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
      }
    };

    // Send ICE candidates to broadcaster
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        channel.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { viewerId: user.id, candidate: e.candidate.toJSON() },
        });
      }
    };

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.targetId !== user.id) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: 'broadcast',
          event: 'answer',
          payload: { viewerId: user.id, answer: pc.localDescription },
        });
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.targetId !== user.id) return;
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      })
      .on('broadcast', { event: 'stream-ended' }, () => {
        setEnded(true);
        toast('Stream has ended', { icon: '📡' });
      })
      .on('broadcast', { event: 'like' }, () => {
        setLikes(prev => prev + 1);
      })
      .on('broadcast', { event: 'donation' }, ({ payload }) => {
        toast(`🎁 ${payload.donorName} sent ${payload.amount} PP!`, { icon: '⚡' });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setViewerCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Tell broadcaster we're here
          channel.send({
            type: 'broadcast',
            event: 'viewer-join',
            payload: { viewerId: user.id, name: user.name },
          });
          // Track presence
          await channel.track({ user_id: user.id });
        }
      });

    channelRef.current = channel;

    return () => {
      // Notify leave
      channel.send({
        type: 'broadcast',
        event: 'viewer-leave',
        payload: { viewerId: user.id },
      });
      pc.close();
      supabase.removeChannel(channel);
    };
  }, [streamId, user, stream, ended]);

  const handleDonate = async () => {
    if (!streamId || donateAmount < 1) return;
    try {
      await api.post(`/streams/${streamId}/donate`, {
        amount: donateAmount,
        message: donateMsg || undefined,
      });
      // Broadcast donation to all viewers
      channelRef.current?.send({
        type: 'broadcast',
        event: 'donation',
        payload: { donorName: user?.name || 'Someone', amount: donateAmount, message: donateMsg },
      });
      toast.success(`Sent ${donateAmount} PP!`);
      setDonateOpen(false);
      setDonateMsg('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Donation failed');
    }
  };

  const handleLike = () => {
    setLikes(prev => prev + 1);
    // Floating heart animation
    const id = Date.now();
    setFloatingHearts(prev => [...prev, id]);
    setTimeout(() => setFloatingHearts(prev => prev.filter(h => h !== id)), 2000);
    // Broadcast to others
    channelRef.current?.send({
      type: 'broadcast',
      event: 'like',
      payload: {},
    });
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: stream?.title || 'Watch this stream!', url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!stream) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h5">Stream not found</Typography>
        <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>Back to Dashboard</Button>
      </Container>
    );
  }

  const streamer = stream.profiles;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        {/* Video */}
        <Box sx={{ flex: 2 }}>
          <GlassCard sx={{ p: 0, overflow: 'hidden', position: 'relative' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                aspectRatio: '16/9',
                objectFit: 'cover',
                background: '#000',
                display: 'block',
              }}
            />
            {/* Overlay badges */}
            <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 1 }}>
              {!ended ? (
                <Chip label="🔴 LIVE" size="small" sx={{ bgcolor: '#EF4444', color: '#fff', fontWeight: 800 }} />
              ) : (
                <Chip label="ENDED" size="small" sx={{ bgcolor: '#6B7280', color: '#fff', fontWeight: 700 }} />
              )}
              <Chip
                icon={<PeopleIcon sx={{ fontSize: 16 }} />}
                label={viewerCount}
                size="small"
                sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: '#fff' }}
              />
            </Box>

            {/* Floating hearts */}
            {floatingHearts.map(id => (
              <Box
                key={id}
                sx={{
                  position: 'absolute',
                  bottom: 60,
                  right: 20 + Math.random() * 40,
                  animation: 'floatUp 2s ease-out forwards',
                  '@keyframes floatUp': {
                    '0%': { opacity: 1, transform: 'translateY(0) scale(1)' },
                    '100%': { opacity: 0, transform: 'translateY(-150px) scale(1.5)' },
                  },
                }}
              >
                ❤️
              </Box>
            ))}
          </GlassCard>

          {/* Streamer info + actions */}
          <GlassCard sx={{ p: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar src={streamer?.avatar_url} sx={{ width: 40, height: 40 }}>
                  {streamer?.name?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    {stream.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {streamer?.name} {streamer?.username ? `@${streamer.username}` : ''}
                  </Typography>
                </Box>
              </Box>

              <Stack direction="row" spacing={1}>
                <IconButton onClick={handleLike} sx={{ color: '#EF4444' }}>
                  <FavoriteIcon />
                </IconButton>
                <IconButton onClick={handleShare} sx={{ color: '#3B82F6' }}>
                  <ShareIcon />
                </IconButton>
                {!ended && stream.user_id !== user?.id && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<VolunteerActivismIcon />}
                    onClick={() => setDonateOpen(true)}
                    sx={{
                      bgcolor: '#F59E0B',
                      '&:hover': { bgcolor: '#D97706' },
                      fontWeight: 700,
                      borderRadius: '10px',
                    }}
                  >
                    Donate PP
                  </Button>
                )}
              </Stack>
            </Box>
          </GlassCard>
        </Box>

        {/* Chat sidebar */}
        <Box sx={{ flex: 1, minWidth: 300 }}>
          {streamId && <StreamChat streamId={streamId} />}
        </Box>
      </Box>

      {/* Donate dialog */}
      <Dialog open={donateOpen} onClose={() => setDonateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>⚡ Send PP to {streamer?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1}>
              {[5, 10, 25, 50, 100].map(amt => (
                <Chip
                  key={amt}
                  label={`${amt} PP`}
                  onClick={() => setDonateAmount(amt)}
                  sx={{
                    fontWeight: 700,
                    bgcolor: donateAmount === amt ? '#F59E0B' : undefined,
                    color: donateAmount === amt ? '#000' : undefined,
                  }}
                />
              ))}
            </Stack>
            <TextField
              label="Message (optional)"
              value={donateMsg}
              onChange={e => setDonateMsg(e.target.value)}
              size="small"
              fullWidth
              placeholder="Nice stream!"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDonateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDonate}
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' }, fontWeight: 700 }}
          >
            Send {donateAmount} PP
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
