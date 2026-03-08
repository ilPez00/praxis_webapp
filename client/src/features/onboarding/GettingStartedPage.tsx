import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import TodayIcon from '@mui/icons-material/Today';
import BarChartIcon from '@mui/icons-material/BarChart';
import GlassCard from '../../components/common/GlassCard';

interface Step {
  num: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  to: string;
  color: string;
}

const GettingStartedPage: React.FC<{ userId: string }> = ({ userId: _userId }) => {
  const navigate = useNavigate();

  const steps: Step[] = [
    {
      num: 1,
      icon: <TrackChangesIcon sx={{ fontSize: 32 }} />,
      title: 'Build your goal tree',
      description: "Map out what you're working toward. Break big ambitions into trackable sub-goals — the more specific, the better Praxis works for you.",
      cta: 'Set up goals →',
      to: '/goal-selection',
      color: '#F59E0B',
    },
    {
      num: 2,
      icon: <TodayIcon sx={{ fontSize: 32 }} />,
      title: 'Log your progress every day',
      description: "Each goal gets a daily tracker widget. Take 30 seconds after each session to log what you did. The streak is real — so is the momentum.",
      cta: 'See how it works →',
      to: '/goal-selection',
      color: '#10B981',
    },
    {
      num: 3,
      icon: <BarChartIcon sx={{ fontSize: 32 }} />,
      title: 'Watch your habits form',
      description: 'Your habit calendar fills in as you log. After a week you\'ll see patterns. After a month, you\'ll have proof of what you\'re capable of.',
      cta: 'View analytics →',
      to: '/analytics',
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
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 480, mx: 'auto', lineHeight: 1.6 }}>
            Build the tracking habit in three steps. No followers needed — just you and your goals.
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
              </Box>
              <Button
                variant={step.num === 1 ? 'contained' : 'outlined'}
                onClick={() => navigate(step.to)}
                sx={{
                  borderRadius: '12px', fontWeight: 700, px: 3, py: 1.25, whiteSpace: 'nowrap', flexShrink: 0,
                  ...(step.num === 1
                    ? { background: `linear-gradient(135deg, ${step.color}, ${step.color}CC)`, boxShadow: `0 4px 16px ${step.color}44` }
                    : { borderColor: `${step.color}55`, color: step.color, '&:hover': { borderColor: step.color, bgcolor: `${step.color}0D` } }),
                }}
              >
                {step.cta}
              </Button>
            </GlassCard>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default GettingStartedPage;
