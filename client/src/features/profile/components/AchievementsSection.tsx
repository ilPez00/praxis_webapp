import React, { useState } from 'react';
import {
  Box,
  Tooltip,
  Typography,
  IconButton,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ShareIcon from '@mui/icons-material/Share';
import GlassCard from '../../../components/common/GlassCard';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import AchievementShareModal from '../../../components/common/AchievementShareModal';
import { DOMAIN_COLORS } from '../../../types/goal';

interface Achievement {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  tier?: string;
  domain?: string;
}

interface AchievementsSectionProps {
  achievements: Achievement[];
  isOwnProfile: boolean;
  profileName: string;
}

const AchievementsSection: React.FC<AchievementsSectionProps> = ({
  achievements,
  isOwnProfile,
  profileName,
}) => {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  const handleShareClick = (achievement: Achievement, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedAchievement(achievement);
    setShareModalOpen(true);
  };

  if (achievements.length === 0) return null;

  return (
    <>
    <ErrorBoundary label="Achievements">
    <GlassCard glowColor="rgba(245,158,11,0.1)" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <EmojiEventsIcon sx={{ color: '#F59E0B' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {isOwnProfile ? 'Your Achievements' : `${profileName}'s Achievements`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {achievements.length} completed goal{achievements.length !== 1 ? 's' : ''} unlocked
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {achievements.map((a: any) => {
          const domainColor = DOMAIN_COLORS[a.domain as string] || '#F59E0B';
          return (
            <Tooltip key={a.id} title={a.description || a.title} arrow>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.5, py: 1, borderRadius: '12px',
                bgcolor: `${domainColor}12`,
                border: `1px solid ${domainColor}30`,
                maxWidth: 220,
                position: 'relative',
                '&:hover .share-btn': { opacity: 1 },
              }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '8px',
                  bgcolor: `${domainColor}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <EmojiEventsIcon sx={{ color: domainColor, fontSize: 18 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{
                    fontWeight: 700, fontSize: '0.78rem', color: domainColor,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.title}
                  </Typography>
                  {a.domain && (
                    <Typography sx={{ fontSize: '0.63rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {a.domain}
                    </Typography>
                  )}
                </Box>
                {isOwnProfile && (
                  <IconButton
                    className="share-btn"
                    size="small"
                    onClick={(e) => handleShareClick(a, e)}
                    sx={{
                      opacity: 0,
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 28,
                      height: 28,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                    }}
                  >
                    <ShareIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </GlassCard>
    </ErrorBoundary>

    <AchievementShareModal
      achievement={selectedAchievement || { id: '', title: '' }}
      open={shareModalOpen}
      onClose={() => {
        setShareModalOpen(false);
        setSelectedAchievement(null);
      }}
    />
    </>
  );
};

export default AchievementsSection;
