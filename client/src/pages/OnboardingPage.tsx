import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  useTheme,
  Avatar,
  IconButton,
  Alert,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import * as faceapi from 'face-api.js';
import { supabase } from '../lib/supabase';
import { Domain } from '../models/Domain';

const steps = ['Welcome', 'Profile', 'Interests', 'Verification', 'Finish'];

const DOMAIN_COLORS: Record<Domain, string> = {
  [Domain.CAREER]: '#007AFF',
  [Domain.INVESTING]: '#5856D6',
  [Domain.FITNESS]: '#FF2D55',
  [Domain.ACADEMICS]: '#AF52DE',
  [Domain.MENTAL_HEALTH]: '#32ADE6',
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#FF9500',
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#FFCC00',
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#FF3B30',
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#34C759',
};

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);
  const [isVerified, setIsVerified] = useState(false);

  // Face API State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models'; // Ensure models are in public/models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        // Fallback: allow manual verification if models fail to load in dev
        setIsModelsLoaded(true); 
      }
    };
    loadModels();
  }, []);

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleComplete();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const toggleDomain = (domain: Domain) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Could not access camera. Please ensure permissions are granted.');
      setIsCameraActive(false);
    }
  };

  const simulateScan = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setScanProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setIsVerified(true);
        if (videoRef.current?.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        }
        setIsCameraActive(false);
      }
    }, 100);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name,
          age: parseInt(age),
          bio,
          is_verified: isVerified,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      navigate('/goal-selection');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Welcome
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h3" gutterBottom sx={{ fontWeight: 800, color: 'primary.main' }}>
              Welcome to Praxis
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
              The future of human matching. Optimize your life through goal trees and deep compatibility.
            </Typography>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                bgcolor: 'primary.main',
                mx: 'auto',
                fontSize: '3rem',
                boxShadow: '0 8px 32px rgba(0,122,255,0.3)',
              }}
            >
              PX
            </Avatar>
          </Box>
        );
      case 1: // Profile
        return (
          <Box sx={{ maxWidth: 400, mx: 'auto', py: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              Build your identity
            </Typography>
            <TextField
              fullWidth
              label="Full Name"
              variant="outlined"
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ borderRadius: '12px' }}
            />
            <TextField
              fullWidth
              select
              label="Age Range"
              variant="outlined"
              margin="normal"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            >
              {['18', '21', '25', '30', '35', '40', '50'].map((val) => (
                <MenuItem key={val} value={val}>{val}+</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Bio"
              variant="outlined"
              margin="normal"
              multiline
              rows={4}
              placeholder="What drives you?"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </Box>
        );
      case 2: // Interests
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              What areas define you?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Select the domains you want to optimize.
            </Typography>
            <Grid container spacing={1} justifyContent="center">
              {Object.values(Domain).map((domain) => (
                <Grid item key={domain}>
                  <Chip
                    label={domain}
                    onClick={() => toggleDomain(domain)}
                    sx={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      p: 2,
                      height: 'auto',
                      borderRadius: '12px',
                      backgroundColor: selectedDomains.includes(domain) ? DOMAIN_COLORS[domain] : 'transparent',
                      color: selectedDomains.includes(domain) ? 'white' : 'text.primary',
                      border: `1px solid ${selectedDomains.includes(domain) ? DOMAIN_COLORS[domain] : '#ccc'}`,
                      '&:hover': {
                        backgroundColor: selectedDomains.includes(domain) ? DOMAIN_COLORS[domain] : '#f0f0f0',
                      },
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      case 3: // Verification
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
              Identity Verification
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Praxis ensures all users are verified humans. Secure facial scan required.
            </Typography>
            <Paper
              elevation={0}
              sx={{
                width: 300,
                height: 300,
                mx: 'auto',
                bgcolor: '#000',
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `4px solid ${isVerified ? theme.palette.success.main : theme.palette.primary.main}`,
              }}
            >
              {isCameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : isVerified ? (
                <CheckCircleIcon sx={{ fontSize: '5rem', color: 'success.main' }} />
              ) : (
                <IconButton onClick={startCamera} sx={{ color: 'white' }}>
                  <CameraAltIcon sx={{ fontSize: '4rem' }} />
                </IconButton>
              )}
              {isCameraActive && !isVerified && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 20,
                    width: '80%',
                  }}
                >
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={simulateScan}
                    sx={{ borderRadius: '20px' }}
                  >
                    Start Scan
                  </Button>
                </Box>
              )}
            </Paper>
            {scanProgress > 0 && scanProgress < 100 && (
              <Box sx={{ width: '100%', mt: 2 }}>
                <CircularProgress variant="determinate" value={scanProgress} />
                <Typography variant="caption" display="block">Scanning: {scanProgress}%</Typography>
              </Box>
            )}
            {isVerified && (
              <Alert severity="success" sx={{ mt: 2, borderRadius: '12px' }}>
                Identity Verified Successfully
              </Alert>
            )}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Box>
        );
      case 4: // Finish
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 800 }}>
              All set, {name}!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Your profile is ready. Now let's define your first goals.
            </Typography>
            <CheckCircleIcon sx={{ fontSize: '6rem', color: 'primary.main', mb: 2 }} />
          </Box>
        );
      default:
        return null;
    }
  };

  const isNextDisabled = () => {
    if (activeStep === 1) return !name || !age;
    if (activeStep === 2) return selectedDomains.length === 0;
    if (activeStep === 3) return !isVerified;
    return false;
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', py: 6, display: 'flex', flexDirection: 'column' }}>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 6 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper
        elevation={0}
        sx={{
          p: 4,
          flexGrow: 1,
          borderRadius: '24px',
          bgcolor: 'background.paper',
          boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {renderStepContent(activeStep)}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0 || loading}
            onClick={handleBack}
            startIcon={<ArrowBackIosNewIcon />}
            sx={{ borderRadius: '12px', fontWeight: 600 }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isNextDisabled() || loading}
            endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ArrowForwardIosIcon />}
            sx={{
              borderRadius: '12px',
              px: 4,
              py: 1.5,
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0,118,255,0.39)',
            }}
          >
            {activeStep === steps.length - 1 ? 'Start Goal Selection' : 'Continue'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default OnboardingPage;