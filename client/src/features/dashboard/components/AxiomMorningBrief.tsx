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
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import EmojiLightbulbIcon from '@mui/icons-material/EmojiObjects';

interface MorningBriefProps {
  userName: string;
  streak: number;
  points: number;
  avgProgress: number;
  hasGoals: boolean;
  userId: string;
  onCheckIn: (newStreak: number, newPoints: number) => void;
}

interface DailyProtocol {
  message: string;
  match: { id: string; name: string; reason: string };
  event: { id: string; title: string; reason: string };
  place: { id: string; name: string; reason: string };
  challenge: { type: 'bet' | 'duel'; target: string; terms: string };
  resources: Array<{ goal: string; suggestion: string; details: string }>;
  routine: Array<{ time: string; task: string; alignment: string }>;
}

const AxiomMorningBrief: React.FC<MorningBriefProps> = ({
  userName, streak, points, avgProgress, hasGoals, userId, onCheckIn,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [data, setData] = useState<DailyProtocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

        const [protocolRes, checkinRes] = await Promise.all([
          supabase.from('axiom_daily_briefs').select('brief').eq('user_id', userId).maybeSingle(),
          axios.get(`${API_URL}/checkins/today`, { params: { userId }, headers }),
        ]);

        if (protocolRes.data?.brief) {
          setData(protocolRes.data.brief as any);
        }
        setCheckedIn(checkinRes.data.checkedIn);
      } catch (err) {
        console.error('Failed to fetch morning brief:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

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
        <Typography variant="h6" fontWeight={700}>Preparing your daily protocol...</Typography>
      </GlassCard>
    );
  }

  return (
    <Box sx={{ mb: 5 }}>
      {/* 1. Greeting & Hero Header */}
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

        {!checkedIn && (
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
      </Box>

      {/* 2. Unified Axiom Protocol Card */}
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
                  label="Daily Brief" 
                  size="small" 
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }} 
                />
              </Box>
              <Typography variant="h6" sx={{ color: 'text.primary', lineHeight: 1.5, fontWeight: 500, fontSize: { xs: '1rem', sm: '1.1rem' }, letterSpacing: '-0.01em' }}>
                {data?.message || `Focus on showing up today, ${userName}. Discipline is the only shortcut.`}
              </Typography>
              
              {/* Daily Tip Chip */}
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
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5, lineHeight: 1.2 }}>
                    {item.title || 'Scanning...'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, mt: 'auto' }}>
                    {item.reason || 'Identifying best fit'}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

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
        </Box>
      </GlassCard>
    </Box>
  );
};

export default AxiomMorningBrief;
