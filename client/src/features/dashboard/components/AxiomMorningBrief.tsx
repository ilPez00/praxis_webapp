import React, { useState, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import GlassCard from '../../../components/common/GlassCard';
import {
  Box,
  Typography,
  Grid,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
  Button,
  useTheme,
  useMediaQuery,
  Divider,
  IconButton,
  Collapse,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import EmojiLightbulbIcon from '@mui/icons-material/EmojiObjects';
import HistoryIcon from '@mui/icons-material/History';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

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
}

interface GoalStrategyItem {
  goal: string;
  currentProgress: string;
  bottleneck: string;
  nextMilestone: string;
  tacticalAdvice: string;
  weeklyTarget: string;
}

interface NetworkLeverage {
  outreach: string;
  askFor: string;
  offer: string;
  communityAction: string;
}

interface DailyProtocol {
  message: string;
  match: { id: string; name: string; reason: string };
  event: { id: string; title: string; reason: string };
  place: { id: string; name: string; reason: string };
  challenge: { type: 'bet' | 'duel'; target: string; terms: string };
  resources: Array<{ goal: string; suggestion: string; details: string }>;
  routine: Array<{ time: string; task: string; alignment: string; category?: string }>;
  goalStrategy?: GoalStrategyItem[];
  networkLeverage?: NetworkLeverage;
  source?: 'llm' | 'algorithm';
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
  deep_work:  { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)', text: '#A78BFA', emoji: '🧠' },
  admin:      { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.25)', text: '#9CA3AF', emoji: '📋' },
  rest:       { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', text: '#60A5FA', emoji: '😴' },
  exercise:   { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#F87171', emoji: '💪' },
  social:     { bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.25)', text: '#F472B6', emoji: '👥' },
  learning:   { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', text: '#34D399', emoji: '📚' },
  planning:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#FBBF24', emoji: '🎯' },
  reflection: { bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)', text: '#C084FC', emoji: '🪷' },
};

interface BriefRecord {
  date: string;
  brief: DailyProtocol;
  generated_at: string;
}

const AxiomMorningBrief: React.FC<MorningBriefProps> = ({
  userName, streak, points, avgProgress, hasGoals, userId, onCheckIn,
  initialBriefs, initialCheckedIn,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [briefs, setBriefs] = useState<BriefRecord[]>(initialBriefs ?? []);
  const [briefIndex, setBriefIndex] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(!initialBriefs);
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn ?? false);
  const [checkinLoading, setCheckinLoading] = useState(false);

  useEffect(() => {
    // If pre-fetched data was provided, skip the redundant fetch.
    if (initialBriefs !== undefined) return;
    if (!userId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

        const [briefsRes, checkinRes] = await Promise.all([
          supabase
            .from('axiom_daily_briefs')
            .select('date, brief, generated_at')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(14),
          axios.get(`${API_URL}/checkins/today`, { params: { userId }, headers }),
        ]);

        let briefData = briefsRes.data as BriefRecord[];

        // No brief yet today — generate one on-demand
        if (!briefData || briefData.length === 0) {
          try {
            const genRes = await axios.post(`${API_URL}/ai-coaching/generate-axiom-brief`, {}, { headers });
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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await axios.post(`${API_URL}/checkins`, { userId }, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const { alreadyCheckedIn, streak: newStreak, totalPoints } = res.data;
      setCheckedIn(true);
      if (!alreadyCheckedIn) {
        onCheckIn(newStreak, totalPoints);
        toast.success(`Check-in successful! Streak: ${newStreak} days 🔥`, { icon: '⚡' });
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
        <Typography variant="h6" fontWeight={700}>Axiom is building your daily protocol...</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Scanning goals, matches & events — takes ~10s</Typography>
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
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalFireDepartmentIcon sx={{ color: streak > 0 ? '#F97316' : 'text.disabled', fontSize: 22 }} />
              <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: streak > 0 ? '#F97316' : 'text.disabled' }}>{streak}d</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ElectricBoltIcon sx={{ color: '#A78BFA', fontSize: 18 }} />
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#A78BFA' }}>{points.toLocaleString()} PP</Typography>
            </Box>
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

          {/* Axiom Message Area */}
          <Box sx={{ display: 'flex', gap: 3, mb: 4, alignItems: 'flex-start', flexDirection: { xs: 'column', sm: 'row' } }}>
            <Avatar sx={{
              width: 64, height: 64,
              background: 'linear-gradient(135deg, #78350F, #92400E)',
              border: '2px solid rgba(245,158,11,0.4)',
              fontSize: '1.75rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              🥋
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#F59E0B', letterSpacing: '0.02em' }}>
                  AXIOM PROTOCOL
                </Typography>
                <Chip
                  icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
                  label={isToday ? 'Daily Brief' : formatDate(currentDate)}
                  size="small"
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
                />
                <Chip
                  label={data?.source === 'llm' ? '🧠 AI' : '⚙️ Auto'}
                  size="small"
                  sx={{
                    height: 18, fontSize: '0.55rem', fontWeight: 700,
                    bgcolor: data?.source === 'llm' ? 'rgba(167,139,250,0.15)' : 'rgba(245,158,11,0.1)',
                    color: data?.source === 'llm' ? '#A78BFA' : '#F59E0B',
                    border: `1px solid ${data?.source === 'llm' ? 'rgba(167,139,250,0.25)' : 'rgba(245,158,11,0.2)'}`,
                  }}
                />
              </Box>
              <Typography variant="h6" sx={{ color: 'text.primary', lineHeight: 1.5, fontWeight: 500, fontSize: { xs: '1rem', sm: '1.1rem' }, letterSpacing: '-0.01em' }}>
                {data?.message || `Focus on showing up today, ${userName}. Discipline is the only shortcut.`}
              </Typography>

              <Box sx={{ mt: 2.5 }}>
                <Chip
                  icon={<EmojiLightbulbIcon sx={{ fontSize: '16px !important', color: '#FCD34D !important' }} />}
                  label="Tip: High-intensity blocks work better than long shallow sessions."
                  variant="outlined"
                  onClick={() => navigate('/coaching')}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    height: 32,
                    px: 1,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }
                  }}
                />
              </Box>
            </Box>
          </Box>

          <Divider sx={{ mb: 4, opacity: 0.1 }} />

          {/* Quick Targets Grid */}
          <Grid container spacing={2}>
            {[
              { label: 'USER MATCH', title: data?.match?.name, reason: data?.match?.reason, to: `/profile/${data?.match?.id}`, color: '#F59E0B', icon: '👤' },
              { label: 'FEATURED EVENT', title: data?.event?.title, reason: data?.event?.reason, to: `/discover?tab=events`, color: '#EC4899', icon: '📅' },
              { label: 'VISIT PLACE', title: data?.place?.name, reason: data?.place?.reason, to: `/discover?tab=places`, color: '#6366F1', icon: '📍' },
            ].map((item, idx) => (
              <Grid size={{ xs: 12, sm: 4 }} key={idx}>
                <Box
                  onClick={() => item.title && navigate(item.to)}
                  sx={{
                    p: 2.5, borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: item.title ? 'pointer' : 'default', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    height: '100%',
                    display: 'flex', flexDirection: 'column',
                    '&:hover': item.title ? {
                      bgcolor: 'rgba(255,255,255,0.04)',
                      transform: 'translateY(-4px)',
                      borderColor: `${item.color}55`,
                      boxShadow: `0 8px 24px ${item.color}15`
                    } : {}
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="overline" sx={{ color: item.color, fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.1em' }}>
                      {item.label}
                    </Typography>
                    <Box sx={{ fontSize: '1rem' }}>{item.icon}</Box>
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5, lineHeight: 1.2, opacity: item.title ? 1 : 0.4 }}>
                    {item.title || 'None available'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, mt: 'auto', opacity: item.title ? 1 : 0.4 }}>
                    {item.reason || 'Check back tomorrow'}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Routine — full hourly schedule */}
          {data?.routine && data.routine.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.1em', px: 0.5 }}>
                HOURLY SCHEDULE ({data.routine.length} blocks)
              </Typography>
              <Box sx={{
                display: 'flex', gap: 1.5, mt: 1.5, overflowX: 'auto', pb: 2,
                '&::-webkit-scrollbar': { height: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(139,92,246,0.3)', borderRadius: 2 },
              }}>
                {data.routine.map((item, idx) => {
                  const cat = CATEGORY_COLORS[item.category || 'admin'] || CATEGORY_COLORS.admin;
                  const isNow = (() => {
                    const h = new Date().getHours();
                    const slotH = parseInt(item.time?.slice(0, 2) || '0', 10);
                    return h === slotH;
                  })();
                  return (
                    <Box
                      key={idx}
                      sx={{
                        minWidth: 200, maxWidth: 220, flexShrink: 0,
                        p: 1.5, borderRadius: '14px',
                        bgcolor: isNow ? `${cat.bg.replace('0.08', '0.18')}` : cat.bg,
                        border: `1px solid ${isNow ? cat.text : cat.border}`,
                        transition: 'all 0.2s',
                        position: 'relative',
                        ...(isNow && {
                          boxShadow: `0 0 12px ${cat.text}30`,
                          '&::before': {
                            content: '"NOW"',
                            position: 'absolute', top: -8, right: 12,
                            fontSize: '0.5rem', fontWeight: 900, letterSpacing: '0.1em',
                            color: '#0A0B14', bgcolor: cat.text,
                            px: 0.8, py: 0.2, borderRadius: '6px',
                          },
                        }),
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: '0.7rem', color: cat.text }}>
                          {item.time}
                        </Typography>
                        <Chip
                          label={(item.category || 'task').replace('_', ' ')}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.55rem', fontWeight: 700,
                            bgcolor: `${cat.text}15`, color: cat.text,
                            border: `1px solid ${cat.text}30`,
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.task}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block', mt: 0.5 }}>
                        {item.alignment}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Challenge Hook */}
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
                onClick={() => navigate(`/profile/${data.match?.id}`)}
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

          {/* Goal Strategy */}
          {Array.isArray(data?.goalStrategy) && data.goalStrategy.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.1em', px: 0.5 }}>
                GOAL STRATEGY
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                {data.goalStrategy.map((gs, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 2, borderRadius: '16px',
                      bgcolor: 'rgba(139,92,246,0.05)',
                      border: '1px solid rgba(139,92,246,0.15)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }}>
                        🎯 {gs.goal}
                      </Typography>
                      <Chip
                        label={gs.currentProgress}
                        size="small"
                        sx={{ height: 20, fontSize: '0.6rem', fontWeight: 800, bgcolor: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                      <Chip label={`⚡ ${gs.nextMilestone}`} size="small"
                        sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.1)', color: '#FBBF24' }} />
                      <Chip label={`🎯 ${gs.weeklyTarget}`} size="small"
                        sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: 'rgba(16,185,129,0.1)', color: '#34D399' }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#F87171', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      Bottleneck: {gs.bottleneck}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                      {gs.tacticalAdvice}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Network Leverage */}
          {data?.networkLeverage && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.1em', px: 0.5 }}>
                NETWORK LEVERAGE
              </Typography>
              <Box sx={{
                mt: 1.5, p: 2.5, borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(99,102,241,0.06))',
                border: '1px solid rgba(236,72,153,0.15)',
              }}>
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#F472B6', fontWeight: 900, display: 'block', mb: 0.25, fontSize: '0.6rem', letterSpacing: '0.05em' }}>
                      👤 REACH OUT
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {data.networkLeverage.outreach}
                    </Typography>
                  </Box>
                  <Divider sx={{ opacity: 0.08 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#60A5FA', fontWeight: 900, display: 'block', mb: 0.25, fontSize: '0.55rem' }}>
                        🙋 ASK FOR
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                        {data.networkLeverage.askFor}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#34D399', fontWeight: 900, display: 'block', mb: 0.25, fontSize: '0.55rem' }}>
                        🎁 OFFER
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                        {data.networkLeverage.offer}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography variant="caption" sx={{ color: '#FBBF24', fontWeight: 900, display: 'block', mb: 0.25, fontSize: '0.55rem' }}>
                        📣 COMMUNITY ACTION
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                        {data.networkLeverage.communityAction}
                      </Typography>
                    </Grid>
                  </Grid>
                </Stack>
              </Box>
            </Box>
          )}

        </Box>
      </GlassCard>
    </Box>
  );
};

export default AxiomMorningBrief;
