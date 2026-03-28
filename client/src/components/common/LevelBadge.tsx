/**
 * LevelBadge Component
 * Displays user's level with animated badge
 */

import React from 'react';
import { Box, Tooltip, Chip, Zoom } from '@mui/material';
import { keyframes } from '@mui/system';

interface LevelBadgeProps {
  level: number;
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
  animated?: boolean;
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#94A3B8', // Bronze (1-4)
  5: '#F59E0B', // Silver (5-9)
  10: '#FBBF24', // Gold (10-19)
  20: '#A78BFA', // Platinum (20-49)
  50: '#06B6D4', // Diamond (50+)
};

const glowAnimation = keyframes`
  0%, 100% { box-shadow: 0 0 5px currentColor, 0 0 10px currentColor; }
  50% { box-shadow: 0 0 15px currentColor, 0 0 25px currentColor, 0 0 35px currentColor; }
`;

const floatAnimation = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-3px); }
`;

const getLevelColor = (level: number): string => {
  if (level >= 50) return LEVEL_COLORS[50];
  if (level >= 20) return LEVEL_COLORS[20];
  if (level >= 10) return LEVEL_COLORS[10];
  if (level >= 5) return LEVEL_COLORS[5];
  return LEVEL_COLORS[1];
};

const getLevelTitle = (level: number): string => {
  if (level >= 50) return 'Diamond';
  if (level >= 20) return 'Platinum';
  if (level >= 10) return 'Gold';
  if (level >= 5) return 'Silver';
  return 'Bronze';
};

const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  size = 'medium',
  showTooltip = true,
  animated = true,
}) => {
  const color = getLevelColor(level);
  const title = getLevelTitle(level);

  const sizeConfig = {
    small: { width: 28, height: 28, fontSize: '0.7rem' },
    medium: { width: 36, height: 36, fontSize: '0.85rem' },
    large: { width: 48, height: 48, fontSize: '1.1rem' },
  };

  const config = sizeConfig[size];

  const badgeContent = (
    <Box
      sx={{
        width: config.width,
        height: config.height,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: config.fontSize,
        border: '2px solid rgba(255,255,255,0.3)',
        ...(animated && {
          animation: `${glowAnimation} 3s ease-in-out infinite, ${floatAnimation} 2s ease-in-out infinite`,
        }),
      }}
    >
      {level}
    </Box>
  );

  if (showTooltip) {
    return (
      <Tooltip
        title={
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 0.5 }}>
              Level {level}
            </Box>
            <Box sx={{ color: color, fontWeight: 600 }}>{title} Tier</Box>
            <Box sx={{ fontSize: '0.75rem', mt: 0.5, opacity: 0.8 }}>
              {level < 100 ? `${(level * 1000) - ((level - 1) * 1000)} XP to next level` : 'Max Level'}
            </Box>
          </Box>
        }
        TransitionComponent={Zoom}
      >
        {badgeContent}
      </Tooltip>
    );
  }

  return badgeContent;
};

export default LevelBadge;
