import React, { useState, useEffect, useMemo } from 'react';
import { API_URL } from '../../lib/api';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { GoalTree } from '../../models/GoalTree';
import { Domain } from '../../models/Domain';
import GlassCard from '../../components/common/GlassCard';
import PostFeed from '../posts/PostFeed';
import TrackerWidget from '../trackers/TrackerWidget';
import SiteTour from '../../components/common/SiteTour';
import { DOMAIN_COLORS } from '../../types/goal';
import CheckInWidget from './components/CheckInWidget';
import BalanceWidget from './components/BalanceWidget';

import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Avatar,
  Chip,
  IconButton,
  Grid,
} from '@mui/material';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExploreIcon from '@mui/icons-material/Explore';
import ChatIcon from '@mui/icons-material/Chat';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import BarChartIcon from '@mui/icons-material/BarChart';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import VerifiedIcon from '@mui/icons-material/Verified';
import PlaceIcon from '@mui/icons-material/Place';

interface MatchResult {
  userId: string;
  score: number;
}

interface MatchProfile {
  name: string;
  avatar_url: string | null;
}

const DashboardPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [localStreak, setLocalStreak] = useState<number | null>(null);
  const [localPoints, setLocalPoints] = useState<number | null>(null);
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchProfiles, setMatchProfiles] = useState<Record<string, MatchProfile>>({});
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Community challenges state
  const [challenges, setChallenges] = useState<any[]>([]);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [allMatchScores, setAllMatchScores] = useState<Record<string, number>>({});

  // Nearby users state
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);

  // Site tour state
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setCurrentUserId(authUser?.id);
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const res = await axios.get(`${API_URL}/challenges`);
        setChallenges(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setChallenges([]);
      }
    };
    fetchChallenges();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get(`${API_URL}/users/leaderboard`, {
          params: { userId: currentUserId },
        });
        setLeaderboard(Array.isArray(res.data) ? res.data : []);
      } catch {
        setLeaderboard([]);
      }
    };
    fetchLeaderboard();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const fetchNearby = async () => {
      try {
        const res = await axios.get(`${API_URL}/users/nearby`, {
          params: { userId: currentUserId, radiusKm: 200 },
        });
        setNearbyUsers(Array.isArray(res.data) ? res.data.slice(0, 6) : []);
      } catch {
        setNearbyUsers([]);
      }
    };
    fetchNearby();
  }, [currentUserId]);

  useEffect(() => {
    if (!user?.id) return;
    if (!localStorage.getItem(`praxis_tour_seen_${user.id}`)) {
      setTourOpen(true);
    }
  }, [user?.id]);

  const handleTourClose = () => {
    setTourOpen(false);
    if (user?.id) localStorage.setItem(`praxis_tour_seen_${user.id}`, '1');
  };

  // Curated leaderboard: rank by praxis_points weighted by compatibility score
  // ranked_score = points * (1 + compatibilityScore), fallback to raw points for non-matches
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
      await axios.post(`${API_URL}/challenges/${challengeId}/join`, { userId: currentUserId });
      toast.success('Joined challenge!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to join challenge.');
    }
  };

  useEffect(() => {
    if (!currentUserId) return;
    const fetchData = async () => {
      setLoadingContent(true);
      try {
        const [goalsRes, matchesRes] = await Promise.allSettled([
          axios.get(`${API_URL}/goals/${currentUserId}`),
          axios.get(`${API_URL}/matches/${currentUserId}`),
        ]);
        if (goalsRes.status === 'fulfilled') setGoalTree(goalsRes.value.data);
        if (matchesRes.status === 'fulfilled' && Array.isArray(matchesRes.value?.data)) {
          const allMatchData: MatchResult[] = matchesRes.value.data;
          const top3: MatchResult[] = allMatchData.slice(0, 3);
          setMatches(top3);
          // Store all match scores for curated leaderboard ranking
          const scoreMap: Record<string, number> = {};
          allMatchData.forEach(m => { scoreMap[m.userId] = m.score; });
          setAllMatchScores(scoreMap);
          // Batch fetch all match profiles in a single query
          const matchIds = top3.map((m) => m.userId);
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, name, avatar_url')
            .in('id', matchIds);
          const profileMap: Record<string, MatchProfile> = {};
          for (const p of profileRows || []) {
            profileMap[p.id] = { name: p.name, avatar_url: p.avatar_url };
          }
          setMatchProfiles(profileMap);
        }
      } catch (err: any) {
        console.error('[Dashboard] fetchData threw:', err);
        setError(`Dashboard error: ${err?.message || String(err)}`);
      } finally {
        setLoadingContent(false);
      }
    };
    fetchData();
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
  const allNodes = Array.isArray(goalTree?.nodes) ? goalTree!.nodes : [];
  const hasGoals = rootGoals.length > 0;
  const userName = user?.name || 'Explorer';
  const avgProgress = hasGoals
    ? Math.round(rootGoals.reduce((sum, g) => sum + g.progress * 100, 0) / rootGoals.length)
    : 0;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 8 }}>
      <Container maxWidth="xl">
        {/* Check-in Widget */}
        {currentUserId && (
          <Box sx={{ pt: 3 }}>
            <CheckInWidget
              userId={currentUserId}
              currentStreak={localStreak ?? (user?.current_streak ?? 0)}
              lastActivityDate={user?.last_activity_date}
              praxisPoints={localPoints ?? (user?.praxis_points ?? 0)}
              onCheckIn={(newStreak, newPoints) => {
                setLocalStreak(newStreak);
                setLocalPoints(newPoints);
              }}
            />
          </Box>
        )}

        {/* Balance Intervention — Master Roshi nudge when domain neglected for 14+ streak days */}
        <BalanceWidget
          nodes={allNodes}
          streak={localStreak ?? (user?.current_streak ?? 0)}
          onTakeZenDay={() => toast('Take a Zen Day: update a goal in a neglected domain today.', { icon: '🧘', duration: 6000 })}
        />

        {/* Welcome Banner */}
        <Box sx={{ py: 4 }}>
          <GlassCard
            sx={{
              p: 4,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(139,92,246,0.1) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
            }}
          >
            <Grid container alignItems="center" spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Typography variant="h3" sx={{ fontWeight: 900, mb: 1.5, letterSpacing: '-0.03em' }}>
                  Hey,{' '}
                  <Box component="span" sx={{
                    background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)',
                    backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                    {userName}
                  </Box>
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mb: 3 }}>
                  {hasGoals
                    ? `You're tracking ${allNodes.length} goal${allNodes.length !== 1 ? 's' : ''} at ${avgProgress}% average progress. Keep the momentum going.`
                    : 'Set up your goal tree to start matching with driven people who share your ambitions.'}
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Chip
                    icon={<TrackChangesIcon sx={{ color: 'primary.main !important' }} />}
                    label={`${allNodes.length} Goals`}
                    sx={{ bgcolor: 'rgba(245,158,11,0.1)', fontWeight: 700, p: 1 }}
                  />
                  <Chip
                    icon={<TrendingUpIcon sx={{ color: 'secondary.main !important' }} />}
                    label={`${avgProgress}% Avg Progress`}
                    sx={{ bgcolor: 'rgba(139,92,246,0.1)', fontWeight: 700, p: 1 }}
                  />
                  {(user as any)?.current_streak > 0 && (
                    <Chip
                      icon={<LocalFireDepartmentIcon sx={{ color: '#F97316 !important' }} />}
                      label={`${(user as any).current_streak} day streak`}
                      sx={{ bgcolor: 'rgba(249,115,22,0.1)', color: '#F97316', fontWeight: 700, p: 1 }}
                    />
                  )}
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', justifyContent: { md: 'flex-end', xs: 'flex-start' } }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h2" sx={{ fontWeight: 900, lineHeight: 1, color: 'primary.main' }}>
                    {avgProgress}<Typography component="span" variant="h5" sx={{ fontWeight: 900, opacity: 0.6 }}>%</Typography>
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary' }}>
                    OVERALL COMPLETION
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </GlassCard>
        </Box>

        {/* Quick Actions Pill Row */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
          <GlassCard 
            sx={{ 
              p: 1, 
              borderRadius: '50px', 
              display: 'flex', 
              gap: 1, 
              background: 'rgba(17,24,39,0.8)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {[
              { label: 'Goal Tree', to: `/goals/${currentUserId}`, icon: <TrackChangesIcon /> },
              { label: 'Matches', to: '/matches', icon: <ExploreIcon /> },
              { label: 'Chat', to: '/communication', icon: <ChatIcon /> },
              { label: 'Analytics', to: '/analytics', icon: <BarChartIcon /> },
            ].map((action) => (
              <Button
                key={action.label}
                component={RouterLink}
                to={action.to}
                variant="text"
                sx={{
                  borderRadius: '40px',
                  px: 3,
                  py: 1,
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'primary.main',
                  }
                }}
                startIcon={action.icon}
              >
                {action.label}
              </Button>
            ))}
          </GlassCard>
        </Box>

        {/* Bento Grid */}
        <Grid container spacing={3}>

          {/* 1 — Trackers (full width) */}
          {currentUserId && (
            <Grid size={{ xs: 12 }}>
              <TrackerWidget userId={currentUserId} />
            </Grid>
          )}

          {/* 2 — Top Alignments */}
          <Grid size={{ xs: 12, md: 5 }}>
            <GlassCard sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Top Alignments</Typography>
                <Button component={RouterLink} to="/matches" size="small" variant="text" color="primary">View All</Button>
              </Box>
              
              <Stack spacing={2}>
                {matches.length > 0 ? (
                  matches.map((match) => {
                    const compatibility = Math.round(match.score * 100);
                    const pillColor = compatibility > 70 ? '#10B981' : compatibility > 50 ? '#F59E0B' : '#9CA3AF';
                    
                    return (
                      <Box 
                        key={match.userId}
                        onClick={() => navigate(`/chat/${currentUserId}/${match.userId}`)}
                        sx={{ 
                          p: 2, 
                          borderRadius: '16px', 
                          cursor: 'pointer',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 2,
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.04)',
                            borderColor: 'primary.main',
                          }
                        }}
                      >
                        <Avatar
                          src={matchProfiles[match.userId]?.avatar_url || undefined}
                          sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontWeight: 700 }}
                        >
                          {(matchProfiles[match.userId]?.name || match.userId).charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            {matchProfiles[match.userId]?.name || 'Praxis User'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Goal-aligned</Typography>
                        </Box>
                        <Box sx={{ 
                          px: 1.5, 
                          py: 0.5, 
                          borderRadius: '20px', 
                          bgcolor: `${pillColor}15`, 
                          color: pillColor,
                          border: `1px solid ${pillColor}40`,
                          fontSize: '0.75rem',
                          fontWeight: 800
                        }}>
                          {compatibility}% Match
                        </Box>
                      </Box>
                    );
                  })
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    Seeking optimal matches...
                  </Typography>
                )}
              </Stack>
            </GlassCard>
          </Grid>

          {/* 3 — Best Examples */}
          <Grid size={{ xs: 12, md: 7 }}>
            <GlassCard sx={{ p: 4, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <LeaderboardIcon sx={{ color: 'primary.main' }} />
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>Best Examples</Typography>
                    {Object.keys(allMatchScores).length > 0 && (
                      <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 600 }}>
                        ⚡ Ranked by compatibility × points
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Button
                  component={RouterLink}
                  to="/leaderboard"
                  size="small"
                  variant="text"
                  color="primary"
                >
                  Full Leaderboard
                </Button>
              </Box>
              <Stack spacing={1.5}>
                {curatedLeaderboard.length > 0 ? curatedLeaderboard.map((entry: any, idx: number) => {
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                  const isMe = entry.id === currentUserId;
                  return (
                    <Box
                      key={entry.id}
                      onClick={() => navigate(`/profile/${entry.id}`)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: '14px',
                        cursor: 'pointer',
                        bgcolor: isMe ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                        border: isMe ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.04)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      }}
                    >
                      <Typography sx={{ minWidth: 28, fontSize: medal ? '1.2rem' : '0.85rem', fontWeight: 800, color: 'text.disabled', textAlign: 'center' }}>
                        {medal ?? `#${idx + 1}`}
                      </Typography>
                      <Avatar
                        src={entry.avatar_url || undefined}
                        sx={{ width: 36, height: 36, border: isMe ? '2px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {(entry.name ?? 'U').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {entry.name ?? 'Praxis User'}
                          </Typography>
                          {entry.is_verified && (
                            <VerifiedIcon sx={{ fontSize: 13, color: '#3B82F6' }} />
                          )}
                          {isMe && (
                            <Chip label="you" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(245,158,11,0.12)', color: 'primary.main' }} />
                          )}
                        </Box>
                        {entry.domains?.length > 0 && (
                          <Typography variant="caption" color="text.disabled" noWrap>
                            {entry.domains.slice(0, 2).join(' · ')}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
                        {(entry.current_streak ?? 0) > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 13 }} />
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#F97316', fontSize: '0.7rem' }}>
                              {entry.current_streak}
                            </Typography>
                          </Box>
                        )}
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                            {entry.praxis_points ?? 0}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
                            pts
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  );
                }) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    Loading best examples...
                  </Typography>
                )}
              </Stack>
            </GlassCard>
          </Grid>

        </Grid>

        {/* Community Challenges Section */}
        <Box sx={{ mt: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <EmojiEventsIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Community Challenges</Typography>
          </Box>
          <Grid container spacing={3}>
            {challenges.length > 0 ? challenges.map((challenge) => {
              const participantCount = challenge.challenge_participants?.[0]?.count ?? 0;
              const domainColor = DOMAIN_COLORS[challenge.domain as Domain] ?? '#9CA3AF';
              return (
                <Grid key={challenge.id} size={{ xs: 12, md: 4 }}>
                  <GlassCard sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h2" sx={{ lineHeight: 1 }}>🏆</Typography>
                      <Chip
                        label={challenge.domain}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: '0.6rem',
                          bgcolor: `${domainColor}15`,
                          color: domainColor,
                        }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>{challenge.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{challenge.description}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mt: 'auto' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <GroupsIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary">{participantCount} joined</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">{challenge.duration_days}d duration</Typography>
                      </Box>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleJoinChallenge(challenge.id)}
                      sx={{ borderRadius: '10px', fontWeight: 600 }}
                    >
                      Join Challenge
                    </Button>
                  </GlassCard>
                </Grid>
              );
            }) : (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No challenges available yet. Check back soon!
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>

        {/* Nearby Users */}
        {nearbyUsers.length > 0 && (
          <Box sx={{ mt: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <PlaceIcon sx={{ color: '#10B981' }} />
              <Typography variant="h5" sx={{ fontWeight: 800 }}>Near You</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                People in your area
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {nearbyUsers.map((u: any) => (
                <GlassCard
                  key={u.id}
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: 'pointer',
                    borderRadius: '16px',
                    minWidth: 200,
                    flex: '1 1 200px',
                    maxWidth: 280,
                    '&:hover': { borderColor: '#10B981' },
                  }}
                  onClick={() => navigate(`/profile/${u.id}`)}
                >
                  <Avatar src={u.avatar_url || undefined} sx={{ width: 44, height: 44, bgcolor: '#10B981' }}>
                    {(u.name || 'U').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{u.name || 'Praxis User'}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PlaceIcon sx={{ fontSize: 12, color: '#10B981' }} />
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

        {/* Personalized Feed */}
        <Box sx={{ mt: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.1em' }}>
              Your Feed
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
              · ranked by goals · proximity · honor
            </Typography>
          </Box>
          <PostFeed context="general" feedUserId={currentUserId} personalized />
        </Box>
      </Container>

      <SiteTour open={tourOpen} onClose={handleTourClose} />
    </Box>
  );
};

export default DashboardPage;
