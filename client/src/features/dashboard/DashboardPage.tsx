import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

import CircularProgress from '@mui/material/CircularProgress';
import {
  Container,
  Box,
  Typography,
  Button,
  Alert,
  Stack,
  Grid,
} from '@mui/material';
import { API_URL } from '../../lib/api';

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
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token}` };
        
        const [betsRes, goalsRes] = await Promise.all([
          axios.get(`${API_URL}/bets/${currentUserId}`, { headers }),
          axios.get(`${API_URL}/goals/${currentUserId}`)
        ]);

        const allBets = Array.isArray(betsRes.data) ? betsRes.data : [];
        setActiveBets(allBets.filter((b: any) => b.status === 'active'));
        setGoalTree(goalsRes.data);
      } catch (err: any) {
        setError(`Dashboard error: ${err?.message || String(err)}`);
      } finally {
        setLoadingContent(false);
      }
    };
    fetchData();
  }, [currentUserId]);

  useEffect(() => {
    if (!user?.id) return;
    if (!localStorage.getItem(`praxis_tour_seen_${user.id}`)) setTourOpen(true);
  }, [user?.id]);

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

  const allNodes  = Array.isArray(goalTree?.nodes) ? goalTree!.nodes : [];
  // Support both new snake_case and legacy camelCase from the API response
  const raw_root_data = (goalTree as any)?.root_nodes || (goalTree as any)?.rootNodes || [];
  const root_data = Array.isArray(raw_root_data) ? raw_root_data : [];
  
  // Resolve root node objects from allNodes using root_data
  const rootGoals = allNodes.filter(n => {
    // 1. Check if ID exists in root_data array (standard IDs or legacy objects)
    const isInRootList = root_data.some(r => {
      if (typeof r === 'string') return r === n.id;
      if (typeof r === 'object' && r !== null) return (r as any).id === n.id;
      return false;
    });
    if (isInRootList) return true;

    // 2. Fallback: any node without a valid parent reference is a root
    const pid = n.parentId || (n as any).parent_id;
    if (!pid || pid === '' || pid === 'root' || pid === 'null') return true;
    
    return false;
  });

  // hasGoals is true if the user has ANY nodes at all in their tree.
  // This prevents redirecting "complete accounts" to setup if the root calculation is buggy.
  const hasGoals = allNodes.length > 0;

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
        <ErrorBoundary>
          
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

          {/* ── 2. Content Layout ── */}
          <Grid container spacing={4}>
            
            {/* Main Column: Trackers and Goals */}
            <Grid size={{ xs: 12, lg: 8 }}>
              <Stack spacing={5}>
                
                {/* Trackers Section */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, px: 1 }}>
                    <InsightsIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Daily Performance</Typography>
                  </Box>
                  <GlassCard sx={{ p: 3 }}>
                    <TrackerSection userId={currentUserId!} />
                  </GlassCard>
                </Box>

                {/* Goal Focus */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <TrackChangesIcon color="primary" /> Active Goal Focus
                    </Typography>
                    <Button variant="text" size="small" onClick={() => navigate('/analytics')} sx={{ fontWeight: 700 }}>
                      View Analytics
                    </Button>
                  </Box>
                  
                  {currentUserId && hasGoals && (
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
                  )}
                </Box>
              </Stack>
            </Grid>

            {/* Sidebar: Hub Access & Community Feed */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack spacing={5}>
                
                {/* Community Hub Card */}
                <GlassCard sx={{ p: 3, background: 'linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(139,92,246,0.05) 100%)' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HubIcon sx={{ fontSize: 18, color: '#8B5CF6' }} /> COMMUNITY HUB
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Connect with matched builders and find nearby study spots or events.
                  </Typography>
                  <Button fullWidth variant="outlined" onClick={() => navigate('/discover')} sx={{ borderRadius: '10px', fontWeight: 800 }}>
                    Open Map
                  </Button>
                </GlassCard>

                {/* Local Activity Feed */}
                <Box>
                  <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 900, mb: 2, display: 'block', px: 1 }}>RECENT ACTIVITY</Typography>
                  <PostFeed 
                    context="general" 
                    feedUserId={currentUserId} 
                    personalized 
                  />
                </Box>
              </Stack>
            </Grid>
          </Grid>

        </ErrorBoundary>
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
