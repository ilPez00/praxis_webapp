import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Stack, IconButton, CircularProgress, Button, Tooltip, Divider } from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import ChatIcon from '@mui/icons-material/Chat';
import { supabase } from '../../../lib/supabase';
import axios from 'axios';
import { API_URL } from '../../../lib/api';
import toast from 'react-hot-toast';
import { getAxiomQuote } from '../../../utils/axiomQuotes';

const DesktopWidget: React.FC = () => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [trackerCount, setTrackerCount] = useState(0);
  const [lastAxiomMessage, setLastAxiomMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

        const [userRes, checkinRes, trackersRes, axiomRes] = await Promise.allSettled([
          axios.get(`${API_URL}/users/${user.id}`, { headers }),
          axios.get(`${API_URL}/checkins/today`, { headers }),
          axios.get(`${API_URL}/trackers/summary/today`, { headers }),
          axios.get(`${API_URL}/axiom/last-response`, { headers }),
        ]);

        if (userRes.status === 'fulfilled') setUserData(userRes.value.data);
        if (checkinRes.status === 'fulfilled') setCheckedInToday(!!checkinRes.value.data?.checked_in);
        if (trackersRes.status === 'fulfilled') setTrackerCount(trackersRes.value.data?.total_entries || 0);
        if (axiomRes.status === 'fulfilled') setLastAxiomMessage(axiomRes.value.data?.content || null);

        // Sync to native if available
        const widgetData = {
          streak: userRes.status === 'fulfilled' ? userRes.value.data.streak : 0,
          pp: userRes.status === 'fulfilled' ? userRes.value.data.praxisPoints : 0,
          quote: getAxiomQuote(userRes.status === 'fulfilled' ? userRes.value.data.streak : 0),
          trackers: trackersRes.status === 'fulfilled' ? trackersRes.value.data?.total_entries : 0,
          lastAxiom: axiomRes.status === 'fulfilled' ? axiomRes.value.data?.content : null,
          goalName: currentUser?.goalTree?.[0]?.name || '',
          goalProgress: currentUser?.goalTree?.[0]?.progress || 0
        };

        if ((window as any).electron?.syncWidgetData) {
          (window as any).electron.syncWidgetData(widgetData);
        }

        // Android WebView interface
        if ((window as any).AndroidWidget?.syncWidgetData) {
          (window as any).AndroidWidget.syncWidgetData(JSON.stringify(widgetData));
        }

        // Linux Electron interface
        if ((window as any).electronAPI?.saveWidgetData) {
          (window as any).electronAPI.saveWidgetData({
            streak: widgetData.streak,
            praxisPoints: widgetData.pp,
            axiomQuote: widgetData.quote,
            trackerCount: widgetData.trackers,
            lastAxiomMessage: widgetData.lastAxiom,
            goalName: widgetData.goalName,
            goalProgress: widgetData.goalProgress
          });
        }
      }
    } catch (error) {
      console.error('Error fetching widget data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCheckIn = async () => {
    if (checkedInToday || checkingIn) return;
    setCheckingIn(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      await axios.post(`${API_URL}/checkins`, {}, { headers });
      setCheckedInToday(true);
      // Refresh user data to show updated streak/points
      fetchData();
      toast.success('Checked in! 🔥');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Check-in failed';
      toast.error(msg);
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'transparent' }}>
        <CircularProgress size={24} sx={{ color: '#F97316' }} />
      </Box>
    );
  }

  if (!userData) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(10, 11, 20, 0.8)', borderRadius: 2, border: '1px solid rgba(249, 115, 22, 0.3)' }}>
        <Typography variant="body2" color="white">Please login to Praxis</Typography>
      </Box>
    );
  }

  return (
    <Box
      className="draggable"
      sx={{
        p: 1.5,
        bgcolor: 'rgba(10, 11, 20, 0.85)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        border: '1px solid rgba(249, 115, 22, 0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        width: 'fit-content',
        minWidth: '200px',
        color: 'white',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
          PRAXIS
        </Typography>
        <IconButton
          size="small"
          onClick={() => (window as any).electron?.closeWidget()}
          sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white' } }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </Stack>

      <Stack spacing={1.5}>
        {/* Axiom Quote */}
        <Box sx={{ bgcolor: 'rgba(139, 92, 246, 0.1)', p: 1, borderRadius: 2, border: '1px solid rgba(139, 92, 246, 0.2)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.5rem', fontWeight: 800, display: 'block', mb: 0.5 }}>
            AXIOM'S DAILY GUIDANCE
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic', fontSize: '0.7rem', lineHeight: 1.3 }}>
            "{getAxiomQuote(userData.streak || 0)}"
          </Typography>
        </Box>

        {/* Stats row */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 24 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1, color: '#F97316' }}>
                {userData.streak || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', fontWeight: 700 }}>
                STREAK
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#A78BFA', fontSize: 20 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1, color: '#A78BFA' }}>
                {userData.praxisPoints || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', fontWeight: 700 }}>
                PP
              </Typography>
            </Box>
          </Box>
        </Stack>

        {/* Check-in button */}
        <Tooltip title={checkedInToday ? 'Already checked in today' : 'Log today\'s check-in'}>
          <span>
            <Button
              fullWidth
              size="small"
              variant={checkedInToday ? 'outlined' : 'contained'}
              disabled={checkedInToday || checkingIn}
              onClick={handleCheckIn}
              startIcon={
                checkingIn
                  ? <CircularProgress size={12} color="inherit" />
                  : checkedInToday
                  ? <CheckCircleIcon fontSize="small" />
                  : <RadioButtonUncheckedIcon fontSize="small" />
              }
              sx={{
                borderRadius: 2,
                fontSize: '0.72rem',
                fontWeight: 700,
                py: 0.5,
                ...(checkedInToday
                  ? { borderColor: '#22C55E', color: '#22C55E', opacity: 0.7 }
                  : { bgcolor: '#F97316', color: '#fff', '&:hover': { bgcolor: '#EA6B10' } }),
              }}
            >
              {checkedInToday ? 'Checked in ✓' : 'Check in'}
            </Button>
          </span>
        </Tooltip>

        {/* Tracker Summary */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ pt: 0.5 }}>
          <TrackChangesIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
            {trackerCount} tracker entries today
          </Typography>
        </Stack>

        {/* Last Axiom Message */}
        {lastAxiomMessage && (
          <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 0.5 }}>
              <ChatIcon sx={{ color: '#A78BFA', fontSize: 12 }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.55rem' }}>
                LAST FROM AXIOM
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {lastAxiomMessage}
            </Typography>
          </Box>
        )}

        {/* Top goal */}
        {userData.topGoal && (
          <Box sx={{ pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontSize: '0.55rem', fontWeight: 800 }}>
              NEXT GOAL
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              {userData.topGoal.emoji} {userData.topGoal.name}
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default DesktopWidget;
