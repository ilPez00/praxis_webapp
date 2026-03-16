import React, { useState, useEffect } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import GlassCard from '../../../components/common/GlassCard';
import {
  Box,
  Typography,
  Grid,
  Stack,
  IconButton,
  Tooltip,
  Avatar,
  Chip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import PlaceIcon from '@mui/icons-material/LocationOn';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

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

interface DailyRecommendation {
  message: string;
  match: { id: string; name: string; reason: string };
  event: { id: string; title: string; reason: string };
  place: { id: string; name: string; reason: string };
  challenge: { type: 'bet' | 'duel'; target: string; terms: string };
  resources: Array<{ goal: string; suggestion: string; details: string }>;
  routine: Array<{ time: string; task: string; alignment: string; category?: string }>;
  goalStrategy?: GoalStrategyItem[];
  networkLeverage?: NetworkLeverage;
  schedule?: {
    focusTheme: string;
    energyCurve: string;
    timeSlotCount: number;
    highPrioritySlots: number;
  };
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

const AxiomDailyProtocol: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<DailyRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProtocol = async () => {
    setLoading(true);
    try {
      const { data: row, error } = await supabase
        .from('axiom_daily_briefs')
        .select('brief')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (row?.brief) {
        setData(row.brief as any);
      }
    } catch (err) {
      console.error('Failed to fetch Axiom protocol:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchProtocol();
  }, [userId]);

  if (loading) {
    return (
      <GlassCard sx={{ p: 3, mb: 4, textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">Fetching your Daily Protocol...</Typography>
      </GlassCard>
    );
  }

  if (!data) return null;

  const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; color?: string }> = ({ icon, label, color = 'primary.main' }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <Box sx={{ color }}>{icon}</Box>
      <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color, fontSize: '1rem' }}>{label}</Typography>
    </Box>
  );

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="overline" color="text.disabled" sx={{ letterSpacing: '0.1em', fontSize: '0.65rem', fontWeight: 700 }}>
          ⚡ Axiom Daily Protocol
        </Typography>
        <Tooltip title="View full history in Coaching tab">
          <IconButton size="small" onClick={() => navigate('/coaching')} sx={{ opacity: 0.6 }}>
            <OpenInNewIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ p: 3, borderRadius: 4, background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(245,158,11,0.06) 100%)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        
        {/* Axiom's Message */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
          <Avatar sx={{ width: 40, height: 40, background: 'linear-gradient(135deg, #78350F, #92400E)', border: '1px solid rgba(245,158,11,0.4)', fontSize: '1.2rem' }}>
            🥋
          </Avatar>
          <Box sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.05)', p: 2, borderRadius: '4px 16px 16px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.primary', lineHeight: 1.6 }}>
              "{data.message || 'Ready for another day of growth student? Here is your personalized protocol.'}"
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={2}>
          {/* Quick Hits */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <GlassCard sx={{ p: 1.5, height: '100%', cursor: 'pointer', border: '1px solid rgba(139,92,246,0.1)' }} onClick={() => navigate(`/profile/${data?.match?.id || 'null'}`)}>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, display: 'block', mb: 0.5 }}>BEST MATCH</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{String(data?.match?.name || 'None found')}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{String(data?.match?.reason || 'Update goals to find matches')}</Typography>
            </GlassCard>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <GlassCard sx={{ p: 1.5, height: '100%', cursor: 'pointer', border: '1px solid rgba(236,72,153,0.1)' }} onClick={() => navigate(`/discover?tab=events`)}>
              <Typography variant="caption" sx={{ color: '#EC4899', fontWeight: 800, display: 'block', mb: 0.5 }}>EVENT</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{String(data?.event?.title || 'None found')}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{String(data?.event?.reason || 'Check back tomorrow')}</Typography>
            </GlassCard>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <GlassCard sx={{ p: 1.5, height: '100%', cursor: 'pointer', border: '1px solid rgba(99,102,241,0.1)' }} onClick={() => navigate(`/discover?tab=places`)}>
              <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 800, display: 'block', mb: 0.5 }}>PLACE</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{String(data?.place?.name || 'None found')}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{String(data?.place?.reason || 'Explore your city')}</Typography>
            </GlassCard>
          </Grid>

          {/* Daily Routine - Horizontal Scroll (Compact) */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, display: 'block', mb: 2 }}>📅 ROUTINE</Typography>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  overflowX: 'auto',
                  pb: 2,
                  '&::-webkit-scrollbar': { height: 6 },
                  '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '3px' },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(167,139,250,0.3)', borderRadius: '3px' },
                }}
              >
                {Array.isArray(data?.routine) && data.routine.length > 0 ? data.routine.map((item, i) => (
                  <Box
                    key={i}
                    sx={{
                      minWidth: 200,
                      maxWidth: 220,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'rgba(167,139,250,0.06)',
                      border: '1px solid rgba(167,139,250,0.2)',
                      position: 'relative',
                      flexShrink: 0,
                    }}
                  >
                    {/* Time badge */}
                    <Box sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(167,139,250,0.15)', px: 1, py: 0.3, borderRadius: '8px' }}>
                      <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700, fontSize: '0.55rem' }}>
                        {item.time?.split(' ')[0] || `Block ${i + 1}`}
                      </Typography>
                    </Box>

                    {/* Task */}
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 1, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.task || 'Focus on goal'}
                    </Typography>

                    {/* Category badge */}
                    {item.category && CATEGORY_COLORS[item.category] && (
                      <Chip
                        label={`${CATEGORY_COLORS[item.category].emoji} ${item.category.replace('_', ' ')}`}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.5rem',
                          bgcolor: CATEGORY_COLORS[item.category].bg,
                          color: CATEGORY_COLORS[item.category].text,
                          border: `1px solid ${CATEGORY_COLORS[item.category].border}`,
                        }}
                      />
                    )}
                  </Box>
                )) : (
                  <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, minWidth: 200 }}>
                    <Typography variant="caption" color="text.secondary">No routine yet</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>

          {/* Simplified Dashboard View - Just Match, Event, Place */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ mt: 2, p: 2, borderRadius: 3, bgcolor: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, display: 'block', mb: 2 }}>
                📋 TODAY'S HIGHLIGHTS
              </Typography>
              <Stack spacing={2}>
                {/* Match */}
                {data?.match && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)' }}>
                    <Typography variant="caption" sx={{ color: '#EC4899', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      🤝 BEST MATCH
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{data.match.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{data.match.reason}</Typography>
                  </Box>
                )}

                {/* Event */}
                {data?.event && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)' }}>
                    <Typography variant="caption" sx={{ color: '#EC4899', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      📅 UPCOMING EVENT
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{data.event.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{data.event.reason}</Typography>
                  </Box>
                )}

                {/* Place */}
                {data?.place && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      📍 RECOMMENDED PLACE
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{data.place.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{data.place.reason}</Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          </Grid>
  );
};

export default AxiomDailyProtocol;
