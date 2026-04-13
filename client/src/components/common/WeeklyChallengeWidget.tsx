/**
 * WeeklyChallengeWidget Component
 * 7-tier weekly progression track — "battle pass lite"
 */

import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import hotToast from 'react-hot-toast';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Tooltip,
  LinearProgress,
  keyframes,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface Tier {
  tier: number;
  xp_threshold: number;
  pp_reward: number;
  xp_reward: number;
  label: string;
  badge: string | null;
  unlocked: boolean;
  claimed: boolean;
}

interface WeeklyData {
  weekKey: string;
  weeklyXP: number;
  currentTier: number;
  daysLeft: number;
  tiers: Tier[];
  nextTier: { tier: number; xpNeeded: number; xpThreshold: number } | null;
}

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 4px rgba(245,158,11,0.4); }
  50% { box-shadow: 0 0 12px rgba(245,158,11,0.8); }
`;

const TIER_COLORS = [
  '#6B7280', // 1: gray
  '#10B981', // 2: green
  '#3B82F6', // 3: blue
  '#8B5CF6', // 4: purple
  '#F59E0B', // 5: amber
  '#F97316', // 6: orange
  '#EF4444', // 7: red
];

const WeeklyChallengeWidget: React.FC = () => {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);

  const fetchProgress = async () => {
    try {
      const { data: resp } = await api.get('/weekly-challenge');
      setData(resp);
    } catch {
      // silent — widget degrades gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProgress(); }, []);

  const handleClaim = async (tier: number) => {
    setClaiming(tier);
    try {
      const { data: resp } = await api.post(`/weekly-challenge/claim/${tier}`);
      if (resp.success) {
        hotToast.success(
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {resp.label} Unlocked!
            </Typography>
            <Typography variant="body2">
              +{resp.xp_earned} XP | +{resp.pp_earned} PP
            </Typography>
          </Box>
        );
        await fetchProgress();
      }
    } catch (err: any) {
      hotToast.error(err.response?.data?.message || 'Failed to claim');
    } finally {
      setClaiming(null);
    }
  };

  if (loading || !data) return null;

  const claimableTiers = data.tiers.filter(t => t.unlocked && !t.claimed);
  const overallPercent = data.nextTier
    ? Math.round(((data.weeklyXP) / (data.nextTier.xpThreshold)) * 100)
    : 100;

  return (
    <Card sx={{
      bgcolor: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 3,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        px: 2, py: 1.5,
        bgcolor: 'rgba(139,92,246,0.1)',
        borderBottom: '1px solid rgba(139,92,246,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthIcon sx={{ color: '#8B5CF6', fontSize: 22 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
            Weekly Track
          </Typography>
          <Chip
            label={`${data.daysLeft}d left`}
            size="small"
            sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#A78BFA', fontWeight: 700, fontSize: '0.65rem' }}
          />
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {data.weeklyXP.toLocaleString()} XP
        </Typography>
      </Box>

      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* 7-tier progress path */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, mb: 2, px: 0.5 }}>
          {data.tiers.map((tier, i) => {
            const color = TIER_COLORS[i];
            const isClaimable = tier.unlocked && !tier.claimed;
            return (
              <React.Fragment key={tier.tier}>
                {/* Connector line */}
                {i > 0 && (
                  <Box sx={{
                    flex: 1, height: 3, borderRadius: 2,
                    bgcolor: tier.unlocked ? color : 'rgba(255,255,255,0.1)',
                    transition: 'background-color 0.3s',
                  }} />
                )}
                {/* Tier node */}
                <Tooltip title={
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{tier.label}</Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {tier.xp_threshold.toLocaleString()} XP
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: '#F59E0B' }}>
                      +{tier.pp_reward} PP | +{tier.xp_reward} XP
                    </Typography>
                  </Box>
                }>
                  <Box
                    onClick={() => isClaimable && handleClaim(tier.tier)}
                    sx={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 800,
                      cursor: isClaimable ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      ...(tier.claimed ? {
                        bgcolor: color,
                        color: '#fff',
                        border: `2px solid ${color}`,
                      } : isClaimable ? {
                        bgcolor: `${color}22`,
                        color,
                        border: `2px solid ${color}`,
                        animation: `${pulseGlow} 2s ease-in-out infinite`,
                        '&:hover': { transform: 'scale(1.15)' },
                      } : {
                        bgcolor: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.3)',
                        border: '2px solid rgba(255,255,255,0.1)',
                      }),
                    }}
                  >
                    {tier.claimed ? (
                      <CheckCircleIcon sx={{ fontSize: 14, color: '#fff' }} />
                    ) : tier.unlocked ? (
                      <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <LockIcon sx={{ fontSize: 12 }} />
                    )}
                  </Box>
                </Tooltip>
              </React.Fragment>
            );
          })}
        </Box>

        {/* Progress to next tier */}
        {data.nextTier && (
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Next: Tier {data.nextTier.tier}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, color: TIER_COLORS[data.nextTier.tier - 1] }}>
                {data.nextTier.xpNeeded.toLocaleString()} XP to go
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(overallPercent, 100)}
              sx={{
                height: 6, borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: TIER_COLORS[data.currentTier] || '#8B5CF6',
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        )}

        {/* Claim all button (if multiple claimable) */}
        {claimableTiers.length > 1 && (
          <Button
            size="small"
            variant="contained"
            fullWidth
            disabled={claiming !== null}
            onClick={async () => {
              for (const t of claimableTiers) {
                await handleClaim(t.tier);
              }
            }}
            sx={{
              bgcolor: '#8B5CF6', color: '#fff', fontWeight: 700, borderRadius: 2,
              '&:hover': { bgcolor: '#7C3AED' },
            }}
          >
            Claim {claimableTiers.length} Rewards
          </Button>
        )}

        {/* All tiers completed */}
        {!data.nextTier && (
          <Typography variant="body2" textAlign="center" sx={{ color: '#EF4444', fontWeight: 700 }}>
            Weekly Legend! All tiers completed.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyChallengeWidget;
