/**
 * AchievementCollectionPage
 * Full gallery of all achievements — locked (silhouettes) + unlocked, grouped by category
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GlassCard from '../../components/common/GlassCard';

interface Achievement {
  id: string;
  achievement_key: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  xp_reward: number;
  pp_reward: number;
  title_unlock: string | null;
  requirement_target: number;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  is_secret: boolean;
  hint: string | null;
}

interface Category {
  name: string;
  achievements: Achievement[];
  unlocked: number;
  total: number;
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#94A3B8',
  silver: '#E5E7EB',
  gold: '#FBBF24',
  platinum: '#A78BFA',
  diamond: '#06B6D4',
};

const CATEGORY_ICONS: Record<string, string> = {
  Streaks: '🔥',
  Social: '💬',
  Goals: '🎯',
  Community: '👥',
  Mastery: '⚡',
  General: '🏆',
  Secret: '❓',
};

const AchievementCollectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalUnlocked, setTotalUnlocked] = useState(0);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/gamification/achievements/collection');
        setCategories(data.categories || []);
        setTotalUnlocked(data.totalUnlocked || 0);
        setTotalAchievements(data.totalAchievements || 0);
      } catch {
        // degrade gracefully
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const overallPercent = totalAchievements > 0
    ? Math.round((totalUnlocked / totalAchievements) * 100)
    : 0;

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <EmojiEventsIcon sx={{ color: '#F59E0B', fontSize: 28 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Achievement Collection
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {totalUnlocked} / {totalAchievements} unlocked ({overallPercent}%)
          </Typography>
        </Box>
      </Box>

      {/* Overall progress */}
      <Box sx={{ mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={overallPercent}
          sx={{
            height: 8, borderRadius: 4,
            bgcolor: 'rgba(255,255,255,0.1)',
            '& .MuiLinearProgress-bar': { bgcolor: '#F59E0B', borderRadius: 4 },
          }}
        />
      </Box>

      {loading ? (
        <Typography color="text.secondary">Loading achievements...</Typography>
      ) : categories.length === 0 ? (
        <Typography color="text.secondary">No achievements found. Start your journey!</Typography>
      ) : (
        <Stack spacing={3}>
          {categories.map(cat => (
            <GlassCard key={cat.name} sx={{ p: 2.5 }}>
              {/* Category header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography sx={{ fontSize: '1.3rem' }}>
                  {CATEGORY_ICONS[cat.name] || '🏆'}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
                  {cat.name}
                </Typography>
                <Chip
                  label={`${cat.unlocked}/${cat.total}`}
                  size="small"
                  sx={{
                    bgcolor: cat.unlocked === cat.total ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
                    color: cat.unlocked === cat.total ? '#22C55E' : 'text.secondary',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                  }}
                />
              </Box>

              {/* Achievement grid */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {cat.achievements.map(a => (
                  <AchievementCard key={a.id} achievement={a} />
                ))}
              </Box>
            </GlassCard>
          ))}
        </Stack>
      )}
    </Box>
  );
};

// =============================================================================
// Individual Achievement Card
// =============================================================================

const AchievementCard: React.FC<{ achievement: Achievement }> = ({ achievement: a }) => {
  const tierColor = TIER_COLORS[a.tier] || '#F59E0B';
  const progressPercent = a.requirement_target > 0
    ? Math.min(100, Math.round((a.progress / a.requirement_target) * 100))
    : (a.completed ? 100 : 0);

  return (
    <Tooltip
      arrow
      title={
        <Box sx={{ textAlign: 'center', maxWidth: 200 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{a.title}</Typography>
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>{a.description}</Typography>
          {a.requirement_target > 0 && (
            <Typography variant="caption" sx={{ display: 'block', color: '#F59E0B' }}>
              Progress: {a.progress}/{a.requirement_target}
            </Typography>
          )}
          {a.completed && (
            <Typography variant="caption" sx={{ display: 'block', color: '#22C55E' }}>
              +{a.xp_reward} XP | +{a.pp_reward} PP
            </Typography>
          )}
          {a.title_unlock && (
            <Typography variant="caption" sx={{ display: 'block', color: '#A78BFA' }}>
              Unlocks title: "{a.title_unlock}"
            </Typography>
          )}
        </Box>
      }
    >
      <Box sx={{
        width: 72, textAlign: 'center',
        opacity: a.completed ? 1 : 0.5,
        filter: a.completed ? 'none' : 'grayscale(0.6)',
        transition: 'all 0.2s',
        '&:hover': { opacity: 1, filter: 'none', transform: 'scale(1.05)' },
      }}>
        {/* Icon */}
        <Box sx={{
          width: 48, height: 48, mx: 'auto', mb: 0.5,
          borderRadius: '12px',
          bgcolor: a.completed ? `${tierColor}20` : 'rgba(255,255,255,0.06)',
          border: `2px solid ${a.completed ? tierColor : 'rgba(255,255,255,0.1)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          fontSize: '1.4rem',
        }}>
          {a.completed ? a.icon : (
            a.is_secret ? '❓' : <LockIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }} />
          )}
          {a.completed && (
            <CheckCircleIcon sx={{
              position: 'absolute', bottom: -4, right: -4,
              fontSize: 16, color: '#22C55E',
              bgcolor: '#0A0B14', borderRadius: '50%',
            }} />
          )}
        </Box>

        {/* Title */}
        <Typography sx={{
          fontSize: '0.6rem', fontWeight: 600, lineHeight: 1.2,
          color: a.completed ? 'text.primary' : 'text.disabled',
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {a.title}
        </Typography>

        {/* Mini progress bar (only for in-progress) */}
        {!a.completed && a.progress > 0 && (
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              mt: 0.5, height: 3, borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': { bgcolor: tierColor, borderRadius: 2 },
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default AchievementCollectionPage;
