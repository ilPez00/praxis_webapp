import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Stack, TextField, CircularProgress, IconButton } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExploreIcon from '@mui/icons-material/Explore';
import ShareIcon from '@mui/icons-material/Share';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GlassCard from '../../components/common/GlassCard';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Step {
  num: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: string;
  to?: string;
  color: string;
  component?: React.ReactNode;
}

const GettingStartedPage: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const { refetch } = useUser();
  const [statedLocation, setStatedLocation] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);
  const [completing, setCompleting] = useState(false);

  const handleSaveLocation = async () => {
    if (!statedLocation.trim()) return;
    setSavingLocation(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          stated_location: statedLocation.trim(),
          city: statedLocation.split(',')[0].trim()
        })
        .eq('id', userId);

      if (error) throw error;
      setLocationSaved(true);
      toast.success('Location set!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save location.');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          await supabase
            .from('profiles')
            .update({ latitude, longitude })
            .eq('id', userId);
          toast.success('GPS position locked!');
        } catch (err) {
          console.error(err);
        }
      },
      () => toast.error('Location access denied.'),
      { enableHighAccuracy: true }
    );
  };

  const handleFinish = async () => {
    setCompleting(true);
    try {
      await api.post('/users/complete-onboarding', { userId });
      // Also update auth metadata for faster client-side resolution
      await supabase.auth.updateUser({ data: { onboarding_completed: true } });
      await refetch();
      toast.success('Onboarding complete! Welcome to Praxis.');
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to complete onboarding.');
    } finally {
      setCompleting(false);
    }
  };

  const steps: Step[] = [
    {
      num: 1,
      icon: <PlaceIcon sx={{ fontSize: 32 }} />,
      title: 'Set your home base',
      description: "Tell us where you're building from. This helps find nearby users, study spots, and events in your city.",
      color: '#6366F1',
      component: (
        <Box sx={{ mt: 2 }}>
          {!locationSaved ? (
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="e.g. Verona, Italy"
                value={statedLocation}
                onChange={(e) => setStatedLocation(e.target.value)}
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}
              />
              <Button
                variant="contained"
                onClick={handleSaveLocation}
                disabled={savingLocation || !statedLocation.trim()}
                sx={{ borderRadius: '10px' }}
              >
                {savingLocation ? <CircularProgress size={20} /> : 'Save'}
              </Button>
              <IconButton onClick={handleDetectLocation} sx={{ color: 'primary.main' }}>
                <MyLocationIcon />
              </IconButton>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 700 }}>
              Home base set to {statedLocation || 'detected position'}
            </Typography>
          )}
        </Box>
      )
    },
    {
      num: 2,
      icon: <MenuBookIcon sx={{ fontSize: 32 }} />,
      title: 'Build your Notebook',
      description: "Your Notebook is the foundation of Praxis. Create topics, break them into chapters, and write notes inside each. The more you map out, the smarter Praxis gets at helping you stay on track.",
      cta: 'Open Notebook',
      to: '/notes',
      color: '#F59E0B',
    },
    {
      num: 3,
      icon: <FitnessCenterIcon sx={{ fontSize: 32 }} />,
      title: 'Track your daily progress',
      description: "Each domain comes with built-in trackers — lifts, cardio, meals, study hours, expenses, sleep, and more. Log what you did in 30 seconds. Your streak, mood, and consistency data build over time into a clear picture of your habits.",
      cta: 'Start tracking',
      to: '/notes',
      color: '#10B981',
    },
    {
      num: 4,
      icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
      title: 'Get your Axiom Protocol',
      description: "Every day, Axiom — your AI coach — analyzes your progress and generates a personalized daily protocol. Morning routine, afternoon deep work, evening reflection, and a challenge to push you forward. All based on your actual goals.",
      cta: 'Meet Axiom',
      to: '/coaching',
      color: '#A78BFA',
    },
    {
      num: 5,
      icon: <ExploreIcon sx={{ fontSize: 32 }} />,
      title: 'Discover people, places & events',
      description: "Find accountability partners matched by goal compatibility. Browse study spots, co-working spaces, and local events. Save any person, place, or event to your Diary for later. Your next co-founder or training partner might be one tap away.",
      cta: 'Explore',
      to: '/discover',
      color: '#EC4899',
    },
    {
      num: 6,
      icon: <ShareIcon sx={{ fontSize: 32 }} />,
      title: 'Download & share your journey',
      description: "Your Diary collects everything you save — people, places, events, and personal entries. Export your progress as a plain-text journal anytime. Share your streak on social media, or keep it private — either way, you're building proof of what you're capable of.",
      cta: 'Open Diary',
      to: '/diary',
      color: '#8B5CF6',
    },
  ];

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="md" sx={{ pt: 8, pb: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: '-0.03em', mb: 1.5 }}>
            Welcome to{' '}
            <Box component="span" sx={{
              background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)',
              backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Praxis
            </Box>
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 520, mx: 'auto', lineHeight: 1.6 }}>
            Your daily goal journal + accountability buddy. Here's how to get the most out of it.
          </Typography>
        </Box>

        <Stack spacing={3}>
          {steps.map((step) => (
            <GlassCard
              key={step.num}
              sx={{
                p: 3.5,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                border: `1px solid ${step.color}22`,
                borderRadius: '20px',
                flexDirection: { xs: 'column', sm: 'row' },
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              <Box sx={{
                width: 64, height: 64, borderRadius: '16px', flexShrink: 0,
                bgcolor: `${step.color}15`, color: step.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${step.color}30`,
              }}>
                {step.icon}
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption" sx={{ color: step.color, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Step {step.num}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>{step.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{step.description}</Typography>
                {step.component}
              </Box>
              {step.cta && step.to && (
                <Button
                  variant={step.num === 2 ? 'contained' : 'outlined'}
                  onClick={() => navigate(step.to!)}
                  sx={{
                    borderRadius: '12px', fontWeight: 700, px: 3, py: 1.25, whiteSpace: 'nowrap', flexShrink: 0,
                    ...(step.num === 2
                      ? { background: `linear-gradient(135deg, ${step.color}, ${step.color}CC)`, boxShadow: `0 4px 16px ${step.color}44` }
                      : { borderColor: `${step.color}55`, color: step.color, '&:hover': { borderColor: step.color, bgcolor: `${step.color}0D` } }),
                  }}
                >
                  {step.cta}
                </Button>
              )}
            </GlassCard>
          ))}
        </Stack>

        <Box sx={{ mt: 8, textAlign: 'center', pb: 10 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
            Ready to start your journey?
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleFinish}
            disabled={completing}
            startIcon={completing ? <CircularProgress size={20} color="inherit" /> : <CheckCircleOutlineIcon />}
            sx={{
              borderRadius: '16px',
              px: 6,
              py: 2,
              fontSize: '1.1rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)',
              boxShadow: '0 8px 32px rgba(139,92,246,0.4)',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 40px rgba(139,92,246,0.6)' },
              transition: 'all 0.2s',
            }}
          >
            {completing ? 'Completing...' : "Got it, let's go!"}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default GettingStartedPage;
