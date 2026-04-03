import React from 'react';
import {
  Box,
  Chip,
  Grid,
  Typography,
} from '@mui/material';
import { LinearProgress } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GlassCard from '../../../components/common/GlassCard';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import LevelBadge from '../../../components/common/LevelBadge';
import { GamificationProfile } from '../../../hooks/useGamification';

interface GamificationSectionProps {
  profile: GamificationProfile;
}

const GamificationSection: React.FC<GamificationSectionProps> = ({ profile }) => {
  return (
    <ErrorBoundary label="Gamification">
    <GlassCard glowColor="rgba(167,139,250,0.1)" sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <EmojiEventsIcon sx={{ color: '#A78BFA' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Progress & Achievements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Level {profile.level} · {profile.league} League
          </Typography>
        </Box>
        <LevelBadge level={profile.level} size="large" animated={true} />
      </Box>

      {/* XP Progress Bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            XP Progress
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#A78BFA' }}>
            {profile.xp_progress?.toLocaleString()} / {profile.xp_needed?.toLocaleString()} XP
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={profile.xp_percent || 0}
          sx={{
            height: 10,
            borderRadius: 5,
            bgcolor: 'rgba(255,255,255,0.1)',
            '& .MuiLinearProgress-bar': {
              bgcolor: '#A78BFA',
              borderRadius: 5,
            },
          }}
        />
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={2}>
        <Grid size={6}>
          <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(245,158,11,0.08)', borderRadius: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#F59E0B' }}>
              {profile.praxis_points?.toLocaleString() || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Praxis Points
            </Typography>
          </Box>
        </Grid>
        <Grid size={6}>
          <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(167,139,250,0.08)', borderRadius: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#A78BFA' }}>
              {profile.total_xp?.toLocaleString() || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Total XP
            </Typography>
          </Box>
        </Grid>
        <Grid size={6}>
          <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(6,182,212,0.08)', borderRadius: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#06B6D4' }}>
              {profile.reputation_score || 50}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Reputation
            </Typography>
          </Box>
        </Grid>
        <Grid size={6}>
          <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(34,197,94,0.08)', borderRadius: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#22C55E' }}>
              {profile.current_streak || 0}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Day Streak
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Equipped Title */}
      {profile.equipped_title && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Chip
            label={`"${profile.equipped_title}"`}
            sx={{
              bgcolor: 'rgba(167,139,250,0.15)',
              border: '1px solid rgba(167,139,250,0.4)',
              color: '#A78BFA',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}
          />
        </Box>
      )}
    </GlassCard>
    </ErrorBoundary>
  );
};

export default GamificationSection;
