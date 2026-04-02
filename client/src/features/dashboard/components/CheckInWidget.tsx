import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import api from '../../../lib/api';
import { Box, Typography, Button, Chip, Stack, Tooltip, TextField } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ShareIcon from '@mui/icons-material/Share';
import ShieldIcon from '@mui/icons-material/Shield';
import GlassCard from '../../../components/common/GlassCard';
import { useCelebrations, isStreakMilestone, getMilestoneConfig } from '../../../hooks/useCelebrations';

interface Props {
  userId: string;
  currentStreak: number;
  lastActivityDate?: string;
  praxisPoints: number;
  streakShield?: boolean;
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
  streakShield = false,
  onCheckIn,
}) => {
  const { celebrateMilestone, celebrateMysteryReward } = useCelebrations();
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [recentDays, setRecentDays] = useState<boolean[]>([]);  // last 7 days, true = checked in
  const [mood, setMood] = useState<string | null>(null);
  const [winText, setWinText] = useState('');
  const [showWinInput, setShowWinInput] = useState(false);

  // Check if already checked in today
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await api.get('/checkins/today', {
          params: { userId },
        });
        setCheckedIn(res.data.checkedIn);

        const { data: recentCheckins } = await supabase
          .from('checkins')
          .select('checked_in_at')
          .eq('user_id', userId)
          .gte('checked_in_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .order('checked_in_at', { ascending: false });

        const checkinDates = new Set((recentCheckins ?? []).map((c: any) => c.checked_in_at.slice(0, 10)));
        const last7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return checkinDates.has(d.toISOString().slice(0, 10));
        });
        setRecentDays(last7);
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
      const res = await api.post('/checkins', { userId, mood, winOfTheDay: winText });
      const { alreadyCheckedIn, streak, totalPoints, shieldConsumed, mysteryReward, seasonalEventCompleted } = res.data;
      if (!alreadyCheckedIn) {
        setCheckedIn(true);
        onCheckIn(streak, totalPoints);

        if (seasonalEventCompleted) {
          celebrateMilestone({
            milestone: 100,
            type: 'achievement',
            title: `${seasonalEventCompleted.eventName} Complete!`,
            description: 'You completed the seasonal challenge! Claim your reward.',
            reward: { pp: 100 },
          });
        } else if (mysteryReward) {
          celebrateMysteryReward(mysteryReward);
          toast.success(
            `${mysteryReward.emoji} MYSTERY! ${mysteryReward.tier} — +${mysteryReward.amount} PP!`,
            { duration: 5000, style: { background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff' } }
          );
        } else if (isStreakMilestone(streak)) {
          const config = getMilestoneConfig(streak);
          celebrateMilestone({
            milestone: streak,
            type: 'streak',
            title: config.title,
            description: config.description,
            reward: { pp: 50 },
          });
        } else if (shieldConsumed) {
          toast.success(`Streak shield absorbed your missed day! Streak: ${streak}d`, { icon: '🛡️' });
        } else {
          toast.success(`+${res.data.pointsAwarded} points! Streak: ${streak} days 🔥`);
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
  const isMilestone = [7, 14, 30, 60, 100].includes(currentStreak);

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

          {streakShield && (
            <Tooltip title="Streak Shield Active — miss a day without losing your streak!">
              <Chip
                icon={<ShieldIcon sx={{ fontSize: '14px !important' }} />}
                label="Shielded"
                size="small"
                sx={{
                  bgcolor: 'rgba(34,197,94,0.15)',
                  color: '#22C55E',
                  border: '1px solid rgba(34,197,94,0.3)',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  '& .MuiChip-icon': { color: '#22C55E' },
                }}
              />
            </Tooltip>
          )}

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
                <span>
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
                </span>
              </Tooltip>
              {currentStreak >= 3 && (
                <Tooltip title="Share your streak & get +10 PP">
                  <Button
                    size={isMilestone ? 'medium' : 'small'}
                    variant="contained"
                    startIcon={<ShareIcon sx={{ fontSize: isMilestone ? '18px !important' : '14px !important' }} />}
                    onClick={async () => {
                      const text = isMilestone
                        ? `🚨 Milestone! I'm on a ${currentStreak}-day streak on Praxis. ${currentStreak} days of discipline — join me → https://praxis-app.vercel.app`
                        : `I'm on a 🔥 ${currentStreak}-day streak on Praxis! Building goals every day — join me → https://praxis-app.vercel.app`;
                      
                      if (navigator.share) {
                        navigator.share({ title: isMilestone ? `My ${currentStreak}-Day Milestone!` : 'My Praxis Streak', text }).catch(() => {});
                      } else {
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                      }
                      
                      try {
                        await api.post('/gamification/social/track', {
                          actionType: 'streak_share',
                          amount: 1,
                        });
                        toast.success(`Shared! +10 PP ${isMilestone ? '🎉' : ''}`, { duration: 3000 });
                      } catch (err) {}
                    }}
                    sx={{
                      fontSize: isMilestone ? '0.9rem' : '0.72rem',
                      py: isMilestone ? 1.5 : 0.75,
                      px: isMilestone ? 3 : undefined,
                      bgcolor: isMilestone ? 'linear-gradient(135deg, #F97316, #FBBF24)' : '#F97316',
                      background: isMilestone ? 'linear-gradient(135deg, #F97316, #FBBF24)' : '#F97316',
                      color: '#fff',
                      fontWeight: 800,
                      borderRadius: isMilestone ? '14px' : '10px',
                      boxShadow: isMilestone 
                        ? '0 8px 24px rgba(249,115,22,0.5), 0 0 20px rgba(249,115,22,0.3)' 
                        : '0 4px 12px rgba(249,115,22,0.4)',
                      animation: isMilestone ? 'pulse-glow 2s ease-in-out infinite' : 'none',
                      '@keyframes pulse-glow': {
                        '0%, 100%': { boxShadow: '0 8px 24px rgba(249,115,22,0.5), 0 0 20px rgba(249,115,22,0.3)' },
                        '50%': { boxShadow: '0 8px 32px rgba(249,115,22,0.7), 0 0 40px rgba(249,115,22,0.5)' },
                      },
                      '&:hover': { 
                        bgcolor: 'linear-gradient(135deg, #FB923C, #FBBF24)',
                        background: 'linear-gradient(135deg, #FB923C, #FBBF24)',
                        transform: 'scale(1.02)',
                      },
                    }}
                  >
                    {isMilestone ? 'Share Milestone +10 PP' : 'Share +10 PP'}
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

      {/* 7-day mini calendar */}
      <Box sx={{ display: 'flex', gap: 0.75, mt: 2 }}>
        {['M','T','W','T','F','S','S'].map((day, i) => (
          <Box key={i} sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', display: 'block', mb: 0.5 }}>
              {day}
            </Typography>
            <Box sx={{
              width: 24, height: 24, borderRadius: '50%', mx: 'auto',
              bgcolor: recentDays[i] ? '#F97316' : 'rgba(255,255,255,0.06)',
              border: i === 6 ? '2px solid rgba(249,115,22,0.4)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {recentDays[i] && <CheckCircleIcon sx={{ fontSize: 12, color: '#fff' }} />}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Mood selector — only show before check-in */}
      {!checkedIn && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>How are you feeling?</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
            {['😤','😐','🙂','😊','🔥'].map(emoji => (
              <Box
                key={emoji}
                onClick={() => setMood(emoji)}
                sx={{
                  fontSize: '1.4rem', cursor: 'pointer', p: 0.5, borderRadius: 2,
                  border: mood === emoji ? '2px solid #F97316' : '2px solid transparent',
                  bgcolor: mood === emoji ? 'rgba(249,115,22,0.1)' : 'transparent',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: 'rgba(249,115,22,0.08)' },
                }}
              >
                {emoji}
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Win of the day */}
      {!checkedIn && (
        <Box sx={{ mt: 1.5 }}>
          {showWinInput ? (
            <TextField
              size="small" fullWidth multiline rows={2}
              placeholder="What's your win today? (optional)"
              value={winText}
              onChange={e => setWinText(e.target.value)}
              inputProps={{ maxLength: 140 }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.82rem' } }}
            />
          ) : (
            <Button size="small" variant="text"
              onClick={() => setShowWinInput(true)}
              sx={{ fontSize: '0.72rem', color: 'text.secondary', p: 0 }}
            >
              + Add a win for today
            </Button>
          )}
        </Box>
      )}
    </GlassCard>
  );
};

export default CheckInWidget;
