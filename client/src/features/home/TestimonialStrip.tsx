import React from 'react';
import { Box, Typography, Avatar, Chip, Stack } from '@mui/material';
import GlassCard from '../../components/common/GlassCard';

const TESTIMONIALS = [
  {
    name: 'Marcus T.',
    domain: 'Fitness',
    domainColor: '#10B981',
    quote: "Found my training partner in two days. We've been holding each other accountable for six weeks straight.",
    initials: 'MT',
  },
  {
    name: 'Priya S.',
    domain: 'Career',
    domainColor: '#3B82F6',
    quote: 'The goal tree made me realize how scattered my ambitions were. Now I have a clear direction — and people pulling in the same one.',
    initials: 'PS',
  },
  {
    name: 'Leo R.',
    domain: 'Investing',
    domainColor: '#F59E0B',
    quote: "I came for the matching. I stayed for the community boards. This is the only social network where conversations actually matter.",
    initials: 'LR',
  },
];

const TestimonialStrip: React.FC = () => (
  <Box sx={{ mt: 8 }}>
    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.disabled', mb: 3 }}>
      What members say
    </Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
      {TESTIMONIALS.map((t) => (
        <GlassCard
          key={t.name}
          sx={{
            p: 2.5,
            flex: '1 1 0',
            maxWidth: 320,
            mx: 'auto',
            borderRadius: '16px',
            border: `1px solid ${t.domainColor}18`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: `${t.domainColor}22`, color: t.domainColor, fontSize: '0.8rem', fontWeight: 700 }}>
              {t.initials}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>{t.name}</Typography>
              <Chip label={t.domain} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: `${t.domainColor}18`, color: t.domainColor, border: `1px solid ${t.domainColor}33`, mt: 0.25 }} />
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, fontStyle: 'italic', fontSize: '0.82rem' }}>
            "{t.quote}"
          </Typography>
        </GlassCard>
      ))}
    </Stack>
  </Box>
);

export default TestimonialStrip;
