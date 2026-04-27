import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { useGamification } from '../../hooks/useGamification';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/common/GlassCard';
import PostFeed from '../posts/PostFeed';
import SiteTour from '../../components/common/SiteTour';
import AxiomMorningBrief from './components/AxiomMorningBrief';
import GettingStartedPage from '../onboarding/GettingStartedPage';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LevelBadge from '../../components/common/LevelBadge';
import DailyQuestsWidget from '../../components/common/DailyQuestsWidget';
import WeeklyChallengeWidget from '../../components/common/WeeklyChallengeWidget';
import DailyCombosWidget from '../../components/common/DailyCombosWidget';
import AchievementShareModal from '../../components/common/AchievementShareModal';
import SeasonalEventCard from '../../components/common/SeasonalEventCard';
import LiveStreamsWidget from '../streaming/LiveStreamsWidget';
import { useGamificationNotifications } from '../../hooks/useGamificationNotifications';
import { useCelebrations } from '../../hooks/useCelebrations';
import { DOMAIN_COLORS } from '../../types/goal';
import toast from 'react-hot-toast';

import PageSkeleton from '../../components/common/PageSkeleton';
import {
  Container, Box, Typography, Button, Alert, Stack,
  Grid, Avatar, Chip, LinearProgress,
} from '@mui/material';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PlaceIcon from '@mui/icons-material/Place';
import VerifiedIcon from '@mui/icons-material/Verified';
import ExploreIcon from '@mui/icons-material/Explore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface MatchResult { userId: string; score: number; }
interface MatchProfile { name: string; avatar_url: string | null; }

const DashboardPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const currentUserId = user?.id;

  const { profile: gamificationProfile, quests, loading: gamificationLoading } = useGamification(currentUserId || '');
  const { latestAchievement, clearLatestAchievement } = useGamificationNotifications(currentUserId);
  const { celebrateLevelUp } = useCelebrations();

  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const [achievementModalOpen, setAchievementModalOpen] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goalTree, setGoalTree] = useState<any>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [initialCheckedIn, setInitialCheckedIn] = useState(false);
  const [initialBriefs, setInitialBriefs] = useState<any[]>([]);
  const [initialTodayBrief, setInitialTodayBrief] = useState<any>(null);

  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchProfiles, setMatchProfiles] = useState<Record<string, MatchProfile>>({});
  const [allMatchScores, setAllMatchScores] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUserId) return;
    const fetchData = async () => {
      setLoadingContent(true);
      try {
        const res = await api.get(`/dashboard/summary`, { params: { userId: currentUserId } });
        const { goalTree: tree, checkedIn, briefs, todayBrief } = res.data;
        setGoalTree(tree ?? null);
        setInitialCheckedIn(!!checkedIn);
        setInitialBriefs(Array.isArray(briefs) ? briefs : []);
        setInitialTodayBrief(todayBrief ?? null);
      } catch (err: any) {
        const isNetworkError = !err.response && err.message === 'Network Error';
        if (isNetworkError) {
          setError('Backend is temporarily unavailable. Please try again in a few minutes.');
        } else {
          console.error('Dashboard fetch error:', err);
          setError(`Dashboard error: ${err?.message || String(err)}`);
        }
      } finally {
        setLoadingContent(false);
      }
    };
    fetchData();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    api.get(`/matches/${currentUserId}`).then(res => {
      if (!Array.isArray(res.data)) return;
      const all: MatchResult[] = res.data;
      setMatches(all.slice(0, 3));
      const scoreMap: Record<string, number> = {};
      all.forEach(m => { scoreMap[m.userId] = m.score; });
      setAllMatchScores(scoreMap);
      const ids = all.slice(0, 3).map(m => m.userId);
      if (ids.length === 0) return;
      supabase.from('profiles').select('id, name, avatar_url').in('id', ids).then(({ data }) => {
        const map: Record<string, MatchProfile> = {};
        for (const p of data ?? []) map[p.id] = { name: p.name, avatar_url: p.avatar_url };
        setMatchProfiles(map);
      });
    }).catch(() => {});
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    api.get(`/users/leaderboard`, { params: { userId: currentUserId } })
      .then(res => setLeaderboard(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    api.get(`/users/nearby`, { params: { userId: currentUserId, radiusKm: 200 } })
      .then(res => setNearbyUsers(Array.isArray(res.data) ? res.data.slice(0, 6) : []))
      .catch(() => {});
  }, [currentUserId]);

  useEffect(() => {
    if (!user?.id) return;
    if (!localStorage.getItem(`praxis_tour_seen_${user.id}`)) setTourOpen(true);
  }, [user?.id]);

  useEffect(() => {
    if (latestAchievement?.achievement_title) setAchievementModalOpen(true);
  }, [latestAchievement]);

  useEffect(() => {
    if (gamificationProfile?.level) {
      const newLevel = gamificationProfile.level;
      if (prevLevel !== null && newLevel > prevLevel) celebrateLevelUp(prevLevel, newLevel);
      setPrevLevel(newLevel);
    }
  }, [gamificationProfile?.level]);

  const curatedLeaderboard = useMemo(() => {
    if (leaderboard.length === 0) return leaderboard;
    return [...leaderboard].sort((a, b) => {
      const aRanked = (a.praxis_points ?? 0) * (1 + (allMatchScores[a.id] ?? 0));
      const bRanked = (b.praxis_points ?? 0) * (1 + (allMatchScores[b.id] ?? 0));
      return bRanked - aRanked;
    });
  }, [leaderboard, allMatchScores]);

  // ── Early returns ──────────────────────────────────────────────────────────

  if (userLoading || (loadingContent && !goalTree)) return <PageSkeleton cards={4} />;

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const allNodes = Array.isArray(goalTree?.nodes) ? goalTree!.nodes : [];
  const raw_root_data = (goalTree as { root_nodes?: string[] } | null)?.root_nodes || (goalTree as { rootNodes?: string[] } | null)?.rootNodes || [];
  const root_data = Array.isArray(raw_root_data) ? raw_root_data : [];

  const rootGoals = allNodes.filter((n: { id: string; parentId?: string; parent_id?: string }) => {
    const isInRootList = root_data.some((r: string | { id: string }) => {
      if (typeof r === 'string') return r === n.id;
      if (typeof r === 'object' && r !== null) return (r as { id: string }).id === n.id;
      return false;
    });
    if (isInRootList) return true;
    const pid = n.parentId || (n as { parent_id?: string }).parent_id;
    return !pid || pid === '' || pid === 'root' || pid === 'null';
  });

  const hasGoals = allNodes.length > 0;

  if (!loadingContent && user?.onboarding_completed && !hasGoals && currentUserId) {
    return <GettingStartedPage userId={currentUserId} />;
  }

  const userName = user?.name || 'Explorer';
  const avgProgress = hasGoals
    ? Math.round(rootGoals.reduce((s: number, g: { progress?: number }) => s + (g.progress || 0) * 100, 0) / (rootGoals.length || 1))
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 12 }}>
      <Container maxWidth="lg">
        {/* ── Morning Brief (full width) ── */}
        <Box sx={{ pt: 4 }}>
          <ErrorBoundary label="Morning Brief">
            {currentUserId && (
              <AxiomMorningBrief
                userName={userName}
                streak={user?.current_streak ?? 0}
                points={user?.praxis_points ?? 0}
                avgProgress={avgProgress}
                hasGoals={hasGoals}
                userId={currentUserId}
                initialBriefs={initialBriefs}
                initialCheckedIn={initialCheckedIn}
                streakShield={user?.streak_shield ?? false}
                initialTodayBrief={initialTodayBrief}
                onCheckIn={() => {}}
              />
            )}
          </ErrorBoundary>
        </Box>

        {/* ── Seasonal Events ── */}
        {currentUserId && (
          <Box sx={{ mt: 3 }}>
            <ErrorBoundary label="Seasonal Events">
              <SeasonalEventCard userId={currentUserId} />
            </ErrorBoundary>
          </Box>
        )}

        {/* ── Two-column layout ── */}
        <Grid container spacing={3} sx={{ mt: 1 }}>

