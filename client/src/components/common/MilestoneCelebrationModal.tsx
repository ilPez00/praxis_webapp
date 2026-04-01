/**
 * MilestoneCelebrationModal Component
 * Full-screen celebration for streak milestones and achievements
 */

import React, { useEffect } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  Stack,
  keyframes,
} from '@mui/material';
import Confetti from 'react-confetti';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface MilestoneCelebrationModalProps {
  open: boolean;
  milestone: number;
  type: 'streak' | 'achievement' | 'level';
  title: string;
  description?: string;
  reward?: {
    pp?: number;
    xp?: number;
    badge?: string;
  };
  onClose: () => void;
  onShare?: () => void;
}

const MILESTONE_ICONS: Record<number, string> = {
  7: '🔥',
  30: '🏆',
  90: '💎',
  365: '👑',
};

const bounceAnimation = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
`;

const glowAnimation = keyframes`
  0%, 100% { box-shadow: 0 0 20px currentColor; }
  50% { box-shadow: 0 0 40px currentColor, 0 0 60px currentColor; }
`;

const MilestoneCelebrationModal: React.FC<MilestoneCelebrationModalProps> = ({
  open,
  milestone,
  type,
  title,
  description,
  reward,
  onClose,
  onShare,
}) => {
  const [windowSize, setWindowSize] = React.useState({ width: 0, height: 0 });

  useEffect(() => {
    if (open) {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  }, [open]);

  const getIcon = () => {
    if (type === 'streak') return MILESTONE_ICONS[milestone] || '🎉';
    if (type === 'achievement') return '🏆';
    if (type === 'level') return '⚡';
    return '🎉';
  };

  const getColor = () => {
    if (milestone >= 365) return '#F59E0B';
    if (milestone >= 90) return '#A78BFA';
    if (milestone >= 30) return '#FBBF24';
    return '#F97316';
  };

  const color = getColor();

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
          numberOfPieces={500}
          gravity={0.12}
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
        {/* Animated Icon */}
        <Box
          sx={{
            mb: 4,
            fontSize: '8rem',
            animation: `${bounceAnimation} 1s ease-in-out infinite`,
          }}
        >
          {getIcon()}
        </Box>

        {/* Title */}
        <Typography
          variant="h2"
          sx={{
            fontWeight: 900,
            mb: 2,
            textAlign: 'center',
            color,
            textShadow: `0 0 30px ${color}60`,
          }}
        >
          {title}
        </Typography>

        {/* Milestone Number */}
        {type === 'streak' && (
          <Box
            sx={{
              mb: 3,
              textAlign: 'center',
            }}
          >
            <Typography
              variant="h1"
              sx={{
                fontSize: '8rem',
                fontWeight: 900,
                color,
                animation: `${glowAnimation} 2s ease-in-out infinite`,
                lineHeight: 1,
              }}
            >
              {milestone}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                mt: 1,
              }}
            >
              {milestone === 1 ? 'DAY' : 'DAYS'} STRAIGHT!
            </Typography>
          </Box>
        )}

        {/* Description */}
        {description && (
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{
              mb: 4,
              textAlign: 'center',
              maxWidth: 500,
              fontWeight: 500,
            }}
          >
            {description}
          </Typography>
        )}

        {/* Rewards */}
        {reward && (
          <Stack
            direction="row"
            spacing={3}
            sx={{
              mb: 5,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {reward.pp && (
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  bgcolor: 'rgba(245,158,11,0.15)',
                  borderRadius: 3,
                  border: `2px solid rgba(245,158,11,0.4)`,
                  textAlign: 'center',
                }}
              >
                <AutoAwesomeIcon sx={{ color: '#F59E0B', fontSize: 32, mb: 0.5 }} />
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#F59E0B' }}>
                  +{reward.pp} PP
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Praxis Points
                </Typography>
              </Box>
            )}

            {reward.xp && (
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  bgcolor: 'rgba(167,139,250,0.15)',
                  borderRadius: 3,
                  border: `2px solid rgba(167,139,250,0.4)`,
                  textAlign: 'center',
                }}
              >
                <EmojiEventsIcon sx={{ color: '#A78BFA', fontSize: 32, mb: 0.5 }} />
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#A78BFA' }}>
                  +{reward.xp} XP
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Experience
                </Typography>
              </Box>
            )}

            {reward.badge && (
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  bgcolor: 'rgba(6,182,212,0.15)',
                  borderRadius: 3,
                  border: `2px solid rgba(6,182,212,0.4)`,
                  textAlign: 'center',
                }}
              >
                <LocalFireDepartmentIcon sx={{ color: '#06B6D4', fontSize: 32, mb: 0.5 }} />
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#06B6D4' }}>
                  {reward.badge}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Badge Unlocked
                </Typography>
              </Box>
            )}
          </Stack>
        )}

        {/* Actions */}
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            size="large"
            onClick={onClose}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: 3,
              fontWeight: 700,
              borderColor: 'rgba(255,255,255,0.3)',
              color: 'text.secondary',
            }}
          >
            Keep Going
          </Button>

          {onShare && (
            <Button
              variant="contained"
              size="large"
              onClick={onShare}
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 3,
                fontWeight: 700,
                bgcolor: color,
                color: '#fff',
                boxShadow: `0 8px 30px ${color}60`,
                '&:hover': {
                  bgcolor: color,
                  boxShadow: `0 12px 40px ${color}80`,
                },
              }}
            >
              Share Achievement 🎉
            </Button>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
};

export default MilestoneCelebrationModal;
