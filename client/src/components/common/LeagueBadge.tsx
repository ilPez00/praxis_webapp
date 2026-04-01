/**
 * LeagueBadge Component
 * Displays user's league with colored badge
 */

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { keyframes } from '@mui/system';

interface LeagueBadgeProps {
  league: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
}

const LEAGUE_CONFIG = {
  bronze: {
    color: '#94A3B8',
    name: 'Bronze',
    minPP: 0,
    icon: '🥉',
  },
  silver: {
    color: '#E5E7EB',
    name: 'Silver',
    minPP: 500,
    icon: '🥈',
  },
  gold: {
    color: '#FBBF24',
    name: 'Gold',
    minPP: 1500,
    icon: '🥇',
  },
  platinum: {
    color: '#A78BFA',
    name: 'Platinum',
    minPP: 5000,
    icon: '💎',
  },
  diamond: {
    color: '#06B6D4',
    name: 'Diamond',
    minPP: 15000,
    icon: '👑',
  },
};

const glowAnimation = keyframes`
  0%, 100% { box-shadow: 0 0 5px currentColor; }
  50% { box-shadow: 0 0 15px currentColor, 0 0 25px currentColor; }
`;

const LeagueBadge: React.FC<LeagueBadgeProps> = ({
  league,
  size = 'medium',
  showTooltip = true,
}) => {
  const config = LEAGUE_CONFIG[league] || LEAGUE_CONFIG.bronze;

  const sizeConfig = {
    small: { width: 24, height: 24, fontSize: '0.65rem' },
    medium: { width: 32, height: 32, fontSize: '0.8rem' },
    large: { width: 48, height: 48, fontSize: '1.2rem' },
  };

  const configSize = sizeConfig[size];

  const badgeContent = (
    <Box
      sx={{
        width: configSize.width,
        height: configSize.height,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}cc 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: configSize.fontSize,
        border: '2px solid rgba(255,255,255,0.3)',
        animation: `${glowAnimation} 3s ease-in-out infinite`,
      }}
    >
      {config.icon}
    </Box>
  );

  if (showTooltip) {
    return (
      <Tooltip
        title={
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: config.color }}>
              {config.name} League
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {config.minPP.toLocaleString()}+ PP
            </Typography>
          </Box>
        }
      >
        {badgeContent}
      </Tooltip>
    );
  }

  return badgeContent;
};

export default LeagueBadge;
