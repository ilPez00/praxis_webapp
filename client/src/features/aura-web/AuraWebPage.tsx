/**
 * AuraWebPage — stripped Aura in the browser.
 * Camera capture + mic STT + Axiom chat for logging progress and delegating tasks.
 * Per-user: all data saved under the authenticated user's ID.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box, Typography, IconButton, TextField, Button,
  CircularProgress, Chip, Stack, Paper, Tooltip,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'axiom';
  content: string;
  ts: number;
  image?: string;
}

const AuraWebPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcript, setTranscript] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setCameraStream(stream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      toast.error('Camera unavailable. Check browser permissions.');
    }
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setCameraActive(false);
    setCapturedImage(null);
  };

  // Capture frame
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const { videoWidth: w, videoHeight: h } = videoRef.current;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    canvasRef.current.getContext('2d')?.drawImage(videoRef.current, 0, 0, w, h);
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
    setCapturedImage(dataUrl);
    toast.success('Frame captured — send to Axiom with your message.');
  };

  // Speech-to-text via Web Speech API
  const startVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setTranscript(t);
      setInput(t);
    };
    rec.onerror = () => {
      setRecording(false);
      toast.error('Voice recognition error.');
    };
    rec.onend = () => setRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
  }, []);

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  // Send to Axiom
  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content && !capturedImage) return;

    const userMsg: Message = { role: 'user', content: content || '(image)', ts: Date.now(), image: capturedImage ?? undefined };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setTranscript('');
    setCapturedImage(null);
    setThinking(true);

    try {
      const payload: any = { userPrompt: content };
      if (capturedImage) payload.imageBase64 = capturedImage.split(',')[1];
      const res = await api.post('/axiom/query', payload);
      const axiomMsg: Message = { role: 'axiom', content: res.data.response ?? res.data.answer ?? '…', ts: Date.now() };
      setMessages(m => [...m, axiomMsg]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Axiom unavailable.';
      setMessages(m => [...m, { role: 'axiom', content: msg, ts: Date.now() }]);
    } finally {
      setThinking(false);
    }
  };

  // Quick actions
  const quickActions = [
    { label: 'Log progress', prompt: 'Log my current progress on my goals based on what I just captured.' },
    { label: 'Delegate task', prompt: 'Help me delegate the task I described to the right system or person.' },
    { label: 'Daily brief', prompt: 'Give me my daily brief and top priority action for today.' },
    { label: 'Reflect', prompt: 'Help me reflect on what I observed and what it means for my goals.' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <AutoAwesomeIcon sx={{ color: '#F59E0B', fontSize: 20 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#F59E0B', letterSpacing: '-0.01em' }}>Aura</Typography>
        <Chip label="web" size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontWeight: 700 }} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title={cameraActive ? 'Stop camera' : 'Start camera'}>
          <IconButton size="small" onClick={cameraActive ? stopCamera : startCamera} sx={{ color: cameraActive ? '#10B981' : 'text.secondary' }}>
            <CameraAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={recording ? 'Stop mic' : 'Start mic'}>
          <IconButton size="small" onClick={recording ? stopVoice : startVoice} sx={{ color: recording ? '#EF4444' : 'text.secondary' }}>
            {recording ? <MicOffIcon fontSize="small" /> : <MicIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Camera preview */}
      {cameraActive && (
        <Box sx={{ position: 'relative', bgcolor: '#000', maxHeight: 220, overflow: 'hidden' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 1 }}>
            {capturedImage && (
              <Chip label="frame ready" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.9)', color: '#fff', fontWeight: 700, fontSize: '0.65rem' }} />
            )}
            <IconButton onClick={captureFrame} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}>
              <CameraAltIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Quick actions */}
      <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 0.75, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
        {quickActions.map(qa => (
          <Chip
            key={qa.label}
            label={qa.label}
            size="small"
            onClick={() => send(qa.prompt)}
            sx={{ cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600, bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(245,158,11,0.15)', borderColor: '#F59E0B' }, border: '1px solid rgba(255,255,255,0.1)' }}
          />
        ))}
      </Box>

      {/* Message thread */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {messages.length === 0 && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, gap: 1.5 }}>
            <AutoAwesomeIcon sx={{ fontSize: 40, color: 'rgba(245,158,11,0.3)' }} />
            <Typography variant="body2" color="text.disabled" align="center">
              Camera · Mic · Axiom<br />Log progress, delegate tasks, or just ask.
            </Typography>
          </Box>
        )}
        {messages.map((msg, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <Paper sx={{
              maxWidth: '80%', px: 2, py: 1.5, borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              bgcolor: msg.role === 'user' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
              border: msg.role === 'user' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.07)',
            }}>
              {msg.image && (
                <Box component="img" src={msg.image} sx={{ width: '100%', borderRadius: '8px', mb: 1, maxHeight: 120, objectFit: 'cover' }} />
              )}
              <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.55, color: msg.role === 'axiom' ? 'text.primary' : '#FDE68A', whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', mt: 0.5, display: 'block' }}>
                {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Paper>
          </Box>
        ))}
        {thinking && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} sx={{ color: '#F59E0B' }} />
            <Typography variant="caption" color="text.disabled">Axiom thinking…</Typography>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input row */}
      <Box sx={{ px: 2, pb: 3, pt: 1, borderTop: '1px solid rgba(255,255,255,0.07)', bgcolor: 'background.default' }}>
        {recording && (
          <Typography variant="caption" sx={{ color: '#EF4444', display: 'block', mb: 0.75, fontWeight: 700 }}>
            🎙 {transcript || 'Listening…'}
          </Typography>
        )}
        {capturedImage && (
          <Box sx={{ mb: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="img" src={capturedImage} sx={{ width: 40, height: 30, objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.4)' }} />
            <Typography variant="caption" sx={{ color: '#10B981' }}>Frame attached</Typography>
            <IconButton size="small" onClick={() => setCapturedImage(null)} sx={{ color: 'text.disabled', p: 0.25 }}>
              <StopIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={4}
            placeholder="Ask Axiom, log progress, delegate a task…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '14px',
                fontSize: '0.85rem',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
              },
            }}
          />
          <IconButton
            onClick={() => send()}
            disabled={thinking || (!input.trim() && !capturedImage)}
            sx={{
              bgcolor: '#F59E0B', color: '#0D0E1A', width: 42, height: 42, alignSelf: 'flex-end',
              '&:hover': { bgcolor: '#FBBF24' },
              '&:disabled': { bgcolor: 'rgba(245,158,11,0.15)', color: 'rgba(245,158,11,0.3)' },
            }}
          >
            {thinking ? <CircularProgress size={18} sx={{ color: '#0D0E1A' }} /> : <SendIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default AuraWebPage;
