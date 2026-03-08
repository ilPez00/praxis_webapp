import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { GoalTree } from '../../models/GoalTree';
import GlassCard from '../../components/common/GlassCard';
import PostFeed from '../posts/PostFeed';
import SiteTour from '../../components/common/SiteTour';
import GoalWidgets from './components/GoalWidgets';
import GettingStartedPage from '../onboarding/GettingStartedPage';
import ErrorBoundary from '../../components/common/ErrorBoundary';

import {
  Container,
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';

// ── StatusBar — single card: greeting + streak + points + axiom + check-in ──

interface StatusBarProps {
  userName: string;
  streak: number;
  points: number;
  avgProgress: number;
  hasGoals: boolean;
  userId: string;
  lastActivityDate?: string;
  onCheckIn: (newStreak: number, newPoints: number) => void;
}

function getStreakTier(streak: number) {
  if (streak >= 30) return { label: 'Elite', color: '#EF4444' };
  if (streak >= 14) return { label: 'Veteran', color: '#8B5CF6' };
  if (streak >= 7)  return { label: 'Disciplined', color: '#3B82F6' };
  if (streak >= 3)  return { label: 'Consistent', color: '#10B981' };
  return { label: 'Newcomer', color: '#6B7280' };
}

function getAxiomQuote(streak: number): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const pools = {
    elite: [
      `${streak} days. Most people quit before they even start. You didn't.`,
      "You've built something most people only talk about. Keep compounding.",
      "The gap between you and where you started is bigger than you think.",
    ],
    veteran: [
      "Two weeks in. This is where most people fall off. You haven't.",
      "Consistency is a skill. You're getting very good at it.",
      "Your streak is sending a message to your future self.",
    ],
    active: [
      "Every day you show up is a vote for the person you're becoming.",
      "Progress isn't always visible. But it's always real.",
      "Small moves, compounded. That's the whole game.",
    ],
    new: [
      `Day ${streak > 0 ? streak : 1}. The journey starts here.`,
      "What gets measured gets better. You're here. That counts.",
      "Your goals are alive as long as you keep showing up.",
    ],
  };
  const pool =
    streak >= 30 ? pools.elite :
    streak >= 14 ? pools.veteran :
    streak >= 3  ? pools.active :
    pools.new;
  return pool[dayOfYear % pool.length];
}

