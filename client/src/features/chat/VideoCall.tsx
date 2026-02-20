/**
 * VideoCall — peer-to-peer WebRTC video call via Supabase Broadcast signaling.
 *
 * Flow:
 *  1. Both sides subscribe to `webrtc_{channelName}` broadcast channel.
 *  2. Receiver (isInitiator=false) sends 'call-ready' on subscribe.
 *  3. Initiator receives 'call-ready' → creates & sends WebRTC offer.
 *  4. Receiver receives offer → creates & sends answer.
 *  5. Both exchange ICE candidates until connected.
 *  6. Either side can end the call ('call-ended' broadcast + cleanup).
 */

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { Box, Dialog, IconButton, Typography, CircularProgress } from '@mui/material';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';

interface Props {
  open: boolean;
  onClose: () => void;
  channelName: string;
  currentUserId: string;
  isInitiator: boolean;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const VideoCall: React.FC<Props> = ({ open, onClose, channelName, currentUserId, isInitiator }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sigRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected'>('connecting');
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    if (sigRef.current) supabase.removeChannel(sigRef.current);
    localStreamRef.current = null;
    pcRef.current = null;
    sigRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // RTCPeerConnection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (e) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
          setStatus('connected');
        };

        pc.onicecandidate = (e) => {
          if (e.candidate && sigRef.current) {
            sigRef.current.send({
              type: 'broadcast',
              event: 'webrtc-ice',
              payload: { candidate: e.candidate.toJSON(), from: currentUserId },
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') setStatus('connected');
          if (pc.connectionState === 'failed') {
            toast.error('Call connection failed.');
            cleanup();
            if (mounted) onClose();
          }
        };

        // Signaling channel
        const sig = supabase
          .channel(`webrtc_${channelName}`, { config: { broadcast: { self: false } } })
          .on('broadcast', { event: 'call-ready' }, async ({ payload }) => {
            // Initiator creates offer only after receiver signals ready
            if (!isInitiator || payload.from === currentUserId) return;
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sig.send({
                type: 'broadcast',
                event: 'webrtc-offer',
                payload: { sdp: pc.localDescription, from: currentUserId },
              });
            } catch (err) {
              console.error('Error creating offer:', err);
            }
          })
          .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
            if (payload.from === currentUserId) return;
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sig.send({
                type: 'broadcast',
                event: 'webrtc-answer',
                payload: { sdp: pc.localDescription, from: currentUserId },
              });
            } catch (err) {
              console.error('Error creating answer:', err);
            }
          })
          .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
            if (payload.from === currentUserId) return;
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } catch (err) {
              console.error('Error setting remote description:', err);
            }
          })
          .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
            if (payload.from === currentUserId) return;
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              // ICE errors are common and usually non-fatal
            }
          })
          .on('broadcast', { event: 'call-ended' }, ({ payload }) => {
            if (payload.from === currentUserId) return;
            cleanup();
            if (mounted) onClose();
          })
          .subscribe(() => {
            // Receiver signals ready → triggers initiator to create offer
            if (!isInitiator && mounted) {
              sig.send({
                type: 'broadcast',
                event: 'call-ready',
                payload: { from: currentUserId },
              });
            }
          });

        sigRef.current = sig;
      } catch (err: any) {
        console.error('VideoCall setup error:', err);
        if (err.name === 'NotAllowedError') {
          toast.error('Camera/mic permission denied.');
        } else {
          toast.error('Could not start video call.');
        }
        if (mounted) onClose();
      }
    };

    init();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [open, isInitiator]);

  const handleEnd = () => {
    sigRef.current?.send({
      type: 'broadcast',
      event: 'call-ended',
      payload: { from: currentUserId },
    });
    cleanup();
    onClose();
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicMuted(!track.enabled);
    }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOff(!track.enabled);
    }
  };

  return (
    <Dialog
      open={open}
      fullScreen
      PaperProps={{ sx: { bgcolor: '#000', overflow: 'hidden' } }}
    >
      {/* Remote video — full screen */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />

      {/* Connecting overlay */}
      {status === 'connecting' && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            bgcolor: 'rgba(0,0,0,0.7)',
          }}
        >
          <CircularProgress sx={{ color: 'primary.main' }} size={48} />
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
            {isInitiator ? 'Calling…' : 'Connecting…'}
          </Typography>
        </Box>
      )}

      {/* Local video — picture-in-picture */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          bottom: 112,
          right: 16,
          width: 120,
          height: 160,
          objectFit: 'cover',
          borderRadius: 12,
          border: '2px solid rgba(255,255,255,0.25)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          display: camOff ? 'none' : 'block',
        }}
      />

      {/* Control bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 3,
          py: 3,
          pb: 'max(24px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        }}
      >
        <IconButton
          onClick={toggleMic}
          sx={{
            bgcolor: micMuted ? 'error.main' : 'rgba(255,255,255,0.15)',
            color: '#fff',
            width: 52,
            height: 52,
            backdropFilter: 'blur(10px)',
            '&:hover': { bgcolor: micMuted ? 'error.dark' : 'rgba(255,255,255,0.25)' },
          }}
        >
          <MicOffIcon />
        </IconButton>

        <IconButton
          onClick={handleEnd}
          sx={{
            bgcolor: 'error.main',
            color: '#fff',
            width: 64,
            height: 64,
            '&:hover': { bgcolor: 'error.dark' },
          }}
        >
          <CallEndIcon sx={{ fontSize: 28 }} />
        </IconButton>

        <IconButton
          onClick={toggleCam}
          sx={{
            bgcolor: camOff ? 'error.main' : 'rgba(255,255,255,0.15)',
            color: '#fff',
            width: 52,
            height: 52,
            backdropFilter: 'blur(10px)',
            '&:hover': { bgcolor: camOff ? 'error.dark' : 'rgba(255,255,255,0.25)' },
          }}
        >
          <VideocamOffIcon />
        </IconButton>
      </Box>
    </Dialog>
  );
};

export default VideoCall;
