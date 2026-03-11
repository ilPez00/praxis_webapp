import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { API_URL } from '../../../lib/api';
import GlassCard from '../../../components/common/GlassCard';
import {
  Box,
  Typography,
  Grid,
  Stack,
  CircularProgress,
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
            <GlassCard sx={{ p: 1.5, height: '100%', cursor: 'pointer', border: '1px solid rgba(139,92,246,0.1)' }} onClick={() => navigate(`/profile/${data.match?.id || 'null'}`)}>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, display: 'block', mb: 0.5 }}>BEST MATCH</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{String(data.match?.name || 'None found')}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{String(data.match?.reason || 'Update goals to find matches')}</Typography>
            </GlassCard>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <GlassCard sx={{ p: 1.5, height: '100%', cursor: 'pointer', border: '1px solid rgba(236,72,153,0.1)' }} onClick={() => navigate(`/discover?tab=events`)}>
              <Typography variant="caption" sx={{ color: '#EC4899', fontWeight: 800, display: 'block', mb: 0.5 }}>EVENT</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{String(data.event?.title || 'None found')}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{String(data.event?.reason || 'Check back tomorrow')}</Typography>
            </GlassCard>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <GlassCard sx={{ p: 1.5, height: '100%', cursor: 'pointer', border: '1px solid rgba(99,102,241,0.1)' }} onClick={() => navigate(`/discover?tab=places`)}>
              <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 800, display: 'block', mb: 0.5 }}>PLACE</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{String(data.place?.name || 'None found')}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{String(data.place?.reason || 'Explore your city')}</Typography>
            </GlassCard>
          </Grid>

          {/* Strategic Insight */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 800, display: 'block', mb: 1 }}>GOAL RESOURCES</Typography>
              <Stack spacing={1}>
                {Array.isArray(data.resources) && data.resources.slice(0, 2).map((res, i) => (
                  <Box key={i} sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 1.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, fontSize: '0.65rem' }}>{String(res.goal)}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{String(res.suggestion)}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>

          {/* Competitive Call */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, display: 'block', mb: 1 }}>DAILY CHALLENGE</Typography>
              <Box sx={{ p: 1.5, bgcolor: 'rgba(245,158,11,0.05)', borderRadius: 2, border: '1px dashed #F59E0B' }}>
                <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, display: 'block' }}>{String(data.challenge?.type || 'Competition')}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{String(data.challenge?.target || 'Stay consistent today')}</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default AxiomDailyProtocol;
