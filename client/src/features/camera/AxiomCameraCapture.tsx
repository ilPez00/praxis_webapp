import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
  TextField,
  Button,
  Paper,
  Stack,
  Chip,
  Fade,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { supabase } from '../../lib/supabase';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';

type FacingMode = 'user' | 'environment';
type Stage = 'camera' | 'analyzing' | 'result';

const AxiomCameraCapture: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [facing, setFacing] = useState<FacingMode>('environment');
  const [stage, setStage] = useState<Stage>('camera');
  const [analysis, setAnalysis] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [domain, setDomain] = useState<string>('General');
  const [userNote, setUserNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setError(err.message || 'Camera access denied');
    }
  }, [facing, stopStream]);

  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [startStream]);

  const flipCamera = () => {
    setFacing(f => (f === 'user' ? 'environment' : 'user'));
  };

  const captureAndAnalyze = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.85)
    );
    if (!blob) {
      toast.error('Capture failed');
      return;
    }

    const previewUrl = URL.createObjectURL(blob);
    setCapturedPreview(previewUrl);
    setStage('analyzing');

    stopStream();

    try {
      if (!user?.id) {
        toast.error('Not logged in');
        navigate('/login');
        return;
      }

      const ts = Date.now();
      const path = `axiom/${user.id}/${ts}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('chat-media')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      const res = await api.post('/notebook/capture', {
        imageUrl,
        text: userNote.trim() || undefined,
      });

      setAnalysis(res.data.analysis);
      setDomain(res.data.domain || 'General');
      setTags(res.data.tags || []);
      setStage('result');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Analysis failed';
      setError(msg);
      toast.error(msg);
      setStage('camera');
    }
  };

  const handleSaveAndView = () => {
    toast.success('Saved to notebook + diary');
    navigate('/notes');
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    setAnalysis('');
    setTags([]);
    setDomain('General');
    setError(null);
    setStage('camera');
    startStream();
  };

  const close = () => {
    stopStream();
    navigate(-1);
  };

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, bgcolor: '#000', zIndex: 1300,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, color: '#fff' }}>
        <IconButton onClick={close} sx={{ color: '#fff' }}><CloseIcon /></IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em', color: '#A78BFA' }}>
          {stage === 'camera' ? 'POINT & ASK AXIOM' : stage === 'analyzing' ? 'AXIOM IS WATCHING' : 'AXIOM SEES'}
        </Typography>
        <Box sx={{ width: 40 }} />
      </Box>

      {/* Camera / Preview area */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: '#000', overflow: 'hidden' }}>
        {stage === 'camera' && !error && (
          <>
            <video
              ref={videoRef}
              autoPlay playsInline muted
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                transform: facing === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />
            {/* Viewfinder frame */}
            <Box sx={{
              position: 'absolute', inset: '10%',
              border: '2px solid rgba(167,139,250,0.3)',
              borderRadius: '16px',
              pointerEvents: 'none',
              boxShadow: 'inset 0 0 60px rgba(167,139,250,0.08)',
            }} />
            {/* Tap hint */}
            <Typography sx={{
              position: 'absolute', bottom: 100, left: 0, right: 0,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              fontStyle: 'italic',
            }}>
              point at something worth noticing
            </Typography>
          </>
        )}

        {stage === 'analyzing' && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3,
          }}>
            <Box sx={{ position: 'relative' }}>
              <CircularProgress size={64} sx={{ color: '#A78BFA' }} />
              <AutoAwesomeIcon sx={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#A78BFA', fontSize: 28,
              }} />
            </Box>
            <Typography sx={{ color: '#A78BFA', fontWeight: 600, fontSize: '0.9rem' }}>
              Axiom is reading this moment...
            </Typography>
          </Box>
        )}

        {stage === 'result' && (
          <Fade in timeout={500}>
            <Box sx={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              p: 2, gap: 2,
              bgcolor: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              overflow: 'auto',
            }}>
              {/* Preview thumbnail */}
              {capturedPreview && (
                <Box sx={{
                  width: '100%', maxHeight: 200, overflow: 'hidden',
                  borderRadius: '12px', flexShrink: 0,
                }}>
                  <img src={capturedPreview} alt="capture" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              )}

              {/* Analysis */}
              <Paper sx={{
                p: 2, bgcolor: 'rgba(167,139,250,0.08)',
                border: '1px solid rgba(167,139,250,0.2)',
                borderRadius: '12px',
              }}>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeIcon sx={{ color: '#A78BFA', fontSize: 18 }} />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#A78BFA', letterSpacing: '0.05em' }}>
                      AXIOM
                    </Typography>
                  </Box>
                  <Typography sx={{ color: '#fff', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {analysis}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip label={domain} size="small" sx={{
                      bgcolor: 'rgba(167,139,250,0.15)', color: '#A78BFA',
                      border: '1px solid rgba(167,139,250,0.3)', fontSize: '0.65rem',
                    }} />
                    {tags.map(tag => (
                      <Chip key={tag} label={`#${tag}`} size="small" sx={{
                        bgcolor: 'rgba(139,92,246,0.1)', color: '#C4B5FD',
                        border: '1px solid rgba(139,92,246,0.2)', fontSize: '0.65rem',
                      }} />
                    ))}
                  </Stack>
                </Stack>
              </Paper>

              {/* Add note */}
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={3}
                placeholder="Add a note to this moment... (optional)"
                value={userNote}
                onChange={e => setUserNote(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    fontSize: '0.85rem',
                  },
                }}
              />

              {/* Actions */}
              <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleRetake}
                  sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                >
                  Retake
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleSaveAndView}
                  startIcon={<CheckCircleIcon />}
                  sx={{
                    borderRadius: '12px', fontWeight: 700,
                    bgcolor: '#A78BFA', '&:hover': { bgcolor: '#8B5CF6' },
                  }}
                >
                  Saved to Notebook
                </Button>
              </Stack>
            </Box>
          </Fade>
        )}

        {error && stage === 'camera' && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Typography sx={{ color: '#EF4444', textAlign: 'center' }}>{error}</Typography>
          </Box>
        )}
      </Box>

      {/* Bottom controls — only in camera stage */}
      {stage === 'camera' && !error && (
        <Stack
          direction="row"
          justifyContent="center"
          alignItems="center"
          spacing={4}
          sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.85)' }}
        >
          <IconButton onClick={flipCamera} sx={{ color: '#fff' }}>
            <FlipCameraAndroidIcon fontSize="large" />
          </IconButton>

          <IconButton
            onClick={captureAndAnalyze}
            sx={{
              bgcolor: '#A78BFA',
              color: '#fff',
              width: 72,
              height: 72,
              '&:hover': { bgcolor: '#8B5CF6' },
              boxShadow: '0 0 20px rgba(167,139,250,0.4)',
            }}
          >
            <PhotoCameraIcon sx={{ fontSize: 40 }} />
          </IconButton>

          <Box sx={{ width: 48 }} />
        </Stack>
      )}
    </Box>
  );
};

export default AxiomCameraCapture;
