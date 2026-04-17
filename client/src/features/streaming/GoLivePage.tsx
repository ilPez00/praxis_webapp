import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Button, TextField, Stack, IconButton,
  ToggleButton, ToggleButtonGroup, Chip, Badge,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopIcon from '@mui/icons-material/Stop';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import PeopleIcon from '@mui/icons-material/People';
import FavoriteIcon from '@mui/icons-material/Favorite';
import GlassCard from '../../components/common/GlassCard';
import StreamChat from './StreamChat';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function GoLivePage() {
  const { user } = useUser();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [streamType, setStreamType] = useState<'camera' | 'screen'>('camera');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [totalHonors, setTotalHonors] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);

  // Start capturing media
  const startMedia = useCallback(async (type: 'camera' | 'screen', facing: 'user' | 'environment') => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      let stream: MediaStream;
      if (type === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // If screen share ends (user clicks browser stop), end stream
      if (type === 'screen') {
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          if (isLive) handleEndStream();
        });
      }

      return stream;
    } catch (err: any) {
      toast.error(err.message || 'Failed to access media');
      return null;
    }
  }, [isLive]);

  // Go live
  const handleGoLive = async () => {
    if (!user) return;

    const stream = await startMedia(streamType, facingMode);
    if (!stream) return;

    try {
      const { data } = await api.post('/streams', {
        title: title || `${user.name}'s Live Stream`,
        stream_type: streamType,
      });

      setStreamId(data.id);
      setIsLive(true);

      // Set up Supabase Realtime channel for signaling
      const channel = supabase.channel(`stream:${data.id}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'viewer-join' }, async ({ payload }) => {
          const { viewerId } = payload;
          if (peersRef.current.has(viewerId)) return;

          // Create peer connection for this viewer
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          peersRef.current.set(viewerId, pc);

          // Add local tracks to peer
          stream.getTracks().forEach(track => pc.addTrack(track, stream));

          // Send ICE candidates
          pc.onicecandidate = (e) => {
            if (e.candidate) {
              channel.send({
                type: 'broadcast',
                event: 'ice-candidate',
                payload: { targetId: viewerId, candidate: e.candidate.toJSON() },
              });
            }
          };

          // Create and send offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: 'broadcast',
            event: 'offer',
            payload: { targetId: viewerId, offer: pc.localDescription },
          });

          setViewerCount(peersRef.current.size);
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          const { viewerId, answer } = payload;
          const pc = peersRef.current.get(viewerId);
          if (pc && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
          const { viewerId, candidate } = payload;
          const pc = peersRef.current.get(viewerId);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        })
        .on('broadcast', { event: 'viewer-leave' }, ({ payload }) => {
          const { viewerId } = payload;
          const pc = peersRef.current.get(viewerId);
          if (pc) {
            pc.close();
            peersRef.current.delete(viewerId);
            setViewerCount(peersRef.current.size);
          }
        })
        .on('broadcast', { event: 'donation' }, ({ payload }) => {
          setTotalHonors(prev => prev + (payload.amount || 0));
          toast(`🎁 ${payload.donorName} sent ${payload.amount} PP!`, { icon: '⚡' });
        })
        .subscribe();

      channelRef.current = channel;
      toast.success('You are live!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start stream');
      stream.getTracks().forEach(t => t.stop());
    }
  };

  // End stream
  const handleEndStream = async () => {
    // Close all peer connections
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();

    // Stop media
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // Notify viewers and unsubscribe
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'stream-ended',
        payload: {},
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // End on server
    if (streamId) {
      try { await api.post(`/streams/${streamId}/end`); } catch {}
    }

    setIsLive(false);
    setStreamId(null);
    setViewerCount(0);
    toast.success(`Stream ended. Peak: ${viewerCount} viewers, ${totalHonors} PP earned.`);
  };

  // Switch camera
  const handleSwitchCamera = async () => {
    if (!isLive || streamType !== 'camera') return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);

    const newStream = await startMedia('camera', newFacing);
    if (!newStream) return;

    // Replace tracks in all peer connections
    const videoTrack = newStream.getVideoTracks()[0];
    peersRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && videoTrack) sender.replaceTrack(videoTrack);
    });
  };

  // Update viewer count on server periodically
  useEffect(() => {
    if (!isLive || !streamId) return;
    const interval = setInterval(async () => {
      try {
        await api.post(`/streams/${streamId}/viewer-count`, { count: peersRef.current.size });
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [isLive, streamId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(pc => pc.close());
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 3 }}>
        📡 Go Live
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        {/* Video preview */}
        <Box sx={{ flex: 2 }}>
          <GlassCard sx={{ p: 0, overflow: 'hidden', position: 'relative' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                aspectRatio: '16/9',
                objectFit: 'cover',
                background: '#000',
                display: 'block',
              }}
            />
            {isLive && (
              <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 1 }}>
                <Chip label="🔴 LIVE" size="small" sx={{ bgcolor: '#EF4444', color: '#fff', fontWeight: 800 }} />
                <Chip
                  icon={<PeopleIcon sx={{ fontSize: 16 }} />}
                  label={viewerCount}
                  size="small"
                  sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: '#fff' }}
                />
                {totalHonors > 0 && (
                  <Chip
                    icon={<FavoriteIcon sx={{ fontSize: 16, color: '#F59E0B' }} />}
                    label={`${totalHonors} PP`}
                    size="small"
                    sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: '#F59E0B' }}
                  />
                )}
              </Box>
            )}
            {isLive && streamType === 'camera' && (
              <IconButton
                onClick={handleSwitchCamera}
                sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff' }}
              >
                <CameraswitchIcon />
              </IconButton>
            )}
          </GlassCard>
        </Box>

        {/* Controls / Chat */}
        <Box sx={{ flex: 1, minWidth: 280 }}>
          {!isLive ? (
            <GlassCard sx={{ p: 3 }}>
              <Stack spacing={2}>
                <TextField
                  label="Stream Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="What are you streaming?"
                />

                <ToggleButtonGroup
                  value={streamType}
                  exclusive
                  onChange={(_, v) => v && setStreamType(v)}
                  fullWidth
                  size="small"
                >
                  <ToggleButton value="camera">
                    <VideocamIcon sx={{ mr: 0.5 }} /> Camera
                  </ToggleButton>
                  <ToggleButton value="screen">
                    <ScreenShareIcon sx={{ mr: 0.5 }} /> Screen
                  </ToggleButton>
                </ToggleButtonGroup>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleGoLive}
                  startIcon={<VideocamIcon />}
                  sx={{
                    bgcolor: '#EF4444',
                    '&:hover': { bgcolor: '#DC2626' },
                    py: 1.5,
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    borderRadius: '12px',
                  }}
                >
                  Go Live
                </Button>
              </Stack>
            </GlassCard>
          ) : (
            <Stack spacing={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleEndStream}
                startIcon={<StopIcon />}
                sx={{
                  bgcolor: '#6B7280',
                  '&:hover': { bgcolor: '#4B5563' },
                  py: 1.5,
                  fontWeight: 700,
                  borderRadius: '12px',
                }}
              >
                End Stream
              </Button>

              {/* Share link */}
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  const url = `${window.location.origin}/stream/${streamId}`;
                  if (navigator.share) {
                    navigator.share({ title: title || 'Watch my stream!', url });
                  } else {
                    navigator.clipboard.writeText(url);
                    toast.success('Link copied!');
                  }
                }}
                sx={{ borderRadius: '12px' }}
              >
                Share Stream Link
              </Button>

              {/* Chat */}
              {streamId && (
                <StreamChat streamId={streamId} isHost />
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Container>
  );
}
