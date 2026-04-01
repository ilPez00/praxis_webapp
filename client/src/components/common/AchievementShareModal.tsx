/**
 * AchievementShareModal Component
 * Share unlocked achievements to social media with PP incentive
 */

import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, Divider, IconButton,
} from '@mui/material';
import { keyframes } from '@mui/system';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TwitterIcon from '@mui/icons-material/Twitter';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface Achievement {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  tier?: string;
}

interface AchievementShareModalProps {
  achievement: Achievement;
  open: boolean;
  onClose: () => void;
  onShareComplete?: () => void;
}

const celebrateAnimation = keyframes`
  0% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.1) rotate(-5deg); }
  50% { transform: scale(1.1) rotate(5deg); }
  75% { transform: scale(1.1) rotate(-5deg); }
  100% { transform: scale(1) rotate(0deg); }
`;

const sparkleAnimation = keyframes`
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
`;

const TIER_COLORS: Record<string, string> = {
  bronze: '#94A3B8',
  silver: '#E5E7EB',
  gold: '#FBBF24',
  platinum: '#A78BFA',
  diamond: '#06B6D4',
};

const AchievementShareModal: React.FC<AchievementShareModalProps> = ({
  achievement,
  open,
  onClose,
  onShareComplete,
}) => {
  const [sharing, setSharing] = useState(false);

  const shareText = `I just unlocked "${achievement.title}" on Praxis! 🏆`;
  const shareUrl = `${window.location.origin}/profile`;

  const handleShare = async (platform: 'twitter' | 'whatsapp' | 'telegram' | 'copy') => {
    setSharing(true);
    
    try {
      if (platform === 'copy') {
        await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
        toast.success('Link copied to clipboard! +10 PP');
      } else {
        const urls = {
          twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`,
          telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
        };
        window.open(urls[platform], '_blank');
        toast.success('Shared! +10 PP');
      }

      // Award PP for sharing (fire-and-forget)
      await api.post('/gamification/social/track', {
        actionType: 'achievement_share',
        amount: 1,
      }, { validateStatus: () => true });

      onShareComplete?.();
    } catch (err) {
      toast.error('Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const tierColor = TIER_COLORS[achievement.tier || 'bronze'];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
          border: `2px solid ${tierColor}`,
          borderRadius: '24px',
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            🎉 Achievement Unlocked!
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0, pb: 3 }}>
        {/* Achievement Badge */}
        <Box
          sx={{
            textAlign: 'center',
            py: 3,
            position: 'relative',
          }}
        >
          {/* Sparkle effects */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '10%',
              width: 20,
              height: 20,
              background: `radial-gradient(circle, ${tierColor}, transparent)`,
              borderRadius: '50%',
              animation: `${sparkleAnimation} 1.5s ease-in-out infinite`,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '20%',
              right: '15%',
              width: 15,
              height: 15,
              background: `radial-gradient(circle, ${tierColor}, transparent)`,
              borderRadius: '50%',
              animation: `${sparkleAnimation} 1.5s ease-in-out infinite 0.3s`,
            }}
          />

          {/* Achievement Icon */}
          <Box
            sx={{
              width: 100,
              height: 100,
              mx: 'auto',
              mb: 2,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${tierColor} 0%, ${tierColor}88 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              animation: `${celebrateAnimation} 1s ease-in-out`,
              boxShadow: `0 0 40px ${tierColor}60`,
            }}
          >
            {achievement.icon || '🏆'}
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
            {achievement.title}
          </Typography>
          {achievement.description && (
            <Typography variant="body1" color="text.secondary">
              {achievement.description}
            </Typography>
          )}

          {/* Tier Badge */}
          <Box
            sx={{
              display: 'inline-block',
              mt: 2,
              px: 2,
              py: 0.5,
              borderRadius: '20px',
              bgcolor: `${tierColor}20`,
              border: `1px solid ${tierColor}`,
              color: tierColor,
              fontWeight: 700,
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {achievement.tier || 'Bronze'} Tier
          </Box>
        </Box>

        <Divider sx={{ my: 3, borderColor: `${tierColor}30` }} />

        {/* Share Section */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Share your achievement!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Get +10 PP for sharing
          </Typography>

          <Stack direction="row" spacing={2} justifyContent="center">
            <IconButton
              onClick={() => handleShare('twitter')}
              disabled={sharing}
              sx={{
                width: 56,
                height: 56,
                bgcolor: '#1DA1F2',
                color: '#fff',
                '&:hover': { bgcolor: '#1a91da' },
              }}
            >
              <TwitterIcon fontSize="large" />
            </IconButton>

            <IconButton
              onClick={() => handleShare('whatsapp')}
              disabled={sharing}
              sx={{
                width: 56,
                height: 56,
                bgcolor: '#25D366',
                color: '#fff',
                '&:hover': { bgcolor: '#20bd5a' },
              }}
            >
              <WhatsAppIcon fontSize="large" />
            </IconButton>

            <IconButton
              onClick={() => handleShare('telegram')}
              disabled={sharing}
              sx={{
                width: 56,
                height: 56,
                bgcolor: '#0088cc',
                color: '#fff',
                '&:hover': { bgcolor: '#0077b5' },
              }}
            >
              <TelegramIcon fontSize="large" />
            </IconButton>

            <IconButton
              onClick={() => handleShare('copy')}
              disabled={sharing}
              sx={{
                width: 56,
                height: 56,
                bgcolor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <ContentCopyIcon fontSize="large" />
            </IconButton>
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onClose}
          sx={{
            py: 1.5,
            borderRadius: '12px',
            borderColor: 'rgba(255,255,255,0.2)',
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          Maybe Later
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AchievementShareModal;
