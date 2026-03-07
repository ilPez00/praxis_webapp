import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import { Box, Typography, Button, Chip, Stack, Tooltip } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ShareIcon from '@mui/icons-material/Share';
import GlassCard from '../../../components/common/GlassCard';

interface Props {
  userId: string;
  currentStreak: number;
  lastActivityDate?: string;
  praxisPoints: number;
  onCheckIn: (newStreak: number, newPoints: number) => void;
}

function getStreakTier(streak: number): { label: string; color: string } {
  if (streak >= 30) return { label: 'Elite', color: '#EF4444' };
  if (streak >= 14) return { label: 'Veteran', color: '#8B5CF6' };
  if (streak >= 7)  return { label: 'Disciplined', color: '#3B82F6' };
  if (streak >= 3)  return { label: 'Consistent', color: '#10B981' };
  return { label: 'Newcomer', color: '#6B7280' };
}

function isStreakAtRisk(lastActivityDate?: string): boolean {
  if (!lastActivityDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(lastActivityDate);
  last.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);
  // At risk if last activity was yesterday AND it's past 20:00
  return diffDays === 1 && new Date().getHours() >= 20;
}

const CheckInWidget: React.FC<Props> = ({
  userId,
  currentStreak,
  lastActivityDate,
  praxisPoints,
  onCheckIn,
}) => {
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check if already checked in today
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        const res = await axios.get(`${API_URL}/checkins/today`, {
          params: { userId },
          headers,
        });
        setCheckedIn(res.data.checkedIn);
      } catch {
        // silently ignore — UI degrades gracefully
      } finally {
        setCheckingStatus(false);
      }
    })();
  }, [userId]);

  const handleCheckIn = async () => {
    if (loading || checkedIn) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await axios.post(`${API_URL}/checkins`, { userId }, { headers });
      const { alreadyCheckedIn, streak, totalPoints, shieldConsumed } = res.data;
      if (!alreadyCheckedIn) {
        setCheckedIn(true);
        onCheckIn(streak, totalPoints);

        // Milestone celebration toasts
        const MILESTONES: Record<number, string> = {
          7:   'One week straight! You\'re building real discipline. 🏆',
          30:  'One month! You\'re in the top 5% of all users. 🔥',
          100: 'ONE HUNDRED DAYS. Legendary. Praxis is part of you now. ⚡',
          365: 'One full year. You are unstoppable. 🌟',
        };
        if (MILESTONES[streak]) {
          setTimeout(() => toast.success(MILESTONES[streak], { duration: 6000, icon: '🎉' }), 600);
        }

        if (shieldConsumed) {
          toast.success(`Streak shield absorbed your missed day! Streak: ${streak}d`, { icon: '🛡️' });
        } else {
          toast.success(`+10 points! Streak: ${streak} days 🔥`);
        }
      } else {
        setCheckedIn(true);
        toast('Already checked in today!', { icon: '✅' });
      }
    } catch {
      toast.error('Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tier = getStreakTier(currentStreak);
  const atRisk = isStreakAtRisk(lastActivityDate);

  return (
    <GlassCard sx={{
      p: 3,
      borderRadius: '20px',
      background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(245,158,11,0.06) 100%)',
      border: '1px solid rgba(249,115,22,0.2)',
      mb: 3,
    }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2}>

        {/* Left: streak + tier + points */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 32 }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1, color: '#F97316' }}>
                {currentStreak}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                day streak
              </Typography>
            </Box>
          </Box>

          <Chip
            label={tier.label}
            size="small"
            sx={{
              bgcolor: `${tier.color}18`,
              color: tier.color,
              border: `1px solid ${tier.color}44`,
              fontWeight: 700,
              fontSize: '0.7rem',
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 16 }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {praxisPoints.toLocaleString()} pts
            </Typography>
          </Box>
        </Stack>

        {/* Right: check-in button + risk warning */}
        <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={0.5}>
          {atRisk && !checkedIn && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningAmberIcon sx={{ color: '#F59E0B', fontSize: 16 }} />
              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700 }}>
                Streak at risk! Check in before midnight
              </Typography>
            </Box>
          )}

          {checkingStatus ? null : checkedIn ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="You've checked in today">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<CheckCircleIcon />}
                  disabled
                  sx={{
                    borderRadius: '10px',
                    borderColor: '#10B981',
                    color: '#10B981',
                    fontWeight: 700,
                    '&.Mui-disabled': { borderColor: '#10B98166', color: '#10B981aa' },
                  }}
                >
                  Checked In ✓
                </Button>
              </Tooltip>
              {currentStreak >= 3 && (
                <Tooltip title="Share your streak">
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ShareIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={() => {
                      const text = `I'm on a 🔥 ${currentStreak}-day streak on Praxis! Building goals every day — join me → https://praxis-app.vercel.app`;
                      if (navigator.share) {
                        navigator.share({ title: 'My Praxis Streak', text }).catch(() => {});
                      } else {
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                      }
                    }}
                    sx={{ fontSize: '0.72rem', color: '#F97316', fontWeight: 700, borderRadius: '10px' }}
                  >
                    Share
                  </Button>
                </Tooltip>
              )}
            </Stack>
          ) : (
            <Button
              variant="contained"
              size="small"
              onClick={handleCheckIn}
              disabled={loading}
              sx={{
                borderRadius: '10px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #F97316 0%, #F59E0B 100%)',
                color: '#0A0B14',
                '&:hover': { background: 'linear-gradient(135deg, #FB923C 0%, #FBBF24 100%)' },
              }}
            >
              {loading ? 'Checking in…' : 'Check In 🔥'}
            </Button>
          )}
        </Stack>

      </Stack>
    </GlassCard>
  );
};

export default CheckInWidget;
