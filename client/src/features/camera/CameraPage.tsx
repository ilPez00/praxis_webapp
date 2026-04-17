import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box,
  IconButton,
  Stack,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';

type FacingMode = 'user' | 'environment';
type Source = 'camera' | 'screen';

const CameraPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get('mode') === 'record' ? 'record' : 'photo';
  const { user } = useUser();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [facing, setFacing] = useState<FacingMode>('user');
  const [source, setSource] = useState<Source>('camera');
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    setStarting(true);
    setError(null);
    stopStream();
    try {
      let stream: MediaStream;
      if (source === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: mode === 'record',
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: mode === 'record',
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setError(err.message || 'Camera access denied');
    } finally {
      setStarting(false);
    }
  }, [facing, source, mode, stopStream]);

  useEffect(() => {
    startStream();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, source]);

  const flipCamera = () => {
    if (source === 'screen') setSource('camera');
    setFacing(f => (f === 'user' ? 'environment' : 'user'));
  };

  const toggleScreenShare = () => {
    setSource(s => (s === 'camera' ? 'screen' : 'camera'));
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.92)
    );
    if (!blob) {
      toast.error('Capture failed');
      return;
    }
    await handleBlob(blob, 'jpg');
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    mr.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      await handleBlob(blob, 'webm');
    };
    recorderRef.current = mr;
    mr.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const handleBlob = async (blob: Blob, ext: string) => {
    const localUrl = URL.createObjectURL(blob);
    setCapturedUrl(localUrl);

    if (!user?.id) {
      toast.success('Saved locally — download below');
      return;
    }

    setUploading(true);
    try {
      const ts = Date.now();
      const path = `notebook/${user.id}/${ts}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('chat-media')
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path);
      toast.success('Saved to notebook');
      setCapturedUrl(pub.publicUrl);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed — saved locally');
    } finally {
      setUploading(false);
    }
  };

  const close = () => {
    stopStream();
    navigate(-1);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: '#000',
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1.5,
          color: '#fff',
        }}
      >
        <IconButton onClick={close} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 700 }}>
          {mode === 'record' ? 'Record' : 'Photo'} · {source === 'screen' ? 'Screen' : facing === 'user' ? 'Front' : 'Back'}
        </Typography>
        <Box sx={{ width: 40 }} />
      </Box>

      {/* Video preview */}
      <Box sx={{ flex: 1, position: 'relative', bgcolor: '#000' }}>
        {starting && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: '#fff' }} />
          </Box>
        )}
        {error && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Typography sx={{ color: '#fff', textAlign: 'center' }}>{error}</Typography>
          </Box>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: source === 'camera' && facing === 'user' ? 'scaleX(-1)' : 'none',
          }}
        />
        {capturedUrl && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              bgcolor: 'rgba(0,0,0,0.7)',
              p: 2,
              borderRadius: 2,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {uploading ? 'Uploading…' : 'Saved'}
            </Typography>
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              href={capturedUrl}
              download={`praxis-${Date.now()}.${mode === 'record' ? 'webm' : 'jpg'}`}
              sx={{ color: '#fff' }}
            >
              Open
            </Button>
          </Box>
        )}
      </Box>

      {/* Bottom controls */}
      <Stack
        direction="row"
        justifyContent="center"
        alignItems="center"
        spacing={4}
        sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.85)' }}
      >
        <IconButton onClick={flipCamera} sx={{ color: '#fff' }}>
          <CameraswitchIcon fontSize="large" />
        </IconButton>

        {mode === 'record' ? (
          recording ? (
            <IconButton
              onClick={stopRecording}
              sx={{
                bgcolor: '#fff',
                color: '#EF4444',
                width: 72,
                height: 72,
                '&:hover': { bgcolor: '#fff' },
              }}
            >
              <StopCircleIcon sx={{ fontSize: 52 }} />
            </IconButton>
          ) : (
            <IconButton
              onClick={startRecording}
              sx={{
                bgcolor: '#EF4444',
                color: '#fff',
                width: 72,
                height: 72,
                '&:hover': { bgcolor: '#DC2626' },
              }}
            >
              <FiberManualRecordIcon sx={{ fontSize: 52 }} />
            </IconButton>
          )
        ) : (
          <IconButton
            onClick={capturePhoto}
            sx={{
              bgcolor: '#fff',
              color: '#000',
              width: 72,
              height: 72,
              '&:hover': { bgcolor: '#eee' },
            }}
          >
            <PhotoCameraIcon sx={{ fontSize: 40 }} />
          </IconButton>
        )}

        <IconButton onClick={toggleScreenShare} sx={{ color: source === 'screen' ? '#A78BFA' : '#fff' }}>
          <ScreenShareIcon fontSize="large" />
        </IconButton>
      </Stack>
    </Box>
  );
};

export default CameraPage;
