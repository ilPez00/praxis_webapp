import React, { useState } from 'react';
import { Container, Box, Typography, Button, CircularProgress, Alert, Stack, Divider, Chip } from '@mui/material';
import axios from 'axios';
import { useUser } from '../../hooks/useUser';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BoltIcon from '@mui/icons-material/Bolt';
import GlassCard from '../../components/common/GlassCard';

const PREMIUM_FEATURES = [
  { label: 'Unlimited root goals (base: 3)', note: 'Expand your goal tree without limits' },
  { label: 'Weekly AI Narrative', note: 'AI coach reads your journal + check-ins every week' },
  { label: 'Advanced Analytics & Percentiles', note: 'See how you rank vs the community' },
  { label: 'Priority in matching algorithm', note: 'Appear higher in compatible users\' discovery' },
  { label: 'Goal staking & betting (bonus multiplier)', note: '2× PP on peer-verified wins' },
  { label: 'Sparring partner access', note: 'Challenge aligned users to accountability duels' },
  { label: 'Verified badge on profile', note: 'Signal commitment and attract serious partners' },
];

const PP_TIERS = [
  { id: 'pp_500',  label: 'Starter',   pp: 500,   price: '$4.99',  highlight: false },
  { id: 'pp_1100', label: 'Popular',   pp: 1100,  price: '$9.99',  highlight: true  },
  { id: 'pp_3000', label: 'Best Value', pp: 3000, price: '$24.99', highlight: false },
];

/**
 * @description Redesigned UpgradePage with premium styling.
 */
const UpgradePage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPP, setLoadingPP] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgradeClick = async () => {
    if (!user || userLoading) {
      setError('You must be logged in to upgrade.');
      return;
    }
    setLoadingCheckout(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/stripe/create-checkout-session`, {
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

  const handleBuyPP = async (tierId: string) => {
    if (!user) { setError('You must be logged in.'); return; }
    setLoadingPP(tierId);
    setError(null);
    try {
      const { data } = await axios.post(`${API_URL}/stripe/create-pp-checkout`, {
        userId: user.id,
        tierId,
      });
      if (data.url) window.location.href = data.url;
      else setError('Failed to start checkout.');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to initiate PP purchase.');
    } finally {
      setLoadingPP(null);
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
              {PREMIUM_FEATURES.map((f) => (
                <Box key={f.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{f.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{f.note}</Typography>
                  </Box>
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

        {/* ── Buy Praxis Points ── */}
        <Box sx={{ mt: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, justifyContent: 'center' }}>
            <BoltIcon sx={{ color: '#A78BFA' }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Buy Praxis Points</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 4, maxWidth: 420, mx: 'auto' }}>
            Spend PP to boost visibility, suspend goals, unlock extra goal slots, place bets, and more.
            Available on <Button size="small" sx={{ p: 0, minWidth: 0, fontWeight: 700, color: '#A78BFA', textDecoration: 'underline' }} onClick={() => navigate('/marketplace')}>Marketplace</Button>.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            {PP_TIERS.map(tier => (
              <GlassCard
                key={tier.id}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  flex: 1,
                  maxWidth: 200,
                  border: tier.highlight
                    ? '2px solid rgba(167,139,250,0.5)'
                    : '1px solid rgba(255,255,255,0.08)',
                  position: 'relative',
                }}
              >
                {tier.highlight && (
                  <Chip
                    label="Most Popular"
                    size="small"
                    sx={{
                      position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                      bgcolor: '#8B5CF6', color: '#fff', fontWeight: 800, fontSize: '0.65rem',
                    }}
                  />
                )}
                <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 700, letterSpacing: '0.1em' }}>
                  {tier.label.toUpperCase()}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#A78BFA', my: 0.5 }}>
                  {tier.pp.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  PP
                </Typography>
                <Button
                  fullWidth
                  variant={tier.highlight ? 'contained' : 'outlined'}
                  size="small"
                  disabled={!!loadingPP || !user}
                  onClick={() => handleBuyPP(tier.id)}
                  sx={{
                    borderRadius: '10px', fontWeight: 800,
                    ...(tier.highlight && {
                      background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                      '&:hover': { background: 'linear-gradient(135deg, #9333EA, #4F46E5)' },
                    }),
                    ...(!tier.highlight && { borderColor: 'rgba(167,139,250,0.4)', color: '#A78BFA' }),
                  }}
                >
                  {loadingPP === tier.id ? <CircularProgress size={16} color="inherit" /> : tier.price}
                </Button>
              </GlassCard>
            ))}
          </Stack>
        </Box>

      </Container>
    </Box>
  );
};

export default UpgradePage;
