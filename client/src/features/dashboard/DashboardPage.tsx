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
import SiteTour from '../../components/common/SiteTour';
import { DOMAIN_COLORS } from '../../types/goal';
import CheckInWidget from './components/CheckInWidget';
import BalanceWidget from './components/BalanceWidget';
import AccountabilityNetworkWidget from './components/AccountabilityNetworkWidget';
import GoalWidgets from './components/GoalWidgets';
import GettingStartedPage from '../onboarding/GettingStartedPage';
import ErrorBoundary from '../../components/common/ErrorBoundary';

import {
  Container,
  Box,
  Typography,
  Button,

  CircularProgress,
  Alert,
  Avatar,
  Chip,
  IconButton,
  Grid,
  LinearProgress,
  Collapse,
} from '@mui/material';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import PlaceIcon from '@mui/icons-material/Place';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

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

  // Active bets for GoalWidgets
  const [activeBets, setActiveBets] = useState<any[]>([]);

  // Weekly narrative (Pro only)
  const [weeklyNarrative, setWeeklyNarrative] = useState<string | null>(null);

  // Site tour state
  const [tourOpen, setTourOpen] = useState(false);

  // Weekly narrative collapsed by default
  const [narrativeExpanded, setNarrativeExpanded] = useState(false);

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
    const fetchBets = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await axios.get(`${API_URL}/bets/${currentUserId}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const all = Array.isArray(res.data) ? res.data : [];
        setActiveBets(all.filter((b: any) => b.status === 'active'));
      } catch {
        setActiveBets([]);
      }
    };
    fetchBets();
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

  // Gate: onboarding done but no goal tree yet → show focused 3-step guide
  if (user?.onboarding_completed && !hasGoals && currentUserId) {
    return <GettingStartedPage userId={currentUserId} />;
  }
  const userName = user?.name || 'Explorer';
  const avgProgress = hasGoals
    ? Math.round(rootGoals.reduce((sum, g) => sum + g.progress * 100, 0) / rootGoals.length)
    : 0;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 8 }}>
      <Container maxWidth="xl">

        {/* Welcome Banner — greet user first */}
        <Box sx={{ pt: 3, mb: 3 }}>
          <GlassCard
            sx={{
              p: 3,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(139,92,246,0.08) 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '20px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                  Hey,{' '}
                  <Box component="span" sx={{
                    background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)',
                    backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                    {userName}
                  </Box>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {hasGoals
                    ? `Tracking ${allNodes.length} goal${allNodes.length !== 1 ? 's' : ''} · ${avgProgress}% avg progress`
                    : 'Set up your goal tree to start matching with driven people.'}
                </Typography>
              </Box>
              {hasGoals && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, color: 'primary.main' }}>
                    {avgProgress}<Typography component="span" variant="h6" sx={{ fontWeight: 900, opacity: 0.5 }}>%</Typography>
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.05em' }}>
                    completion
                  </Typography>
                </Box>
              )}
            </Box>
          </GlassCard>
        </Box>

        {/* Check-in Widget */}
        {currentUserId && (
          <ErrorBoundary fallback={null}>
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
          </ErrorBoundary>
        )}

        {/* Goal Tracking Widgets — unified cards: progress + tracker + commitment */}
        {currentUserId && hasGoals && (
          <ErrorBoundary fallback={null}>
            <GoalWidgets
              userId={currentUserId}
              allNodes={allNodes}
              activeBets={activeBets}
              activeChallenges={challenges.filter((c: any) =>
                c.participants?.some((p: any) => p.user_id === currentUserId)
              )}
              onProgressUpdate={(nodeId, newProgress) => {
                setGoalTree(prev => {
                  if (!prev) return prev;
                  const updatedNodes = prev.nodes.map((n: any) =>
                    n.id === nodeId ? { ...n, progress: newProgress } : n
                  );
                  return { ...prev, nodes: updatedNodes };
                });
              }}
            />
          </ErrorBoundary>
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

        {/* Weekly Wins — 7-day snapshot of progress */}
        {hasGoals && (() => {
          const streak = localStreak ?? (user?.current_streak ?? 0);
          const pts = localPoints ?? (user?.praxis_points ?? 0);
          const completedGoals = allNodes.filter((n: any) => n.progress >= 1).length;
          const inProgressGoals = allNodes.filter((n: any) => n.progress > 0 && n.progress < 1).length;
          const weekStats = [
            { label: 'Day streak', value: streak, icon: '🔥', color: '#F59E0B' },
            { label: 'Praxis Points', value: pts, icon: '⚡', color: '#A78BFA' },
            { label: 'Completed', value: completedGoals, icon: '✅', color: '#10B981' },
            { label: 'In Progress', value: inProgressGoals, icon: '📈', color: '#3B82F6' },
          ];
          return (
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              {weekStats.map(stat => (
                <GlassCard key={stat.label} sx={{
                  p: 2.5, flex: '1 1 120px', minWidth: 110, textAlign: 'center',
                  border: `1px solid ${stat.color}22`,
                }}>
                  <Typography sx={{ fontSize: '1.5rem', lineHeight: 1, mb: 0.5 }}>{stat.icon}</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: stat.color, lineHeight: 1, mb: 0.25 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.01em' }}>
                    {stat.label}
                  </Typography>
                </GlassCard>
              ))}
            </Box>
          );
        })()}

        {/* Daily Axiom micro-message — free tier, deterministic (no API call) */}
        {(() => {
          const streak = localStreak ?? (user?.current_streak ?? 0);
          const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
          const pools = {
            elite: [
              `${streak} days. Most people quit before they even start. You didn't.`,
              `You've built something most people only talk about. Keep compounding.`,
              `The gap between you and where you started is bigger than you think.`,
            ],
            veteran: [
              `Two weeks in. This is where most people fall off. You haven't.`,
              `Consistency is a skill. You're getting very good at it.`,
              `Your streak is sending a message to your future self.`,
            ],
            active: [
              `Every day you show up is a vote for the person you're becoming.`,
              `Progress isn't always visible. But it's always real.`,
              `Small moves, compounded. That's the whole game.`,
            ],
            new: [
              `Day ${streak > 0 ? streak : 1}. The journey starts with one step.`,
              `Something that gets measured gets better. You're here. That counts.`,
              `Your goals are alive as long as you keep showing up.`,
            ],
          };
          const pool = streak >= 30 ? pools.elite : streak >= 14 ? pools.veteran : streak >= 3 ? pools.active : pools.new;
          const msg = pool[dayOfYear % pool.length];
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, px: 0.5 }}>
              <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)', fontSize: '0.7rem', flexShrink: 0 }}>⚡</Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', lineHeight: 1.4 }}>
                <Box component="span" sx={{ fontWeight: 700, color: 'rgba(245,158,11,0.8)', mr: 0.5 }}>Axiom:</Box>
                {msg}
              </Typography>
            </Box>
          );
        })()}

        {/* Weekly Narrative — Axiom's "this week" message (Pro only, collapsible) */}
        {weeklyNarrative && (
          <GlassCard sx={{
            mb: 3, borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.04) 100%)',
            border: '1px solid rgba(245,158,11,0.2)',
            overflow: 'hidden',
          }}>
            <Box
              onClick={() => setNarrativeExpanded(e => !e)}
              sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}
            >
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #F59E0B 0%, #8B5CF6 100%)',
                border: '2px solid rgba(245,158,11,0.4)',
                fontSize: '0.9rem', fontWeight: 900, color: '#0A0B14',
              }}>
                ⚡
              </Box>
              <Typography variant="caption" sx={{ color: 'rgba(245,158,11,0.8)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', flexGrow: 1 }}>
                Axiom's Take — This Week
              </Typography>
              {narrativeExpanded ? <ExpandLessIcon sx={{ color: 'text.disabled', fontSize: 18 }} /> : <ExpandMoreIcon sx={{ color: 'text.disabled', fontSize: 18 }} />}
            </Box>
            <Collapse in={narrativeExpanded}>
              <Box sx={{ px: 2.5, pb: 2.5 }}>
                <Typography variant="body2" sx={{ lineHeight: 1.8, color: 'text.primary', fontStyle: 'italic' }}>
                  {weeklyNarrative}
                </Typography>
              </Box>
            </Collapse>
          </GlassCard>
        )}

        {/* Balance Intervention — Axiom nudge when domain neglected for 14+ streak days */}
        <ErrorBoundary fallback={null}>
        <BalanceWidget
          nodes={allNodes}
          streak={localStreak ?? (user?.current_streak ?? 0)}
          onTakeZenDay={() => toast('Take a Zen Day: update a goal in a neglected domain today.', { icon: '🧘', duration: 6000 })}
        />
        </ErrorBoundary>


        {/* Accountability Network — friends + their check-in status */}
        {currentUserId && <AccountabilityNetworkWidget userId={currentUserId} />}

        {/* Community Challenges Section */}
        <Box sx={{ mt: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <EmojiEventsIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Community Challenges</Typography>
            <Button size="small" onClick={() => navigate('/challenges')} sx={{ ml: 'auto', fontSize: '0.75rem', color: 'text.secondary' }}>
              See all →
            </Button>
          </Box>
          <Grid container spacing={3}>
            {challenges.length > 0 ? challenges.slice(0, 2).map((challenge) => {
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
