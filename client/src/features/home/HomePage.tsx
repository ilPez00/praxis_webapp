import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Box, Typography, Button, Stack, Chip } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BoltIcon from '@mui/icons-material/Bolt';

// Decorative floating orb — pure CSS animation, no dependencies
const Orb: React.FC<{ color: string; size: number; top: string; left: string; delay?: string }> = ({
  color, size, top, left, delay = '0s',
}) => (
  <Box
    sx={{
      position: 'absolute',
      top,
      left,
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      filter: 'blur(80px)',
      opacity: 0.35,
      animation: 'orbFloat 8s ease-in-out infinite',
      animationDelay: delay,
      pointerEvents: 'none',
      '@keyframes orbFloat': {
        '0%, 100%': { transform: 'translateY(0px) scale(1)' },
        '50%': { transform: 'translateY(-30px) scale(1.05)' },
      },
    }}
  />
);

const HomePage: React.FC = () => {
  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 64px)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Background orbs */}
      <Orb color="radial-gradient(circle, #F59E0B, transparent)" size={600} top="-10%" left="-5%" delay="0s" />
      <Orb color="radial-gradient(circle, #8B5CF6, transparent)" size={500} top="30%" left="65%" delay="2s" />
      <Orb color="radial-gradient(circle, #3B82F6, transparent)" size={400} top="60%" left="20%" delay="4s" />

      {/* Animated grid overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      <Container component="main" maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: 10 }}>
        <Box sx={{ maxWidth: 760, mx: 'auto', textAlign: 'center' }}>
          {/* Badge */}
          <Chip
            icon={<BoltIcon sx={{ color: '#F59E0B !important', fontSize: 16 }} />}
            label="Goal-Aligned Social Network"
            sx={{
              mb: 4,
              px: 1,
              bgcolor: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#F59E0B',
              fontWeight: 600,
              letterSpacing: '0.05em',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
            }}
          />

          {/* Headline */}
          <Typography
            component="h1"
            variant="h2"
            gutterBottom
            sx={{
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #F9FAFB 30%, #9CA3AF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 2,
            }}
          >
            Stop Swiping.{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Start Achieving.
            </Box>
          </Typography>

          {/* Subhead */}
          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ mb: 5, fontWeight: 400, lineHeight: 1.6, maxWidth: 580, mx: 'auto' }}
          >
            Praxis is a goal-aligned social OS. We connect you with driven individuals who share
            your ambitions — so you build real-world momentum together.
          </Typography>

          {/* CTA buttons */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              component={RouterLink}
              to="/signup"
              endIcon={<ArrowForwardIcon />}
              sx={{
                px: 4,
                py: 1.75,
                fontSize: '1rem',
                animation: 'ctaPulse 3s ease-in-out infinite',
                '@keyframes ctaPulse': {
                  '0%, 100%': { boxShadow: '0 4px 20px rgba(245,158,11,0.3)' },
                  '50%': { boxShadow: '0 8px 40px rgba(245,158,11,0.6)' },
                },
              }}
            >
              Find Your Praxis
            </Button>
            <Button
              variant="outlined"
              size="large"
              component={RouterLink}
              to="/login"
              sx={{ px: 4, py: 1.75, fontSize: '1rem' }}
            >
              Sign In
            </Button>
          </Stack>

          {/* Social proof strip */}
          <Stack
            direction="row"
            spacing={4}
            justifyContent="center"
            sx={{ mt: 8, opacity: 0.5 }}
          >
            {['Goal-Driven Matching', 'AI Coaching', 'Progress Tracking'].map((label) => (
              <Typography key={label} variant="caption" sx={{ fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {label}
              </Typography>
            ))}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default HomePage;
