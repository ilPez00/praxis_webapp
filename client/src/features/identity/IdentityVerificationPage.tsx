import React, { useRef, useEffect, useState } from 'react';
import { Container, Box, Typography, Button, Paper, CircularProgress, Alert, LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';

const IdentityVerificationPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();

  const [loadingVideo, setLoadingVideo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'in_progress' | 'verified' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setLoadingVideo(false);
        }
      })
      .catch(err => {
        console.error('Error accessing webcam:', err);
        setError('Failed to access webcam. Please ensure camera permissions are granted.');
        setLoadingVideo(false);
      });

    const video = videoRef.current;
    return () => {
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleVerify = () => {
    setVerificationStatus('in_progress');
    setProgress(0);
    setError(null);

    // Simulate face analysis over 3 seconds
    const start = Date.now();
    const duration = 3000;
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (elapsed >= duration) {
        clearInterval(tick);
        setVerificationStatus('verified');
        updateUserVerificationStatus(true);
      }
    }, 50);
  };

  const updateUserVerificationStatus = async (isVerified: boolean) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ is_verified: isVerified })
        .eq('id', user.id);
      if (isVerified) {
        setTimeout(() => navigate('/dashboard'), 1200);
      }
    } catch (err) {
      console.error('Error updating verification status:', err);
    }
  };

  if (userLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="warning">You must be logged in to verify your identity.</Alert>
        <Button onClick={() => navigate('/login')} sx={{ mt: 2 }}>Login</Button>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Identity Verification
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary">
          For enhanced trust and authenticity, please verify your identity using facial recognition.
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ position: 'relative', width: '100%', maxWidth: 640, borderRadius: 1, overflow: 'hidden', bgcolor: 'black' }}>
          {loadingVideo && (
            <Box sx={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}
          <video
            ref={videoRef}
            autoPlay
            muted
            style={{ width: '100%', height: 'auto', display: loadingVideo ? 'none' : 'block', transform: 'scaleX(-1)' }}
          />
        </Box>

        {verificationStatus === 'in_progress' && (
          <Box sx={{ width: '100%', maxWidth: 640 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Analysing face… {progress}%
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {verificationStatus === 'idle' && !loadingVideo && !error && (
          <Button variant="contained" color="primary" onClick={handleVerify}>
            Start Verification
          </Button>
        )}

        {verificationStatus === 'verified' && (
          <Alert severity="success">Identity Verified Successfully! Redirecting…</Alert>
        )}

        {verificationStatus === 'failed' && (
          <Alert severity="error">Verification Failed. Please try again.</Alert>
        )}

        {verificationStatus !== 'verified' && (
          <Button variant="outlined" onClick={() => navigate('/dashboard')} sx={{ mt: 1 }}>
            Skip for Now
          </Button>
        )}
      </Paper>
    </Container>
  );
};

export default IdentityVerificationPage;
