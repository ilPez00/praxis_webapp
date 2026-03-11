import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../lib/api';
import axios from 'axios';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { GoalTree } from '../../models/GoalTree';
import GlassCard from '../../components/common/GlassCard';
import PostFeed from '../posts/PostFeed';
import SiteTour from '../../components/common/SiteTour';
import GoalWidgets from './components/GoalWidgets';
import AxiomMorningBrief from './components/AxiomMorningBrief';
import TrackerSection from '../trackers/TrackerSection';
import GettingStartedPage from '../onboarding/GettingStartedPage';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import QuickActionFAB from '../../components/common/QuickActionFAB';
import InsightsIcon from '@mui/icons-material/Insights';
import HubIcon from '@mui/icons-material/Hub';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';

import {
  Container,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Grid,
} from '@mui/material';

const DashboardPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [localStreak, setLocalStreak] = useState<number | null>(null);
  const [localPoints, setLocalPoints] = useState<number | null>(null);
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBets, setActiveBets] = useState<any[]>([]);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setCurrentUserId(authUser?.id);
    })();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await axios.get(`${API_URL}/bets/${currentUserId}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const all = Array.isArray(res.data) ? res.data : [];
        setActiveBets(all.filter((b: any) => b.status === 'active'));
      } catch { setActiveBets([]); }
    })();
  }, [currentUserId]);

  useEffect(() => {
    if (!user?.id) return;
    if (!localStorage.getItem(`praxis_tour_seen_${user.id}`)) setTourOpen(true);
  }, [user?.id]);

  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      setLoadingContent(true);
      try {
        const res = await axios.get(`${API_URL}/goals/${currentUserId}`);
        setGoalTree(res.data);
      } catch (err: any) {
        setError(`Dashboard error: ${err?.message || String(err)}`);
      } finally {
        setLoadingContent(false);
      }
    })();
  }, [currentUserId]);

  if (userLoading || loadingContent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const rootGoals = Array.isArray(goalTree?.rootNodes) ? goalTree!.rootNodes : [];
  const allNodes  = Array.isArray(goalTree?.nodes)     ? goalTree!.nodes     : [];
  const hasGoals  = rootGoals.length > 0;

  if (user?.onboarding_completed && !hasGoals && currentUserId) {
    return <GettingStartedPage userId={currentUserId} />;
  }

  const userName    = user?.name || 'Explorer';
  const avgProgress = hasGoals
    ? Math.round(rootGoals.reduce((s, g) => s + g.progress * 100, 0) / rootGoals.length)
    : 0;

  const handleOpenCompose = () => {
    window.dispatchEvent(new CustomEvent('praxis_open_compose'));
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 12 }}>
      <Container maxWidth="lg">

        {/* ── 1. Top Briefing ── */}
        <Box sx={{ pt: 4 }}>
          {currentUserId && (
            <AxiomMorningBrief
              userName={userName}
              streak={localStreak ?? (user?.current_streak ?? 0)}
              points={localPoints ?? (user?.praxis_points ?? 0)}
              avgProgress={avgProgress}
              hasGoals={hasGoals}
              userId={currentUserId}
              onCheckIn={(s, p) => { setLocalStreak(s); setLocalPoints(p); }}
            />
          )}
        </Box>

        {/* ── 2. Progress Hub ── */}
        <Box sx={{ mb: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TrackChangesIcon color="primary" /> Active Goal Widgets
            </Typography>
            <Button variant="text" size="small" onClick={() => navigate('/analytics')} startIcon={<InsightsIcon />} sx={{ fontWeight: 700 }}>
              Full Analytics
            </Button>
          </Box>
          
          {currentUserId && hasGoals && (
            <ErrorBoundary fallback={null}>
              <GoalWidgets
                userId={currentUserId}
                allNodes={allNodes}
                activeBets={activeBets}
                onProgressUpdate={(nodeId, newProgress) => {
                  setGoalTree(prev => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      nodes: prev.nodes.map((n: any) =>
                        n.id === nodeId ? { ...n, progress: newProgress } : n
                      ),
                    };
                  });
                }}
              />
            </ErrorBoundary>
          )}
        </Box>

        {/* ── 3. Trackers & Community ── */}
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ position: 'sticky', top: 84 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, px: 1 }}>
                <HubIcon sx={{ color: '#8B5CF6' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Metrics & Network</Typography>
              </Box>
              <GlassCard sx={{ p: 3, mb: 3 }}>
                <TrackerSection userId={currentUserId!} />
              </GlassCard>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, px: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Community Activity</Typography>
            </Box>
            <PostFeed 
              context="general" 
              feedUserId={currentUserId} 
              personalized 
            />
          </Grid>
        </Grid>

      </Container>

      <QuickActionFAB onPostClick={handleOpenCompose} />

      <SiteTour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          if (user?.id) localStorage.setItem(`praxis_tour_seen_${user.id}`, '1');
        }}
      />
    </Box>
  );
};

export default DashboardPage;
