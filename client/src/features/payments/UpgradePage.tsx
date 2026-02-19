import React, { useState } from 'react';
import { Container, Box, Typography, Button, CircularProgress, Alert, Stack, Divider } from '@mui/material';
import axios from 'axios';
import { useUser } from '../../hooks/useUser';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GlassCard from '../../components/common/GlassCard';

const PREMIUM_FEATURES = [
  'Unlimited goals',
  'AI Coaching',
  'Advanced Analytics',
  'Priority matching',
  'Goal collaboration chat',
];

/**
 * @description Redesigned UpgradePage with premium styling.
 */
const UpgradePage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgradeClick = async () => {
    if (!user || userLoading) {
      setError('You must be logged in to upgrade.');
      return;
    }
    setLoadingCheckout(true);
    setError(null);
    try {
      const response = await axios.post('http://localhost:3001/stripe/create-checkout-session', {
        userId: user.id,
        email: user.email,
      });
      const { url } = response.data;
      if (url) window.location.href = url;
      else setError('Failed to get checkout URL from server.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate upgrade process.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (userLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: 'calc(100vh - 64px)',
      background: 'background.default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      py: 6,
    }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 24 }} />
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.2em' }}>
              LEVEL UP YOUR JOURNEY
            </Typography>
          </Box>
          <Typography variant="h2" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.02em' }}>
            Praxis{' '}
            <Box component="span" sx={{
              background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Premium
            </Box>
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
            Join the elite tier of goal-seekers and unlock the full power of our AI-driven ecosystem.
          </Typography>
        </Box>

        <Box sx={{
          background: 'linear-gradient(#111827,#111827) padding-box, linear-gradient(135deg,#F59E0B,#8B5CF6) border-box',
          border: '2px solid transparent',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(245,158,11,0.1)',
          position: 'relative',
        }}>
          <GlassCard sx={{ borderRadius: 0, border: 'none', p: 5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>Premium</Typography>
                <Typography variant="body2" color="text.secondary">Full platform access</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end' }}>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: 'primary.main' }}>$10</Typography>
                  <Typography variant="h6" color="text.secondary" sx={{ ml: 0.5 }}>/mo</Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ mb: 4, borderColor: 'rgba(255,255,255,0.08)' }} />

            <Stack spacing={2.5} sx={{ mb: 5 }}>
              {PREMIUM_FEATURES.map((feature) => (
                <Box key={feature} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 22 }} />
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>{feature}</Typography>
                </Box>
              ))}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleUpgradeClick}
              disabled={loadingCheckout || !user}
              sx={{
                py: 2,
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                boxShadow: '0 8px 20px rgba(245,158,11,0.3)',
                animation: loadingCheckout ? 'none' : 'glow-pulse 2s infinite',
                '@keyframes glow-pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(245,158,11,0.4)' },
                  '70%': { boxShadow: '0 0 0 15px rgba(245,158,11,0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
                },
                '&:hover': {
                  background: 'linear-gradient(135deg, #fbbf24, #F59E0B)',
                }
              }}
            >
              {loadingCheckout ? <CircularProgress size={26} color="inherit" /> : 'Get Started Now'}
            </Button>
            
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
              Secure payment via Stripe. Cancel anytime with one click.
            </Typography>
          </GlassCard>
        </Box>
      </Container>
    </Box>
  );
};

export default UpgradePage;
