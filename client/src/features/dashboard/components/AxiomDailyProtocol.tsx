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
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface DailyRecommendation {
  message: string;
  match: { id: string; name: string; reason: string };
  event: { id: string; title: string; reason: string };
  place: { id: string; name: string; reason: string };
  challenge: { type: 'bet' | 'duel'; target: string; terms: string };
  resources: Array<{ goal: string; suggestion: string; details: string }>;
  routine: Array<{ time: string; task: string; alignment: string }>;
}

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

          {/* Daily Routine - Expanded */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, display: 'block', mb: 2 }}>📅 YOUR PERSONALIZED ROUTINE</Typography>
              <Stack spacing={2}>
                {Array.isArray(data?.routine) && data.routine.length > 0 ? data.routine.map((item, i) => (
                  <Box 
                    key={i} 
                    sx={{ 
                      p: 2.5, 
                      borderRadius: 3, 
                      bgcolor: 'rgba(167,139,250,0.06)', 
                      border: '1px solid rgba(167,139,250,0.2)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Time badge */}
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 0, 
                      right: 0, 
                      bgcolor: 'rgba(167,139,250,0.15)', 
                      px: 1.5, 
                      py: 0.5,
                      borderBottomLeftRadius: '12px',
                    }}>
                      <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, fontSize: '0.6rem' }}>
                        {item.time || `Block ${i + 1}`}
                      </Typography>
                    </Box>
                    
                    {/* Duration chip */}
                    {item.duration && (
                      <Chip 
                        label={item.duration} 
                        size="small" 
                        sx={{ 
                          mb: 1.5, 
                          height: 20, 
                          fontSize: '0.55rem', 
                          bgcolor: 'rgba(16,185,129,0.15)', 
                          color: '#10B981',
                          border: '1px solid rgba(16,185,129,0.3)',
                        }} 
                      />
                    )}
                    
                    {/* Task */}
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1.5, lineHeight: 1.5 }}>
                      {item.task || 'Focus on your most important goal'}
                    </Typography>
                    
                    {/* Preparation */}
                    {item.preparation && (
                      <Box sx={{ 
                        mb: 1.5, 
                        p: 1.5, 
                        bgcolor: 'rgba(255,255,255,0.03)', 
                        borderRadius: 2,
                        border: '1px dashed rgba(255,255,255,0.1)',
                      }}>
                        <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'block', mb: 0.5 }}>
                          🎯 PREPARE
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
                          {item.preparation}
                        </Typography>
                      </Box>
                    )}
                    
                    {/* Alignment - Why this matters */}
                    <Box sx={{ 
                      p: 1.5, 
                      bgcolor: 'rgba(139,92,246,0.08)', 
                      borderRadius: 2,
                      border: '1px solid rgba(139,92,246,0.15)',
                    }}>
                      <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700, display: 'block', mb: 0.5 }}>
                        💡 WHY THIS MATTERS FOR YOU
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                        {item.alignment || 'This builds momentum toward your most important goals.'}
                      </Typography>
                    </Box>
                  </Box>
                )) : (
                  <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      No routine generated. Check back after your next daily brief.
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          </Grid>

          {/* Strategic Insight - Expanded */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 800, display: 'block', mb: 2 }}>🎯 GOAL RESOURCES</Typography>
              <Stack spacing={1.5}>
                {Array.isArray(data?.resources) && data.resources.length > 0 ? data.resources.map((res, i) => (
                  <Box 
                    key={i} 
                    sx={{ 
                      p: 2, 
                      borderRadius: 3, 
                      bgcolor: 'rgba(16,185,129,0.06)', 
                      border: '1px solid rgba(16,185,129,0.2)' 
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 800, fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
                      {String(res?.goal || 'General Goal')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1, lineHeight: 1.4 }}>
                      {String(res?.suggestion || 'Review your progress and take the next step')}
                    </Typography>
                    {res?.details && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.5, mb: 1 }}>
                        {res.details}
                      </Typography>
                    )}
                    {res?.estimatedImpact && (
                      <Box sx={{ 
                        mt: 1, 
                        p: 1, 
                        bgcolor: 'rgba(16,185,129,0.08)', 
                        borderRadius: 2,
                        border: '1px solid rgba(16,185,129,0.15)',
                      }}>
                        <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, display: 'block' }}>
                          ⚡ IMPACT
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {res.estimatedImpact}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )) : (
                  <Typography variant="caption" color="text.disabled">No specific resources for today.</Typography>
                )}
              </Stack>
            </Box>
          </Grid>

          {/* Competitive Challenge - Expanded */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, display: 'block', mb: 2 }}>⚡ DAILY CHALLENGE</Typography>
              <Box sx={{ 
                p: 2.5, 
                bgcolor: 'rgba(245,158,11,0.06)', 
                borderRadius: 3, 
                border: '2px dashed rgba(245,158,11,0.3)',
                position: 'relative',
              }}>
                {/* Type badge */}
                <Chip 
                  label={String(data?.challenge?.type || 'BET').toUpperCase()} 
                  size="small"
                  sx={{ 
                    mb: 1.5, 
                    fontWeight: 800, 
                    bgcolor: 'rgba(245,158,11,0.2)', 
                    color: '#F59E0B',
                    border: '1px solid rgba(245,158,11,0.4)',
                  }}
                />
                
                {/* Target */}
                <Typography variant="body1" sx={{ fontWeight: 800, fontSize: '0.95rem', mb: 1.5, lineHeight: 1.4 }}>
                  {String(data?.challenge?.target || 'Stay consistent and show up for your goals today')}
                </Typography>
                
                {/* Terms */}
                {data?.challenge?.terms && (
                  <Box sx={{ 
                    mb: 1.5, 
                    p: 1.5, 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}>
                    <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      🎯 WHY THIS MATTERS
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                      {data.challenge.terms}
                    </Typography>
                  </Box>
                )}
                
                {/* Deadline */}
                {data?.challenge?.deadline && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    mb: 1,
                    p: 1, 
                    bgcolor: 'rgba(239,68,68,0.1)', 
                    borderRadius: 2,
                  }}>
                    <Typography variant="caption" sx={{ color: '#EF4444', fontWeight: 800 }}>
                      ⏰ DEADLINE
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {data.challenge.deadline}
                    </Typography>
                  </Box>
                )}
                
                {/* Reward */}
                {data?.challenge?.reward && (
                  <Box sx={{ 
                    p: 1.5, 
                    bgcolor: 'rgba(245,158,11,0.08)', 
                    borderRadius: 2,
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, display: 'block', mb: 0.5 }}>
                      🏆 YOUR REWARD
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                      {data.challenge.reward}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default AxiomDailyProtocol;
