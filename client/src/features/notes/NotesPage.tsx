import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { GoalTree } from '../../models/GoalTree';
import GlassCard from '../../components/common/GlassCard';
import TrackerSection from '../trackers/TrackerSection';
import BalanceWidget from '../dashboard/components/BalanceWidget';
import WeeklyNarrativeWidget from '../dashboard/components/WeeklyNarrativeWidget';
import ShareSnippetButton from '../../components/common/ShareSnippetButton';
import ErrorBoundary from '../../components/common/ErrorBoundary';

import {
  Container, Box, Typography, Stack, Grid, CircularProgress,
} from '@mui/material';
import NoteIcon from '@mui/icons-material/Note';
import InsightsIcon from '@mui/icons-material/Insights';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

const NotesPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [goalTree, setGoalTree] = useState<GoalTree | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBets, setActiveBets] = useState<any[]>([]);
  const [streak, setStreak] = useState<number>(0);

  const currentUserId = user?.id;

  // Fetch goal tree and active bets
  useEffect(() => {
    if (!currentUserId) return;
    const fetchData = async () => {
      setLoadingContent(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        // Fetch goal tree
        const treeRes = await supabase
          .from('goal_trees')
          .select('nodes, rootNodes')
          .eq('user_id', currentUserId)
          .single();

        if (treeRes.data) {
          setGoalTree({
            id: treeRes.data.id,
            userId: currentUserId,
            nodes: treeRes.data.nodes || [],
            rootNodes: treeRes.data.rootNodes || [],
          });
        }

        // Fetch active bets
        const betsRes = await supabase
          .from('bets')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('status', 'active');

        setActiveBets(betsRes.data || []);

        // Fetch streak
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_streak')
          .eq('id', currentUserId)
          .single();

        if (profile?.current_streak) {
          setStreak(profile.current_streak);
        }
      } catch (err: any) {
        console.error('Notes fetch error:', err);
        setError(`Notes error: ${err?.message || String(err)}`);
      } finally {
        setLoadingContent(false);
      }
    };
    fetchData();
  }, [currentUserId]);

  if (userLoading || loadingContent) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
          <NoteIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>Notes & Tracking</Typography>
            <Typography variant="body2" color="text.secondary">Your personal dashboard for goals, trackers, and insights</Typography>
          </Box>
        </Box>

        {/* Quick Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {streak > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <GlassCard sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalFireDepartmentIcon sx={{ color: '#F59E0B', fontSize: 24 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#F59E0B' }}>{streak}</Typography>
                  <Typography variant="caption" color="text.secondary">Day Streak</Typography>
                </Box>
              </GlassCard>
            </Grid>
          )}
          {goalTree && goalTree.nodes && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <GlassCard sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrackChangesIcon sx={{ color: '#60A5FA', fontSize: 24 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#60A5FA' }}>
                    {goalTree.nodes.filter((n: any) => !n.parentId).length || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Root Goals</Typography>
                </Box>
              </GlassCard>
            </Grid>
          )}
          {activeBets.length > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <GlassCard sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEventsIcon sx={{ color: '#A78BFA', fontSize: 24 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#A78BFA' }}>{activeBets.length}</Typography>
                  <Typography variant="caption" color="text.secondary">Active Bets</Typography>
                </Box>
              </GlassCard>
            </Grid>
          )}
          <Grid size={{ xs: 6, sm: 3 }}>
            <GlassCard sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <InsightsIcon sx={{ color: '#34D399', fontSize: 24 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#34D399' }}>Track</Typography>
                <Typography variant="caption" color="text.secondary">Progress</Typography>
              </Box>
            </GlassCard>
          </Grid>
        </Grid>

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Left Column - Balance & Share */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <BalanceWidget
                nodes={goalTree?.nodes || []}
                streak={streak}
                onTakeZenDay={() => navigate('/dashboard')}
              />
              <ShareSnippetButton
                name={user?.name || 'Praxis User'}
                streak={streak}
                points={user?.praxis_points || 0}
                topGoal={goalTree?.nodes?.find(n => !n.parentId)?.name}
                size="medium"
              />
              <WeeklyNarrativeWidget userId={currentUserId || ''} />
            </Stack>
          </Grid>

          {/* Right Column - Trackers */}
          <Grid size={{ xs: 12, md: 8 }}>
            <TrackerSection userId={currentUserId || ''} />
          </Grid>
        </Grid>

        {error && (
          <Box sx={{ mt: 3 }}>
            <GlassCard sx={{ p: 3, border: '1px solid rgba(239,68,68,0.2)' }}>
              <Typography color="error">{error}</Typography>
            </GlassCard>
          </Box>
        )}
      </Container>
    </ErrorBoundary>
  );
};

export default NotesPage;
