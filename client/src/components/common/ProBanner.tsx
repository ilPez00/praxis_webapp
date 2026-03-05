/**
 * ProBanner — compact contextual upgrade prompt.
 * Shown when a free-tier user hits a feature gate.
 */
import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LockIcon from '@mui/icons-material/Lock';

interface Props {
  message?: string;
  compact?: boolean; // smaller, inline variant
}

const ProBanner: React.FC<Props> = ({
  message = 'This feature is available on Praxis Pro.',
  compact = false,
}) => {
  const navigate = useNavigate();

  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(245,158,11,0.08) 100%)',
          border: '1px solid rgba(139,92,246,0.25)',
        }}
      >
        <LockIcon sx={{ fontSize: 16, color: '#8B5CF6', flexShrink: 0 }} />
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, fontSize: '0.82rem' }}>
          {message}
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={() => navigate('/upgrade')}
          sx={{
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.72rem',
            px: 1.5,
            py: 0.4,
            background: 'linear-gradient(135deg, #8B5CF6 0%, #F59E0B 100%)',
            color: '#fff',
            whiteSpace: 'nowrap',
            '&:hover': { opacity: 0.9 },
          }}
        >
          Upgrade
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(245,158,11,0.10) 100%)',
        border: '1px solid rgba(139,92,246,0.3)',
        textAlign: 'center',
      }}
    >
      <AutoAwesomeIcon sx={{ fontSize: 36, color: '#8B5CF6', mb: 1 }} />
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Praxis Pro
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 360, mx: 'auto' }}>
        {message}
      </Typography>
      <Button
        variant="contained"
        onClick={() => navigate('/upgrade')}
        sx={{
          borderRadius: '12px',
          fontWeight: 700,
          px: 4,
          background: 'linear-gradient(135deg, #8B5CF6 0%, #F59E0B 100%)',
          color: '#fff',
          '&:hover': { opacity: 0.9 },
        }}
        startIcon={<AutoAwesomeIcon />}
      >
        Upgrade to Pro
      </Button>
    </Box>
  );
};

export default ProBanner;