const StatusBar: React.FC<StatusBarProps> = ({
  userName, streak, points, avgProgress, hasGoals, userId, lastActivityDate, onCheckIn,
}) => {
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await axios.get(`${API_URL}/checkins/today`, {
          params: { userId },
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        setCheckedIn(res.data.checkedIn);
      } catch { /* silently ignore */ }
      finally { setCheckingStatus(false); }
    })();
  }, [userId]);

  const handleCheckIn = async () => {
    if (loading || checkedIn) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await axios.post(`${API_URL}/checkins`, { userId }, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const { alreadyCheckedIn, streak: newStreak, totalPoints, shieldConsumed } = res.data;
      setCheckedIn(true);
      if (!alreadyCheckedIn) {
        onCheckIn(newStreak, totalPoints);
        const MILESTONES: Record<number, string> = {
          7:   "One week straight! Real discipline. 🏆",
          30:  "One month! Top 5% of all users. 🔥",
          100: "ONE HUNDRED DAYS. Legendary. ⚡",
          365: "One full year. Unstoppable. 🌟",
        };
        if (MILESTONES[newStreak]) {
          setTimeout(() => toast.success(MILESTONES[newStreak], { duration: 6000, icon: '🎉' }), 600);
        }
        if (shieldConsumed) toast.success(`Streak shield used! ${newStreak}d 🛡️`);
        else toast.success(`+10⚡  Streak: ${newStreak} days 🔥`);
      } else {
        toast('Already checked in today! ✅');
      }
    } catch { toast.error('Check-in failed. Try again.'); }
    finally { setLoading(false); }
  };

  const tier = getStreakTier(streak);
  const quote = getAxiomQuote(streak);

  const atRisk = (() => {
    if (!lastActivityDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const last = new Date(lastActivityDate); last.setHours(0, 0, 0, 0);
    return Math.round((today.getTime() - last.getTime()) / 86400000) === 1
      && new Date().getHours() >= 20;
  })();

  return (
    <GlassCard sx={{
      p: { xs: 2, sm: 2.5 }, mb: 3, borderRadius: '20px',
      background: 'linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(139,92,246,0.04) 100%)',
      border: checkedIn
        ? '1px solid rgba(16,185,129,0.2)'
        : atRisk
        ? '1px solid rgba(245,158,11,0.4)'
        : '1px solid rgba(255,255,255,0.07)',
      transition: 'border-color 0.3s ease',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 2, flexWrap: 'wrap',
      }}>

        {/* Left: greeting + axiom quote */}
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Hey,{' '}
              <Box component="span" sx={{
                background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)',
                backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                {userName}
              </Box>
            </Typography>
            {hasGoals && avgProgress > 0 && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>
                {avgProgress}% avg progress
              </Typography>
            )}
          </Box>
          <Typography variant="caption" sx={{
            color: 'text.secondary', fontStyle: 'italic', lineHeight: 1.5, fontSize: '0.78rem', display: 'block',
          }}>
            <Box component="span" sx={{ color: '#F59E0B', fontWeight: 700, fontStyle: 'normal', mr: 0.5 }}>⚡</Box>
            {quote}
          </Typography>
        </Box>

        {/* Right: stats + check-in */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {/* Streak */}
          {streak > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalFireDepartmentIcon sx={{
                color: '#F97316', fontSize: 20,
                filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.5))',
              }} />
              <Typography sx={{ fontWeight: 900, color: '#F97316', fontSize: '1rem', lineHeight: 1 }}>
                {streak}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>d</Typography>
            </Box>
          )}

          {/* Tier chip */}
          {streak >= 3 && (
            <Chip
              label={tier.label}
              size="small"
              sx={{
                height: 20, fontSize: '0.62rem', fontWeight: 700,
                bgcolor: `${tier.color}15`, color: tier.color, border: `1px solid ${tier.color}33`,
              }}
            />
          )}

          {/* Points */}
          {points > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <ElectricBoltIcon sx={{ color: '#A78BFA', fontSize: 13 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#A78BFA' }}>
                {points.toLocaleString()} PP
              </Typography>
            </Box>
          )}

          {/* At-risk warning */}
          {atRisk && !checkedIn && (
            <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.7rem' }}>
              ⚠️ Streak at risk
            </Typography>
          )}

          {/* Check-in button */}
          {!checkingStatus && (
            checkedIn ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                disabled
                sx={{
                  borderRadius: '10px', fontWeight: 700, fontSize: '0.72rem',
                  borderColor: '#10B98155', color: '#10B981',
                  '&.Mui-disabled': { borderColor: '#10B98140', color: '#10B98188' },
                }}
              >
                Done
              </Button>
            ) : (
              <Button
                size="small"
                variant="contained"
                onClick={handleCheckIn}
                disabled={loading}
                sx={{
                  borderRadius: '10px', fontWeight: 800, fontSize: '0.75rem', px: 2,
                  background: 'linear-gradient(135deg, #F97316, #F59E0B)',
                  color: '#0A0B14',
                  boxShadow: '0 4px 16px rgba(249,115,22,0.35)',
                  '&:hover': { boxShadow: '0 6px 20px rgba(249,115,22,0.5)', transform: 'translateY(-1px)' },
                  '&:active': { transform: 'none' },
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? '…' : 'Check in 🔥'}
              </Button>
            )
          )}
        </Box>
      </Box>
    </GlassCard>
  );
};

// ── DashboardPage ─────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();

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

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 8 }}>
      <Container maxWidth="xl">

        {/* ── Goal widgets ── */}
        {currentUserId && hasGoals && (
          <Box sx={{ pt: 3 }}>
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
          </Box>
        )}

        {/* ── Status bar ── */}
        {currentUserId && (
          <StatusBar
            userName={userName}
            streak={localStreak ?? (user?.current_streak ?? 0)}
            points={localPoints ?? (user?.praxis_points ?? 0)}
            avgProgress={avgProgress}
            hasGoals={hasGoals}
            userId={currentUserId}
            lastActivityDate={user?.last_activity_date}
            onCheckIn={(s, p) => { setLocalStreak(s); setLocalPoints(p); }}
          />
        )}

        {/* ── Feed ── */}
        <Box>
          <Typography variant="overline" color="text.disabled" sx={{ letterSpacing: '0.1em', fontSize: '0.65rem' }}>
            Your Feed
          </Typography>
          <PostFeed context="general" feedUserId={currentUserId} personalized />
        </Box>

      </Container>

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
