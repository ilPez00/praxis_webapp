import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Stack, TextField, CircularProgress, IconButton } from '@mui/material';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import TodayIcon from '@mui/icons-material/Today';
import BarChartIcon from '@mui/icons-material/BarChart';
import PlaceIcon from '@mui/icons-material/Place';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import GlassCard from '../../components/common/GlassCard';
import { supabase } from '../../lib/supabase';
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
  const [statedLocation, setStatedLocation] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);

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
          toast.success('GPS position locked! 📍');
        } catch (err) {
          console.error(err);
        }
      },
      () => toast.error('Location access denied.'),
      { enableHighAccuracy: true }
    );
  };

  const steps: Step[] = [
    {
      num: 1,
      icon: <PlaceIcon sx={{ fontSize: 32 }} />,
      title: 'Set your home base',
      description: "Tell us where you're building from. This helps us find nearby users, study spots, and events in your city.",
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
              ✓ Home base set to {statedLocation || 'detected position'}
            </Typography>
          )}
        </Box>
      )
    },
    {
      num: 2,
      icon: <TrackChangesIcon sx={{ fontSize: 32 }} />,
      title: 'Build your goal tree',
      description: "Map out what you're working toward. Break big ambitions into trackable sub-goals — the more specific, the better Praxis works for you. Your goal tree is the foundation of everything — it's how Praxis understands what you're building and helps you stay accountable.",
      cta: 'Set up goals →',
      to: '/notes',
      color: '#F59E0B',
    },
    {
      num: 3,
      icon: <TodayIcon sx={{ fontSize: 32 }} />,
      title: 'Log your progress every day',
      description: "Each goal gets a daily tracker widget. Take 30 seconds after each session to log what you did. Use the mood selector to capture how you felt. Over time, you'll see which conditions lead to your best work. The streak is real — so is the momentum.",
      cta: 'See how it works →',
      to: '/notes',
      color: '#10B981',
    },
    {
      num: 4,
      icon: <BarChartIcon sx={{ fontSize: 32 }} />,
      title: 'Watch your habits form',
      description: 'Your activity calendar fills in as you log. After a week you\'ll see patterns. After a month, you\'ll have proof of what you\'re capable of. Share your progress with your accountability partner or keep it private — either way, you\'re building the most valuable skill: consistency.',
      cta: 'View analytics →',
      to: '/analytics',
      color: '#8B5CF6',
    },
    {
      num: 5,
      icon: <PlaceIcon sx={{ fontSize: 32 }} />,
      title: 'Discover places & events',
      description: "Praxis isn't just about solo work. Find study spots, co-working spaces, and events in your city. Meet other builders who are serious about growth. Your next accountability partner, co-founder, or friend might be one introduction away.",
      cta: 'Explore →',
      to: '/discover',
      color: '#EC4899',
    },
    {
      num: 6,
      icon: <MyLocationIcon sx={{ fontSize: 32 }} />,
      title: 'Get your daily protocol',
      description: "Every morning at midnight, Axiom — your AI coach — analyzes your progress and generates a personalized daily protocol. You'll get a morning routine, afternoon deep work block, evening reflection, and one challenge to push you just outside your comfort zone. All based on YOUR actual goals and progress.",
      cta: 'Meet Axiom →',
      to: '/coaching',
      color: '#A78BFA',
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
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 480, mx: 'auto', lineHeight: 1.6 }}>
            Build the tracking habit in four steps. No followers needed — just you and your goals.
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
      </Container>
    </Box>
  );
};

export default GettingStartedPage;
