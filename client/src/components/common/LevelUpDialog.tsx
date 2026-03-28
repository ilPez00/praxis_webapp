/**
 * LevelUpDialog Component
 * Full-screen celebration when user levels up
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  Stack,
  LinearProgress,
  keyframes,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Confetti from 'react-confetti';

interface LevelUpDialogProps {
  open: boolean;
  oldLevel: number;
  newLevel: number;
  xpProgress: number;
  xpNeeded: number;
  onClose: () => void;
}

const LEVEL_TITLES: Record<number, string> = {
  1: 'Bronze',
  5: 'Silver',
  10: 'Gold',
  20: 'Platinum',
  50: 'Diamond',
};

const pulseAnimation = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const shineAnimation = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const getLevelTitle = (level: number): string => {
  if (level >= 50) return 'Diamond';
  if (level >= 20) return 'Platinum';
  if (level >= 10) return 'Gold';
  if (level >= 5) return 'Silver';
  return 'Bronze';
};

const getLevelColor = (level: number): string => {
  if (level >= 50) return '#06B6D4';
  if (level >= 20) return '#A78BFA';
  if (level >= 10) return '#FBBF24';
  if (level >= 5) return '#F59E0B';
  return '#94A3B8';
};

const LevelUpDialog: React.FC<LevelUpDialogProps> = ({
  open,
  oldLevel,
  newLevel,
  xpProgress,
  xpNeeded,
  onClose,
}) => {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const color = getLevelColor(newLevel);
  const title = getLevelTitle(newLevel);
  const tierChanged = getLevelTitle(oldLevel) !== title;

  useEffect(() => {
    if (open) {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          background: `linear-gradient(135deg, ${color}15 0%, ${color}0a 100%)`,
        },
      }}
    >
      {/* Confetti */}
      {open && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
          gravity={0.15}
          colors={[color, '#F59E0B', '#A78BFA', '#FBBF24', '#fff']}
        />
      )}

      {/* Content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 4,
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            mb: 4,
            animation: `${pulseAnimation} 2s ease-in-out infinite`,
          }}
        >
          <EmojiEventsIcon
            sx={{
              fontSize: 120,
              color: color,
              filter: `drop-shadow(0 0 30px ${color})`,
            }}
          />
        </Box>

        {/* Level Up Text */}
        <Typography
          variant="h3"
          sx={{
            fontWeight: 900,
            mb: 2,
            background: `linear-gradient(90deg, ${color}, #fff, ${color})`,
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: `${shineAnimation} 3s linear infinite`,
          }}
        >
          LEVEL UP!
        </Typography>

        {/* Level Display */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            mb: 4,
          }}
        >
          <Box
            sx={{
              opacity: 0.5,
              transform: 'scale(0.8)',
              transition: 'all 0.5s ease',
            }}
          >
            <Typography
              sx={{
                fontSize: '4rem',
                fontWeight: 900,
                color: 'text.secondary',
              }}
            >
              {oldLevel}
            </Typography>
          </Box>

          <Typography
            sx={{
              fontSize: '3rem',
              color: 'text.secondary',
            }}
          >
            →
          </Typography>

          <Box
            sx={{
              animation: `${pulseAnimation} 1s ease-in-out`,
            }}
          >
            <Typography
              sx={{
                fontSize: '6rem',
                fontWeight: 900,
                background: `linear-gradient(135deg, ${color}, #fff)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: `0 0 40px ${color}80`,
              }}
            >
              {newLevel}
            </Typography>
          </Box>
        </Box>

        {/* Tier Badge */}
        {tierChanged && (
          <Box
            sx={{
              mb: 4,
              px: 4,
              py: 2,
              bgcolor: `${color}20`,
              border: `2px solid ${color}`,
              borderRadius: 4,
              animation: `${pulseAnimation} 2s ease-in-out infinite`,
            }}
          >
            <Typography
              sx={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: color,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {title} Tier Unlocked!
            </Typography>
          </Box>
        )}

        {/* XP Progress */}
        <Box sx={{ width: '100%', maxWidth: 400, mb: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Progress to Level {newLevel + 1}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(xpProgress / xpNeeded) * 100}
            sx={{
              height: 12,
              borderRadius: 6,
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: color,
              },
            }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1, textAlign: 'center' }}
          >
            {xpProgress.toLocaleString()} / {xpNeeded.toLocaleString()} XP
          </Typography>
        </Box>

        {/* Continue Button */}
        <Button
          variant="contained"
          size="large"
          onClick={onClose}
          sx={{
            px: 6,
            py: 1.5,
            bgcolor: color,
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.1rem',
            borderRadius: 4,
            boxShadow: `0 4px 30px ${color}60`,
            '&:hover': {
              bgcolor: color,
              boxShadow: `0 6px 40px ${color}80`,
            },
          }}
        >
          Continue
        </Button>
      </Box>
    </Dialog>
  );
};

export default LevelUpDialog;
