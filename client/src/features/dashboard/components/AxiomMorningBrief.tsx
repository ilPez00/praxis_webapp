import React, { useState, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import api from '../../../lib/api';
import GlassCard from '../../../components/common/GlassCard';
import ContributionGraph from '../../../components/common/ContributionGraph';
import {
  Box,
  Typography,
  Grid,
  Stack,
  Chip,
  LinearProgress,
  Button,
  useTheme,
  useMediaQuery,
  IconButton,
  Collapse,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import ShieldIcon from '@mui/icons-material/Shield';
import HistoryIcon from '@mui/icons-material/History';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ShareButton from '../../../components/common/ShareButton';
import BetCommitDialog from '../../../components/common/BetCommitDialog';
import { useCelebrations, isStreakMilestone, getMilestoneConfig } from '../../../hooks/useCelebrations';

interface MorningBriefProps {
  userName: string;
  streak: number;
  points: number;
  avgProgress: number;
  hasGoals: boolean;
  userId: string;
  onCheckIn: (newStreak: number, newPoints: number) => void;
  /** Pre-fetched from /dashboard/summary — skips the internal Supabase query. */
  initialBriefs?: BriefRecord[];
  initialCheckedIn?: boolean;
  streakShield?: boolean;
}

interface DailyProtocol {
  match: { id: string; name: string; reason: string };
  event: { id: string; title: string; reason: string };
  place: { id: string; name: string; reason: string };
  challenge: { type: 'bet' | 'duel'; target: string; terms: string };
}

interface BriefRecord {
  date: string;
  brief: DailyProtocol;
  generated_at: string;
}

const AxiomMorningBrief: React.FC<MorningBriefProps> = ({
  userName, streak, points, avgProgress, hasGoals, userId, onCheckIn,
  initialBriefs, initialCheckedIn, streakShield = false,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { celebrateMilestone, celebrateMysteryReward } = useCelebrations();

  const [briefs, setBriefs] = useState<BriefRecord[]>(initialBriefs ?? []);
  const [briefIndex, setBriefIndex] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(!initialBriefs);
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn ?? false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [isBetDialogOpen, setIsBetDialogOpen] = useState(false);
  const [weekStats, setWeekStats] = useState({ total: 0, streak: 0 });

  useEffect(() => {
    if (!userId) return;
    const fetchWeekStats = async () => {
      try {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const { data: entries } = await supabase
          .from('notebook_entries')
          .select('occurred_at')
          .eq('user_id', userId)
          .gte('occurred_at', startOfWeek.toISOString());

        const total = entries?.length || 0;

        // Calculate streak (consecutive days with entries)
        let streakCount = 0;
        if (entries && entries.length > 0) {
          const uniqueDays = [...new Set(entries.map(e => e.occurred_at.slice(0, 10)))].sort().reverse();
          const today = new Date().toISOString().slice(0, 10);
          let expectedDate = new Date(today);

          for (const day of uniqueDays) {
            const dayDate = new Date(day + 'T00:00:00');
            const diffDays = Math.floor((expectedDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 1) {
              streakCount++;
              expectedDate = dayDate;
              expectedDate.setDate(expectedDate.getDate() - 1);
            } else {
              break;
            }
          }
        }

        setWeekStats({ total, streak: streakCount });
      } catch (error) {
        console.error('Failed to fetch week stats:', error);
      }
    };

    fetchWeekStats();
  }, [userId]);

  useEffect(() => {
    if (initialBriefs !== undefined) return;
    if (!userId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [briefsRes, checkinRes] = await Promise.all([
          supabase
            .from('axiom_daily_briefs')
            .select('date, brief, generated_at')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(14),
          api.get('/checkins/today', { params: { userId } }),
        ]);

        let briefData = briefsRes.data as BriefRecord[];

        if (!briefData || briefData.length === 0) {
          try {
            const genRes = await api.post('/ai-coaching/generate-axiom-brief', {});
            if (genRes.data) briefData = [genRes.data];
          } catch (genErr) {
            console.warn('Axiom brief generation failed:', genErr);
          }
        }

        if (briefData && briefData.length > 0) {
          setBriefs(briefData);
          setBriefIndex(0);
        }
        setCheckedIn(checkinRes.data.checkedIn);
      } catch (err) {
        console.error('Failed to fetch morning brief:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, initialBriefs]);

  const handleCheckIn = async () => {
    if (checkinLoading || checkedIn) return;
    setCheckinLoading(true);
    try {
      const res = await api.post('/checkins', { userId });
      const { alreadyCheckedIn, streak: newStreak, totalPoints, mysteryReward, seasonalEventCompleted } = res.data;
      setCheckedIn(true);
      if (!alreadyCheckedIn) {
        onCheckIn(newStreak, totalPoints);
        
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
            `${mysteryReward.emoji} MYSTERY REWARD! ${mysteryReward.tier} — +${mysteryReward.amount} PP!`,
            { duration: 5000, style: { background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff' } }
          );
        } else if (isStreakMilestone(newStreak)) {
          const config = getMilestoneConfig(newStreak);
          celebrateMilestone({
            milestone: newStreak,
            type: 'streak',
            title: config.title,
            description: config.description,
            reward: { pp: 50 },
          });
        } else {
          toast.success(`Check-in successful! Streak: ${newStreak} days 🔥`, { icon: '⚡' });
        }
      }
    } catch {
      toast.error('Check-in failed.');
    } finally {
      setCheckinLoading(false);
    }
  };

  if (loading) {
    return (
      <GlassCard sx={{ p: 4, mb: 4, textAlign: 'center', borderRadius: '24px' }}>
        <CircularProgress size={32} sx={{ mb: 2 }} />
        <Typography variant="h6" fontWeight={700}>Building your daily protocol...</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading match, event & place suggestions</Typography>
      </GlassCard>
    );
  }

  const data = briefs[briefIndex]?.brief ?? null;
  const currentDate = briefs[briefIndex]?.date;
  const isToday = briefIndex === 0;
  const hasPrev = briefIndex < briefs.length - 1;
  const hasNext = briefIndex > 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <Box sx={{ mb: 5 }}>
      {/* Greeting & Hero Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2.5, px: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em', mb: 0.5 }}>
            Hey, <Box component="span" sx={{ color: 'primary.main' }}>{userName}</Box>
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalFireDepartmentIcon sx={{ color: streak > 0 ? '#F97316' : 'text.disabled', fontSize: 22 }} />
              <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: streak > 0 ? '#F97316' : 'text.disabled' }}>{streak}d</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ElectricBoltIcon sx={{ color: '#A78BFA', fontSize: 18 }} />
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#A78BFA' }}>{points.toLocaleString()} PP</Typography>
            </Box>
            {streakShield && (
              <Chip
                icon={<ShieldIcon sx={{ fontSize: '14px !important' }} />}
                label="Shielded"
                size="small"
                sx={{
                  bgcolor: 'rgba(34,197,94,0.15)',
                  color: '#22C55E',
                  border: '1px solid rgba(34,197,94,0.3)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  height: 24,
                  '& .MuiChip-icon': { color: '#22C55E' },
                }}
              />
            )}
            <Box sx={{ width: '1px', height: 28, bgcolor: 'rgba(255,255,255,0.1)', mx: 1 }} />
            <ContributionGraph userId={userId} height={60} width={280} showTooltip={true} />
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          {briefs.length > 1 && (
            <IconButton
              size="small"
              onClick={() => setHistoryOpen(v => !v)}
              sx={{ color: historyOpen ? 'primary.main' : 'text.secondary' }}
            >
              <HistoryIcon fontSize="small" />
            </IconButton>
          )}
          {isToday && !checkedIn && (
            <Button
              variant="contained"
              size="large"
              onClick={handleCheckIn}
              disabled={checkinLoading}
              sx={{
                borderRadius: '14px',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #F97316, #F59E0B)',
                boxShadow: '0 8px 20px rgba(249,115,22,0.3)',
                px: 4,
                height: 48,
              }}
            >
              {checkinLoading ? '...' : 'Check In 🔥'}
            </Button>
          )}
        </Stack>
      </Box>

      {/* History date strip */}
      <Collapse in={historyOpen}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, px: 1, flexWrap: 'wrap' }}>
          {briefs.map((b, idx) => (
            <Chip
              key={b.date}
              label={idx === 0 ? 'Today' : formatDate(b.date)}
              size="small"
              onClick={() => { setBriefIndex(idx); setHistoryOpen(false); }}
              sx={{
                fontWeight: briefIndex === idx ? 900 : 500,
                bgcolor: briefIndex === idx ? 'primary.main' : 'rgba(255,255,255,0.05)',
                color: briefIndex === idx ? '#000' : 'text.secondary',
                border: '1px solid',
                borderColor: briefIndex === idx ? 'primary.main' : 'rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            />
          ))}
        </Box>
      </Collapse>

      {/* Main Protocol Card */}
      <GlassCard sx={{
        p: 0, overflow: 'hidden', borderRadius: '32px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(165deg, rgba(17,24,39,0.9) 0%, rgba(10,11,20,0.95) 100%)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      }}>
        {/* Progress Bar Top */}
        {hasGoals && (
          <Box sx={{ width: '100%', position: 'relative' }}>
            <LinearProgress
              variant="determinate"
              value={avgProgress}
              sx={{
                height: 8,
                bgcolor: 'rgba(255,255,255,0.03)',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #F59E0B, #8B5CF6)',
                }
              }}
            />
            <Box sx={{ position: 'absolute', top: 12, right: 20 }}>
              <Typography variant="caption" sx={{ fontWeight: 900, color: 'primary.main', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                OVERALL PROGRESS: {avgProgress}%
              </Typography>
            </Box>
          </Box>
        )}

        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          {/* Date nav (when not viewing today) */}
          {!isToday && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <IconButton size="small" onClick={() => setBriefIndex(i => i + 1)} disabled={!hasPrev} sx={{ color: 'text.secondary' }}>
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.05em' }}>
                {formatDate(currentDate)}
              </Typography>
              <IconButton size="small" onClick={() => setBriefIndex(i => i - 1)} disabled={!hasNext} sx={{ color: 'text.secondary' }}>
                <ChevronRightIcon />
              </IconButton>
              <Chip label="Back to today" size="small" onClick={() => setBriefIndex(0)}
                sx={{ ml: 1, fontSize: '0.65rem', fontWeight: 800, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer' }} />
            </Box>
          )}

          {/* Section label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#F59E0B', letterSpacing: '0.02em' }}>
              DAILY PROTOCOL
            </Typography>
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
              label={isToday ? 'Today' : formatDate(currentDate)}
              size="small"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
            />
          </Box>

          {/* Quick Targets Grid - Match, Event, Place */}
          <Grid container spacing={2}>
            {[
              { label: 'USER MATCH', title: data?.match?.name, reason: data?.match?.reason, to: `/profile/${data?.match?.id}`, color: '#F59E0B', icon: '👤', shareType: 'axiom_match' as const, shareId: data?.match?.id },
              { label: 'FEATURED EVENT', title: data?.event?.title, reason: data?.event?.reason, to: `/discover?tab=events`, color: '#EC4899', icon: '📅', shareType: 'axiom_event' as const, shareId: data?.event?.id },
              { label: 'VISIT PLACE', title: data?.place?.name, reason: data?.place?.reason, to: `/discover?tab=places`, color: '#6366F1', icon: '📍', shareType: 'axiom_place' as const, shareId: data?.place?.id },
            ].map((item, idx) => (
              <Grid size={{ xs: 12, sm: 4 }} key={idx}>
                <Box
                  sx={{
                    p: 2.5, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    height: '100%',
                    display: 'flex', flexDirection: 'column',
                    '&:hover': item.title ? {
                      bgcolor: 'rgba(255,255,255,0.04)',
                      borderColor: `${item.color}55`,
                      boxShadow: `0 8px 24px ${item.color}15`
                    } : {}
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="overline" sx={{ color: item.color, fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.1em' }}>
                      {item.label}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {item.title && (
                        <Box onClick={e => e.stopPropagation()}>
                          <ShareButton
                            sourceTable={item.shareType}
                            sourceId={item.shareId || `axiom-${idx}`}
                            title={`${item.label}: ${item.title}`}
                            content={item.reason || ''}
                            userId={userId}
                          />
                        </Box>
                      )}
                      <Box sx={{ fontSize: '1rem' }}>{item.icon}</Box>
                    </Stack>
                  </Box>
                  <Box
                    onClick={() => item.title && navigate(item.to)}
                    sx={{ cursor: item.title ? 'pointer' : 'default', flex: 1, display: 'flex', flexDirection: 'column' }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5, lineHeight: 1.2, opacity: item.title ? 1 : 0.4 }}>
                      {item.title || 'None available'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, mt: 'auto', opacity: item.title ? 1 : 0.4 }}>
                      {item.reason || 'Check back tomorrow'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Challenge Hook - Bet */}
          {data?.challenge && (
            <Box
              sx={{
                mt: 4, p: 2.5, borderRadius: '20px',
                background: 'linear-gradient(90deg, rgba(245,158,11,0.08), transparent)',
                border: '1px dashed rgba(245,158,11,0.3)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 900, display: 'block', mb: 0.5 }}>DAILY CHALLENGE</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  <Box component="span" sx={{ color: '#F59E0B', mr: 1 }}>{data.challenge.type.toUpperCase()}:</Box>
                  {data.challenge.target}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setIsBetDialogOpen(true)}
                sx={{
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  px: 3,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': { border: '1px solid', borderColor: 'primary.light', bgcolor: 'rgba(245,158,11,0.05)' }
                }}
              >
                Accept
              </Button>
            </Box>
          )}

        </Box>
      </GlassCard>

      {data?.challenge && (
        <BetCommitDialog
          open={isBetDialogOpen}
          onClose={() => setIsBetDialogOpen(false)}
          challenge={data.challenge}
        />
      )}
    </Box>
  );
};

export default AxiomMorningBrief;
