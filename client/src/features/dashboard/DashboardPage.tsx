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
import ShareSnippetButton from '../../components/common/ShareSnippetButton';
import GettingStartedPage from '../onboarding/GettingStartedPage';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import QuickActionFAB from '../../components/common/QuickActionFAB';
import LevelBadge from '../../components/common/LevelBadge';
import DailyQuestsWidget from '../../components/common/DailyQuestsWidget';
import LevelUpDialog from '../../components/common/LevelUpDialog';
import PPToast from '../../components/common/PPToast';
import AchievementShareModal from '../../components/common/AchievementShareModal';
import SeasonalEventCard from '../../components/common/SeasonalEventCard';
import { useGamificationNotifications } from '../../hooks/useGamificationNotifications';
import { useCelebrations } from '../../hooks/useCelebrations';
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
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

interface MatchResult { userId: string; score: number; }
interface MatchProfile { name: string; avatar_url: string | null; }

const DashboardPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const currentUserId = user?.id;

  // Gamification hook
  const { profile: gamificationProfile, quests, loading: gamificationLoading, trackAction } = useGamification(currentUserId || '');
  
  // Gamification notifications
  const { latestAchievement, clearLatestAchievement } = useGamificationNotifications(currentUserId);
  const { celebrateLevelUp } = useCelebrations();
  
  // Track previous level for level-up detection
  const [prevLevel, setPrevLevel] = useState<number | null>(null);

  // Achievement share modal state
  const [achievementModalOpen, setAchievementModalOpen] = useState(false);

  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goalTree, setGoalTree] = useState<any>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [initialCheckedIn, setInitialCheckedIn] = useState(false);
  const [initialBriefs, setInitialBriefs] = useState<any[]>([]);

  // Social features state
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchProfiles, setMatchProfiles] = useState<Record<string, MatchProfile>>({});
  const [allMatchScores, setAllMatchScores] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);

  // Level up dialog
  const [showLevelUpDialog, setShowLevelUpDialog] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ oldLevel: 1, newLevel: 1, xpProgress: 0, xpNeeded: 1000 });

  // PP Toast
  const [ppToast, setPpToast] = useState<{ show: boolean; amount: number; xpAmount?: number; x: number; y: number } | null>(null);

  // Fetch morning brief data
  useEffect(() => {
    if (!currentUserId) return;
    const fetchData = async () => {
      setLoadingContent(true);
      try {
        const res = await api.get(`/dashboard/summary`, { params: { userId: currentUserId } });
        const { goalTree: tree, checkedIn, briefs } = res.data;
        setGoalTree(tree ?? null);
        setInitialCheckedIn(!!checkedIn);
        setInitialBriefs(Array.isArray(briefs) ? briefs : []);
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError(`Dashboard error: ${err?.message || String(err)}`);
      } finally {
        setLoadingContent(false);
      }
    };
    fetchData();
  }, [currentUserId]);

  // Matches + match profiles
  useEffect(() => {
    if (!currentUserId) return;
    api.get(`/matches/${currentUserId}`).then(res => {
      if (!Array.isArray(res.data)) return;
      const all: MatchResult[] = res.data;
      const top3 = all.slice(0, 3);
      setMatches(top3);
      const scoreMap: Record<string, number> = {};
      all.forEach(m => { scoreMap[m.userId] = m.score; });
      setAllMatchScores(scoreMap);
      const ids = top3.map(m => m.userId);
      if (ids.length === 0) return;
      supabase.from('profiles').select('id, name, avatar_url').in('id', ids).then(({ data }) => {
        const map: Record<string, MatchProfile> = {};
        for (const p of data ?? []) map[p.id] = { name: p.name, avatar_url: p.avatar_url };
        setMatchProfiles(map);
      });
    }).catch(() => {});
  }, [currentUserId]);

  // Leaderboard
  useEffect(() => {
    if (!currentUserId) return;
    api.get(`/users/leaderboard`, { params: { userId: currentUserId } })
      .then(res => setLeaderboard(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [currentUserId]);

  // Nearby users (silent fail — only shows if data available)
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

  // Open achievement share modal when new achievement is unlocked
  useEffect(() => {
    if (latestAchievement?.achievement_title) {
      setAchievementModalOpen(true);
    }
  }, [latestAchievement]);

  // Trigger level up celebration when gamification profile updates
  useEffect(() => {
    if (gamificationProfile?.level) {
      const newLevel = gamificationProfile.level;
      if (prevLevel !== null && newLevel > prevLevel) {
        celebrateLevelUp(prevLevel, newLevel);
      }
      setPrevLevel(newLevel);
    }
  }, [gamificationProfile?.level]);

  // Curated leaderboard: ranked_score = points × (1 + compatibilityScore)
  const curatedLeaderboard = useMemo(() => {
    if (leaderboard.length === 0) return leaderboard;
    return [...leaderboard].sort((a, b) => {
      const aRanked = (a.praxis_points ?? 0) * (1 + (allMatchScores[a.id] ?? 0));
      const bRanked = (b.praxis_points ?? 0) * (1 + (allMatchScores[b.id] ?? 0));
      return bRanked - aRanked;
    });
  }, [leaderboard, allMatchScores]);

  const handleJoinChallenge = async (challengeId: string) => {
    if (!currentUserId) return;
    try {
      await api.post(`/challenges/${challengeId}/join`, {});
      toast.success('Joined challenge!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to join challenge.');
    }
  };

  if (userLoading || (loadingContent && !goalTree)) {
    return <PageSkeleton cards={4} />;
  }

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

  // Show GettingStartedPage to users who completed onboarding but have no goals yet
  if (!loadingContent && user?.onboarding_completed && !hasGoals && currentUserId) {
    return <GettingStartedPage userId={currentUserId} />;
  }

  const userName = user?.name || 'Explorer';
  const avgProgress = hasGoals
    ? Math.round(rootGoals.reduce((s: number, g: { progress?: number }) => s + (g.progress || 0) * 100, 0) / (rootGoals.length || 1))
    : 0;

  const handleOpenCompose = () => {
    window.dispatchEvent(new CustomEvent('praxis_open_compose'));
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 12 }}>
      <Container maxWidth="lg">
          {/* ── Axiom Morning Brief (check-in + match/event/place) ── */}
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

          {/* ── Main Grid ── */}
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <Stack spacing={4}>
                <ErrorBoundary label="Activity Feed">
                  <Box>
                    <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 900, mb: 2, display: 'block', px: 1 }}>
                      RECENT ACTIVITY · ranked by goals · proximity · honor
                    </Typography>
                    <PostFeed context="general" feedUserId={currentUserId} personalized />
                  </Box>
                </ErrorBoundary>
              </Stack>
            </Grid>
          </Grid>

          {/* Top Alignments — moved from right column */}
          <ErrorBoundary label="Top Alignments">
          <Box sx={{ mt: 4 }}>
            <GlassCard sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Top Alignments</Typography>
                <Button size="small" variant="text" onClick={() => navigate('/matches')} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                  View All
                </Button>
              </Box>
              <Stack spacing={1.5}>
                {matches.length > 0 ? matches.map((match) => {
                  const compat = Math.round(match.score * 100);
                  const pillColor = compat > 70 ? '#10B981' : compat > 50 ? '#F59E0B' : '#9CA3AF';
                  return (
                    <Box
                      key={match.userId}
                      onClick={() => navigate(`/chat/${currentUserId}/${match.userId}`)}
                      sx={{
                        p: 1.5, borderRadius: '14px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        bgcolor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'primary.main' },
                      }}
                    >
                      <Avatar
                        src={matchProfiles[match.userId]?.avatar_url || undefined}
                        sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 700, fontSize: '0.9rem' }}
                      >
                        {(matchProfiles[match.userId]?.name || 'U').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                          {matchProfiles[match.userId]?.name || 'Praxis User'}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={compat}
                          sx={{
                            mt: 0.5, height: 3, borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.05)',
                            '& .MuiLinearProgress-bar': { bgcolor: pillColor },
                          }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: pillColor, flexShrink: 0 }}>
                        {compat}%
                      </Typography>
                    </Box>
                  );
                }) : (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <ExploreIcon sx={{ color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">Seeking optimal matches...</Typography>
                  </Box>
                )}
              </Stack>
            </GlassCard>
          </Box>
          </ErrorBoundary>

          {/* Best Examples — curated leaderboard */}
          <ErrorBoundary label="Leaderboard">
          <Box sx={{ mt: 4 }}>
            <GlassCard sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LeaderboardIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Best Examples</Typography>
                  </Box>
                  {Object.keys(allMatchScores).length > 0 && (
                    <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 600 }}>
                      ⚡ Ranked by compatibility × points
                    </Typography>
                  )}
                </Box>
                <Button size="small" variant="text" onClick={() => navigate('/leaderboard')} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                  Full List
                </Button>
              </Box>
              <Stack spacing={1}>
                {curatedLeaderboard.slice(0, 7).map((entry: any, idx: number) => {
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                  const isMe = entry.id === currentUserId;
                  return (
                    <Box
                      key={entry.id}
                      onClick={() => navigate(`/profile/${entry.id}`)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '12px',
                        cursor: 'pointer',
                        bgcolor: isMe ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                        border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.04)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      }}
                    >
                      <Typography sx={{ minWidth: 24, fontSize: medal ? '1rem' : '0.75rem', fontWeight: 800, color: 'text.disabled', textAlign: 'center' }}>
                        {medal ?? `#${idx + 1}`}
                      </Typography>
                      <Avatar
                        src={entry.avatar_url || undefined}
                        sx={{ width: 32, height: 32, border: isMe ? '2px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {(entry.name ?? 'Praxis User').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700 }} noWrap>{entry.name ?? 'Praxis User'}</Typography>
                          {entry.is_verified && <VerifiedIcon sx={{ fontSize: 11, color: '#3B82F6' }} />}
                          {isMe && <Chip label="you" size="small" sx={{ height: 14, fontSize: '0.55rem', bgcolor: 'rgba(245,158,11,0.12)', color: 'primary.main' }} />}
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                        {(entry.current_streak ?? 0) > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 12 }} />
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#F97316', fontSize: '0.65rem' }}>
                              {entry.current_streak}
                            </Typography>
                          </Box>
                        )}
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                          {entry.praxis_points ?? 0}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
                {curatedLeaderboard.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    Loading best examples...
                  </Typography>
                )}
              </Stack>
            </GlassCard>
          </Box>
          </ErrorBoundary>

          {/* Near You — shown only when location data available */}
          <ErrorBoundary label="Near You">
          {nearbyUsers.length > 0 && (
            <Box sx={{ mt: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <PlaceIcon sx={{ color: '#10B981' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Near You</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>People in your area</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {nearbyUsers.map((u: any) => (
                  <GlassCard
                    key={u.id}
                    sx={{
                      p: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                      cursor: 'pointer', borderRadius: '16px',
                      minWidth: 180, flex: '1 1 180px', maxWidth: 260,
                      '&:hover': { borderColor: '#10B981' },
                    }}
                    onClick={() => navigate(`/profile/${u.id}`)}
                  >
                    <Avatar src={u.avatar_url || undefined} sx={{ width: 40, height: 40, bgcolor: '#10B981' }}>
                      {(u.name || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{u.name || 'Praxis User'}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PlaceIcon sx={{ fontSize: 11, color: '#10B981' }} />
                        <Typography variant="caption" color="text.secondary">
                          {u.distanceKm < 1 ? '< 1 km' : `${u.distanceKm} km`}
                        </Typography>
                      </Box>
                    </Box>
                  </GlassCard>
                ))}
              </Box>
            </Box>
          )}
          </ErrorBoundary>
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
