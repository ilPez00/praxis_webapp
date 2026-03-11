import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Stack, Button, CircularProgress,
  LinearProgress, Chip, Avatar, Divider,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import ChatIcon from '@mui/icons-material/Chat';
import { supabase } from '../../lib/supabase';
import axios from 'axios';
import { API_URL } from '../../lib/api';
import toast from 'react-hot-toast';
import { getAxiomQuote } from '../../utils/axiomQuotes';

interface GoalNode {
  id: string;
  name: string;
  progress: number;
  domain?: string;
}

interface WidgetData {
  name: string;
  avatarUrl?: string;
  streak: number;
  praxisPoints: number;
  topGoal?: GoalNode;
  recentGoals?: GoalNode[];
  trackerCount: number;
  lastAxiomMessage?: string | null;
}

/**
 * MobileWidget — a compact mobile-optimised page designed to be added to the
 * home screen as a PWA shortcut (/mobile-widget).
 */
const MobileWidget: React.FC = () => {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const [userRes, checkinRes, goalsRes, trackersRes, axiomRes] = await Promise.allSettled([
        axios.get(`${API_URL}/users/${user.id}`, { headers }),
        axios.get(`${API_URL}/checkins/today`, { headers }),
        axios.get(`${API_URL}/goals/${user.id}`, { headers }),
        axios.get(`${API_URL}/trackers/summary/today`, { headers }),
        axios.get(`${API_URL}/axiom/last-response`, { headers }),
      ]);

      let widgetData: WidgetData = { name: '', streak: 0, praxisPoints: 0, trackerCount: 0 };

      if (userRes.status === 'fulfilled') {
        const u = userRes.value.data;
        widgetData.name = u.name || '';
        widgetData.avatarUrl = u.avatar_url;
        widgetData.streak = u.streak || 0;
        widgetData.praxisPoints = u.praxisPoints || 0;
      }

      if (checkinRes.status === 'fulfilled') {
        setCheckedInToday(!!checkinRes.value.data?.checked_in);
      }

      if (trackersRes.status === 'fulfilled') {
        widgetData.trackerCount = trackersRes.value.data?.total_entries || 0;
      }

      if (axiomRes.status === 'fulfilled') {
        widgetData.lastAxiomMessage = axiomRes.value.data?.content || null;
      }

      if (goalsRes.status === 'fulfilled') {
        const tree = goalsRes.value.data;
        const nodes: GoalNode[] = Array.isArray(tree?.nodes)
          ? tree.nodes.map((n: any) => ({
              id: n.id,
              name: n.name || n.title || '',
              progress: n.progress ?? 0,
              domain: n.domain,
            }))
          : [];
        const active = nodes
          .filter(n => n.progress < 1)
          .sort((a, b) => b.progress - a.progress);
        widgetData.topGoal = active[0];
        widgetData.recentGoals = active.slice(0, 3);
      }

      setData(widgetData);

      // Sync to native if available (Capacitor or custom bridge)
      const syncPayload = {
        streak: widgetData.streak,
        pp: widgetData.praxisPoints,
        quote: getAxiomQuote(widgetData.streak),
        trackers: widgetData.trackerCount,
        lastAxiom: widgetData.lastAxiomMessage
      };

      if ((window as any).AndroidBridge?.syncWidgetData) {
        (window as any).AndroidBridge.syncWidgetData(JSON.stringify(syncPayload));
      } else if ((window as any).webkit?.messageHandlers?.syncWidgetData) {
        (window as any).webkit.messageHandlers.syncWidgetData.postMessage(syncPayload);
      }

    } catch (err) {
      console.error('MobileWidget fetchData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckIn = async () => {
    if (checkedInToday || checkingIn) return;
    setCheckingIn(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      await axios.post(`${API_URL}/checkins`, {}, { headers });
      setCheckedInToday(true);
      toast.success('Streak kept! 🔥');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0D0E1A' }}>
        <CircularProgress sx={{ color: '#F97316' }} />
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#0D0E1A', gap: 2, p: 3 }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>Not logged in</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Open the Praxis app and log in first.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#0D0E1A',
      backgroundImage: 'radial-gradient(ellipse at top, rgba(249,115,22,0.06) 0%, transparent 60%)',
      p: 2.5,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      maxWidth: 390,
      mx: 'auto',
    }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 1.5 }}>
            PRAXIS
          </Typography>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 800, lineHeight: 1.1 }}>
            {data.name ? `Hey, ${data.name.split(' ')[0]}` : 'Welcome back'}
          </Typography>
        </Box>
        {data.avatarUrl ? (
          <Avatar src={data.avatarUrl} sx={{ width: 40, height: 40 }} />
        ) : (
          <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(249,115,22,0.2)', color: '#F97316', fontWeight: 700 }}>
            {data.name?.[0]?.toUpperCase() || 'P'}
          </Avatar>
        )}
      </Stack>

      {/* Axiom Quote */}
      <Box sx={{
        p: 2, borderRadius: 3,
        bgcolor: 'rgba(139,92,246,0.08)',
        border: '1px solid rgba(139,92,246,0.2)',
      }}>
        <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, letterSpacing: 1, display: 'block', mb: 0.5 }}>
          AXIOM'S DAILY GUIDANCE
        </Typography>
        <Typography variant="body2" sx={{ color: 'white', fontStyle: 'italic', lineHeight: 1.4 }}>
          "{getAxiomQuote(data.streak)}"
        </Typography>
      </Box>

      {/* Stats row */}
      <Stack direction="row" spacing={1.5}>
        <Box sx={{
          flex: 1, p: 1.5, borderRadius: 3, bgcolor: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.25)', textAlign: 'center',
        }}>
          <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 28, mb: 0.25 }} />
          <Typography variant="h5" sx={{ color: '#F97316', fontWeight: 900, lineHeight: 1 }}>
            {data.streak}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', fontWeight: 700 }}>
            DAY STREAK
          </Typography>
        </Box>
        <Box sx={{
          flex: 1, p: 1.5, borderRadius: 3, bgcolor: 'rgba(167,139,250,0.08)',
          border: '1px solid rgba(167,139,250,0.25)', textAlign: 'center',
        }}>
          <AutoAwesomeIcon sx={{ color: '#A78BFA', fontSize: 26, mb: 0.25 }} />
          <Typography variant="h5" sx={{ color: '#A78BFA', fontWeight: 900, lineHeight: 1 }}>
            {data.praxisPoints}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', fontWeight: 700 }}>
            PRAXIS POINTS
          </Typography>
        </Box>
      </Stack>

      {/* Tracker Summary */}
      <Box sx={{
        p: 1.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1
      }}>
        <TrackChangesIcon sx={{ color: '#F97316', fontSize: 18 }} />
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'white' }}>
          {data.trackerCount} tracker entries today
        </Typography>
      </Box>

      {/* Last Axiom Message */}
      {data.lastAxiomMessage && (
        <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(167,139,250,0.3)' }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <ChatIcon sx={{ color: '#A78BFA', fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800, letterSpacing: 1 }}>
              LAST FROM AXIOM
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
            {data.lastAxiomMessage}
          </Typography>
        </Box>
      )}

      {/* Check-in CTA */}
      <Button
        fullWidth
        variant={checkedInToday ? 'outlined' : 'contained'}
        disabled={checkedInToday || checkingIn}
        onClick={handleCheckIn}
        startIcon={
          checkingIn
            ? <CircularProgress size={18} color="inherit" />
            : checkedInToday
            ? <CheckCircleIcon />
            : <RadioButtonUncheckedIcon />
        }
        sx={{
          py: 1.75,
          borderRadius: 3,
          fontWeight: 800,
          fontSize: '1rem',
          letterSpacing: 0.5,
          ...(checkedInToday
            ? { borderColor: '#22C55E', color: '#22C55E', borderWidth: 2 }
            : {
                bgcolor: '#F97316',
                color: '#fff',
                boxShadow: '0 4px 20px rgba(249,115,22,0.35)',
                '&:hover': { bgcolor: '#EA6B10' },
              }),
        }}
      >
        {checkedInToday ? 'Checked in today ✓' : 'Check In'}
      </Button>

      {/* Goal progress */}
      {data.recentGoals && data.recentGoals.length > 0 && (
        <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 1.5 }}>
            <TrackChangesIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 1 }}>
              ACTIVE GOALS
            </Typography>
          </Stack>
          <Stack spacing={1.25}>
            {data.recentGoals.map(goal => (
              <Box key={goal.id}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.4 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.8rem' }} noWrap>
                    {goal.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', ml: 1, flexShrink: 0 }}>
                    {Math.round(goal.progress * 100)}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={goal.progress * 100}
                  sx={{
                    height: 5, borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& .MuiLinearProgress-bar': { bgcolor: '#F97316', borderRadius: 3 },
                  }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Footer hint */}
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', mt: 'auto', pt: 1 }}>
        Add to home screen for quick access
      </Typography>
    </Box>
  );
};

export default MobileWidget;
