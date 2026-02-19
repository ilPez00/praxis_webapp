import React, { useRef, useEffect, useState } from 'react';
import { Container, Box, Typography, Button, Paper, CircularProgress, Alert, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import { useUser } from '../hooks/useUser';
import { supabase } from '../lib/supabase'; // To update user profile

const IdentityVerificationPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();

  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'in_progress' | 'verified' | 'failed'>('idle');

  const MODEL_URL = '/models'; // Models assumed to be in public/models folder

  useEffect(() => {
    // Load face-api.js models
    const loadModels = async () => {
      try {
        setLoadingModels(true);
        setError(null);
        await faceapi.nets.tinyFaceDetector.load(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.load(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.load(MODEL_URL);
        setLoadingModels(false);
        startVideo(); // Start video stream after models are loaded
      } catch (err) {
        console.error('Error loading face-api.js models:', err);
        setError('Failed to load facial recognition models.');
        setLoadingModels(false);
      }
    };

    loadModels();

    // Cleanup function for video stream
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startVideo = () => {
    setLoadingVideo(true);
    navigator.mediaDevices.getUserMedia({ video: {} })
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
  };

  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current || loadingModels) return;

    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    // Run face detection continuously
    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        clearInterval(interval);
        return;
      }

      const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      }

      // In a real application, you would perform liveness detection and actual identity verification here.
      // For POC, we'll simulate a check.
      if (resizedDetections.length > 0 && verificationStatus === 'in_progress') {
        // Simple POC: if a face is detected and verification is 'in_progress', assume verified
        setVerificationStatus('verified');
        clearInterval(interval); // Stop interval once verified
        // Call backend to update user's verification status
        updateUserVerificationStatus(true);
      } else if (resizedDetections.length === 0 && verificationStatus === 'in_progress') {
        // If face disappears during verification
        setVerificationStatus('failed');
        clearInterval(interval);
        updateUserVerificationStatus(false);
      }
    }, 100); // Run detection every 100ms
  };

  const handleVerify = () => {
    setVerificationStatus('in_progress');
    setError(null);
  };

  const updateUserVerificationStatus = async (isVerified: boolean) => {
    if (!user) return;
    try {
      // Update the user's profile in Supabase
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ is_face_verified: isVerified }) // Assuming 'is_face_verified' column exists
        .eq('id', user.id);
      
      if (updateError) {
        throw updateError;
      }
      console.log('User face verification status updated:', isVerified);
      // Optionally navigate away or update UI based on final status
      if (isVerified) {
        navigate('/dashboard'); // Go to dashboard if verified
      }
    } catch (err) {
      console.error('Error updating face verification status:', err);
      setError('Failed to update verification status.');
    }
  };

  if (userLoading || loadingModels || loadingVideo) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>{loadingModels ? 'Loading AI models...' : 'Starting webcam...'}</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={startVideo} sx={{ mt: 2 }}>Try Webcam Again</Button>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
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

        <Box sx={{ position: 'relative', width: '100%', maxWidth: '640px', '& video': { width: '100%', height: 'auto', borderRadius: 1 }, '& canvas': { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } }}>
          <video ref={videoRef} autoPlay muted onPlay={handleVideoPlay} style={{ transform: 'scaleX(-1)' }} />
          <canvas ref={canvasRef} />
        </Box>

        {verificationStatus === 'idle' && (
          <Button variant="contained" color="primary" onClick={handleVerify} disabled={!videoRef.current?.paused === false}>
            Start Verification
          </Button>
        )}
        {verificationStatus === 'in_progress' && (
          <CircularProgress size={24} />
        )}
        {verificationStatus === 'verified' && (
          <Alert severity="success">Identity Verified Successfully!</Alert>
        )}
        {verificationStatus === 'failed' && (
          <Alert severity="error">Verification Failed. Please try again.</Alert>
        )}

        {verificationStatus !== 'verified' && (
          <Button variant="outlined" onClick={() => navigate('/dashboard')} sx={{ mt: 2 }}>
            Skip for Now (Not Recommended)
          </Button>
        )}
      </Paper>
    </Container>
  );
};

export default IdentityVerificationPage;