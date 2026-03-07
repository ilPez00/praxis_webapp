import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
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
  LinearProgress,
} from '@mui/material';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import PlaceIcon from '@mui/icons-material/Place';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

const DashboardPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [localStreak, setLocalStreak] = useState<number | null>(null);
  const [localPoints, setLocalPoints] = useState<number | null>(null);
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Community challenges state
  const [challenges, setChallenges] = useState<any[]>([]);

  // Nearby users state
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);

  // Weekly narrative (Pro only)
  const [weeklyNarrative, setWeeklyNarrative] = useState<string | null>(null);

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

  // Fetch weekly narrative for Pro users (fire-and-forget, non-blocking)
  useEffect(() => {
    if (!user?.is_premium && !user?.is_admin) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        const res = await axios.get(`${API_URL}/ai-coaching/weekly-narrative`, { headers });
        if (res.data?.narrative) setWeeklyNarrative(res.data.narrative);
      } catch {
        // silently ignore — narrative is a nice-to-have
      }
    })();
  }, [user?.id, user?.is_premium, user?.is_admin]);

  const handleTourClose = () => {
    setTourOpen(false);
    if (user?.id) localStorage.setItem(`praxis_tour_seen_${user.id}`, '1');
  };

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
        const [goalsRes] = await Promise.allSettled([
          axios.get(`${API_URL}/goals/${currentUserId}`),
        ]);
        if (goalsRes.status === 'fulfilled') setGoalTree(goalsRes.value.data);
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

        {/* Profile Completion Widget — shown only when score < 100% */}
        {(() => {
          const items = [
            { label: 'Add a profile photo', done: !!user?.avatarUrl, link: `/profile`, points: 20 },
            { label: 'Write your bio', done: !!(user?.bio && user.bio.trim().length > 10), link: `/profile`, points: 20 },
            { label: 'Add your occupation', done: !!user?.occupation, link: `/profile`, points: 15 },
            { label: 'Set up your goal tree', done: hasGoals, link: '/goal-selection', points: 30 },
            { label: 'Complete your first check-in', done: (user?.current_streak ?? 0) > 0, link: '/dashboard', points: 15 },
          ];
          const score = items.reduce((sum, i) => sum + (i.done ? i.points : 0), 0);
          if (score >= 100) return null;
          const nextItem = items.find(i => !i.done);
          return (
            <GlassCard sx={{ p: 2.5, mb: 3, border: '1px solid rgba(245,158,11,0.2)', borderRadius: '16px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                  Profile Strength — {score}%
                </Typography>
                {nextItem && (
                  <Button size="small" variant="outlined" onClick={() => navigate(nextItem.link)}
                    sx={{ fontSize: '0.72rem', py: 0.25, px: 1.5, borderRadius: '8px', borderColor: 'rgba(245,158,11,0.4)', color: 'primary.main' }}>
                    {nextItem.label}
                  </Button>
                )}
              </Box>
              <LinearProgress variant="determinate" value={score} sx={{
                height: 6, borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.06)',
                '& .MuiLinearProgress-bar': { borderRadius: 3, background: 'linear-gradient(90deg, #F59E0B, #8B5CF6)' },
                mb: 1.5,
              }} />
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {items.map(item => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {item.done
                      ? <CheckCircleIcon sx={{ fontSize: 14, color: '#10B981' }} />
                      : <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />}
                    <Typography variant="caption" sx={{ color: item.done ? '#10B981' : 'text.disabled', fontWeight: item.done ? 600 : 400 }}>
                      {item.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </GlassCard>
          );
        })()}

        {/* Weekly Narrative — Master Roshi's "this week" message (Pro only) */}
        {weeklyNarrative && (
          <GlassCard sx={{
            p: 3,
            mb: 3,
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.04) 100%)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
                border: '2px solid rgba(245,158,11,0.4)',
                fontSize: '1.1rem',
              }}>
                🥋
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption" sx={{ color: 'rgba(245,158,11,0.7)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                  Roshi's Take — This Week
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.8, color: 'text.primary', fontStyle: 'italic' }}>
                  {weeklyNarrative}
                </Typography>
              </Box>
            </Box>
          </GlassCard>
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

        {/* Trackers */}
        {currentUserId && (
          <Box sx={{ mb: 4 }}>
            <TrackerWidget userId={currentUserId} />
          </Box>
        )}

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