{/* ── LEFT COLUMN: Posts + Activity ── */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>

              {/* Activity Feed */}
              <ErrorBoundary label="Activity Feed">
                <Box>
                  <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 900, mb: 2, display: 'block', px: 1, fontSize: '0.65rem' }}>
                    RECENT ACTIVITY
                  </Typography>
                  <PostFeed context="general" feedUserId={currentUserId} personalized />
                </Box>
              </ErrorBoundary>
            </Stack>
          </Grid>

          {/* ── RIGHT COLUMN: Gamification + Social ── */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>

              {/* Gamification Summary */}
              {gamificationProfile && (
                <ErrorBoundary label="Gamification">
                  <GlassCard sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <LevelBadge level={gamificationProfile.level} size="medium" />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          Level {gamificationProfile.level}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {gamificationProfile.xp_progress} / {gamificationProfile.xp_needed} XP
                        </Typography>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={gamificationProfile.xp_percent}
                      sx={{
                        height: 4, borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #8B5CF6, #6366F1)', borderRadius: 2 },
                      }}
                    />
                    <Box sx={{ mt: 2 }}>
                      <DailyQuestsWidget />
                    </Box>
                  </GlassCard>
                </ErrorBoundary>
              )}

              {/* Live Streams */}
              <LiveStreamsWidget />

              {/* Near You */}
              <ErrorBoundary label="Near You">
                {nearbyUsers.length > 0 && (
                  <GlassCard sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
                      <PlaceIcon sx={{ color: '#10B981', fontSize: 18 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Near You</Typography>
                    </Box>
                    <Stack spacing={1}>
                      {nearbyUsers.slice(0, 4).map((u: any) => (
                        <Box
                          key={u.id}
                          onClick={() => navigate(`/profile/${u.id}`)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: '10px',
                            cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                          }}
                        >
                          <Avatar src={u.avatar_url || undefined} sx={{ width: 28, height: 28, bgcolor: '#10B981', fontSize: '0.75rem' }}>
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="caption" sx={{ fontWeight: 700, flexGrow: 1 }} noWrap>
                            {u.name || 'Praxis User'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600, fontSize: '0.6rem' }}>
                            {u.distanceKm < 1 ? '< 1 km' : `${u.distanceKm} km`}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </GlassCard>
                )}
              </ErrorBoundary>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <SiteTour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          if (user?.id) localStorage.setItem(`praxis_tour_seen_${user.id}`, '1');
        }}
      />

      <AchievementShareModal
        achievement={{
          id: latestAchievement?.achievement_key || '',
          title: latestAchievement?.achievement_title || '',
        }}
        open={achievementModalOpen}
        onClose={() => {
          setAchievementModalOpen(false);
          clearLatestAchievement();
        }}
      />
    </Box>
  );
};

export default DashboardPage;
