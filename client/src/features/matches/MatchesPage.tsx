import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { Domain } from '../../models/Domain';
import toast from 'react-hot-toast';
import {
  Container,
  Box,
  Typography,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import MessageIcon from '@mui/icons-material/Message';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import LockIcon from '@mui/icons-material/Lock';
import GlassCard from '../../components/common/GlassCard';
import { mockMatches, MockMatch } from '../../data/mockMatches';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResult {
  userId: string;
  score: number; // 0–1
}

interface MatchProfile {
  userId: string;
  score: number; // 0–1
  name: string;
  avatarUrl?: string;
  domains: string[];
  bio?: string;
  isDemo?: boolean;
  sharedGoals?: string[];
  progressPace?: string;
}

// ─── Domain color mapping (mirrors types/goal.ts DOMAIN_COLORS) ───────────────

const DOMAIN_COLORS: Record<string, string> = {
  'Career':                              '#FF9F0A',
  'Investing / Financial Growth':        '#007AFF',
  'Investing':                           '#007AFF',
  'Fitness':                             '#FF3B30',
  'Academics':                           '#5856D6',
  'Mental Health':                       '#34C759',
  'Philosophical Development':           '#FF2D55',
  'Culture / Hobbies / Creative Pursuits':'#AF52DE',
  'Culture, Hobbies & Creative Pursuits':'#AF52DE',
  'Intimacy / Romantic Exploration':     '#636366',
  'Intimacy & Romantic Exploration':     '#636366',
  'Friendship / Social Engagement':      '#00C7BE',
  'Friendship & Social Engagement':      '#00C7BE',
};

function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? '#9CA3AF';
}

// ─── Compatibility ring (SVG circular progress) ───────────────────────────────

interface CompatibilityRingProps {
  score: number; // 0–100
}

const CompatibilityRing: React.FC<CompatibilityRingProps> = ({ score }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#6B7280';
  const glowColor = score >= 80 ? 'rgba(16,185,129,0.4)' : score >= 60 ? 'rgba(245,158,11,0.4)' : 'rgba(107,114,128,0.3)';

  return (
    <Box sx={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="72" height="72" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        {/* Progress arc */}
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
        />
      </svg>
      <Box sx={{ textAlign: 'center', zIndex: 1, lineHeight: 1 }}>
        <Typography sx={{ fontWeight: 700, color, fontSize: '1.05rem', lineHeight: 1 }}>
          {score}%
        </Typography>
        <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          match
        </Typography>
      </Box>
    </Box>
  );
};

// ─── Progress pace badge ──────────────────────────────────────────────────────

const PACE_COLORS: Record<string, string> = {
  Consistent: '#10B981',
  Rapid:      '#3B82F6',
  Learning:   '#8B5CF6',
  Adapting:   '#F59E0B',
};

const PaceBadge: React.FC<{ pace: string }> = ({ pace }) => (
  <Box sx={{
    display: 'inline-flex', alignItems: 'center', gap: 0.5,
    px: 1, py: 0.25, borderRadius: '20px',
    bgcolor: `${PACE_COLORS[pace] ?? '#6B7280'}22`,
    border: `1px solid ${PACE_COLORS[pace] ?? '#6B7280'}44`,
  }}>
    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PACE_COLORS[pace] ?? '#6B7280' }} />
    <Typography sx={{ fontSize: '0.7rem', color: PACE_COLORS[pace] ?? '#9CA3AF', fontWeight: 600 }}>
      {pace}
    </Typography>
  </Box>
);

// ─── Individual match card ────────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchProfile;
  currentUserId: string;
  onMessage: (match: MatchProfile) => void;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, currentUserId, onMessage }) => {
  const compatPct = Math.round(match.score * 100);
  const color = compatPct >= 80 ? '#10B981' : compatPct >= 60 ? '#F59E0B' : '#6B7280';
  const glowRgba = compatPct >= 80 ? 'rgba(16,185,129,0.12)' : compatPct >= 60 ? 'rgba(245,158,11,0.12)' : undefined;

  return (
    <GlassCard
      glowColor={glowRgba}
      sx={{
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'transform 0.2s ease',
        '&:hover': { transform: 'translateY(-4px)' },
      }}
    >
      {/* Demo badge */}
      {match.isDemo && (
        <Chip
          label="DEMO"
          size="small"
          sx={{
            position: 'absolute', top: 12, left: 12,
            fontSize: '0.6rem', height: 18, letterSpacing: 1,
            bgcolor: 'rgba(255,255,255,0.06)',
            color: 'text.disabled',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        />
      )}

      {/* Top row: avatar + name + ring */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, mt: match.isDemo ? 2 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, mr: 1 }}>
          <Avatar
            src={match.avatarUrl}
            sx={{
              width: 52, height: 52, flexShrink: 0,
              border: `2px solid ${color}`,
              boxShadow: `0 0 12px ${color}44`,
            }}
          >
            {match.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, mb: 0.5 }}>
              {match.name}
            </Typography>
            {match.progressPace && <PaceBadge pace={match.progressPace} />}
          </Box>
        </Box>
        <CompatibilityRing score={compatPct} />
      </Box>

      {/* Bio */}
      {match.bio && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6, fontSize: '0.82rem' }}>
          {match.bio}
        </Typography>
      )}

      {/* Aligned goals */}
      {match.sharedGoals && match.sharedGoals.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1.5, mb: 0.75, fontWeight: 600 }}>
            Aligned Goals
          </Typography>
          {match.sharedGoals.slice(0, 3).map((goal) => (
            <Box key={goal} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color, flexShrink: 0, mt: '6px' }} />
              <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.4, color: 'text.secondary' }}>
                {goal}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Domain chips */}
      {match.domains.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
          {match.domains.slice(0, 4).map((domain) => {
            const dc = domainColor(domain);
            return (
              <Chip
                key={domain}
                label={domain}
                size="small"
                sx={{
                  height: 22, fontSize: '0.68rem',
                  bgcolor: `${dc}18`,
                  color: dc,
                  border: `1px solid ${dc}40`,
                  '& .MuiChip-label': { px: 1.25 },
                }}
              />
            );
          })}
          {match.domains.length > 4 && (
            <Chip label={`+${match.domains.length - 4}`} size="small"
              sx={{ height: 22, fontSize: '0.68rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'text.disabled' }} />
          )}
        </Box>
      )}

      {/* Spacer pushes button to bottom */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Action button */}
      <Button
        variant="contained"
        fullWidth
        startIcon={<MessageIcon sx={{ fontSize: '1rem' }} />}
        onClick={() => onMessage(match)}
        sx={{
          mt: 1,
          background: `linear-gradient(135deg, ${color}CC, ${color}88)`,
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.85rem',
          borderRadius: '10px',
          boxShadow: `0 4px 16px ${color}44`,
          '&:hover': {
            background: `linear-gradient(135deg, ${color}, ${color}BB)`,
            boxShadow: `0 6px 20px ${color}66`,
          },
        }}
      >
        Message
      </Button>
    </GlassCard>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const MatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();

  const [realMatches, setRealMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [compatibilityFilter, setCompatibilityFilter] = useState<number>(0);
  const [selectedDomainsFilter, setSelectedDomainsFilter] = useState<string[]>([]);

  // Convert mock data to MatchProfile shape
  const demoProfiles: MatchProfile[] = mockMatches.map((m: MockMatch) => ({
    userId: m.id,
    score: m.compatibility / 100,
    name: m.name,
    avatarUrl: m.avatarUrl,
    domains: m.sharedDomains,
    bio: m.bio,
    sharedGoals: m.sharedGoals,
    progressPace: m.progressPace,
    isDemo: true,
  }));

  useEffect(() => {
    if (userLoading || !user) return;

    const fetchMatches = async () => {
      setLoading(true);
      setError(null);
      try {
        const matchRes = await axios.get(`${API_URL}/matches/${user.id}`);
        const rawMatches: MatchResult[] = matchRes.data ?? [];

        if (rawMatches.length === 0) {
          setRealMatches([]);
          return;
        }

        const profilePromises = rawMatches.map(async (m) => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, avatar_url, bio')
              .eq('id', m.userId)
              .single();

            let domains: string[] = [];
            try {
              const goalRes = await axios.get(`${API_URL}/goals/${m.userId}`);
              const nodes = goalRes.data?.nodes ?? [];
              domains = Array.from(new Set<string>(nodes.map((n: any) => n.domain).filter(Boolean)));
            } catch { /* non-fatal */ }

            return {
              userId: m.userId,
              score: m.score,
              name: profile?.name ?? `User ${m.userId.slice(0, 6)}`,
              avatarUrl: profile?.avatar_url ?? undefined,
              bio: profile?.bio ?? undefined,
              domains,
            } as MatchProfile;
          } catch {
            return {
              userId: m.userId,
              score: m.score,
              name: `User ${m.userId.slice(0, 6)}`,
              domains: [],
            } as MatchProfile;
          }
        });

        setRealMatches(await Promise.all(profilePromises));
      } catch {
        // Backend unreachable or user has no goal tree — show demo data only
        setRealMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [user, userLoading]);

  const handleMessage = (match: MatchProfile) => {
    toast.success(`Opening chat with ${match.name}!`);
    navigate(`/chat/${user!.id}/${match.userId}`);
  };

  // Decide which profiles to display: real matches take priority.
  // Show demo profiles as supplemental "example matches" when real is empty.
  const displayRealMatches = realMatches.filter((m) => {
    const pct = Math.round(m.score * 100);
    return pct >= compatibilityFilter &&
      (selectedDomainsFilter.length === 0 || selectedDomainsFilter.some(d => m.domains.includes(d)));
  });

  const displayDemoMatches = realMatches.length === 0
    ? demoProfiles.filter((m) => {
        const pct = Math.round(m.score * 100);
        return pct >= compatibilityFilter &&
          (selectedDomainsFilter.length === 0 || selectedDomainsFilter.some(d => m.domains.includes(d)));
      })
    : [];

  const allDisplayed = [...displayRealMatches, ...displayDemoMatches];
  const showingDemo = realMatches.length === 0;

  if (userLoading || loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress color="primary" size={48} />
        <Typography color="text.secondary">Finding your people…</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: '1.4rem' }} />
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
              Your Matches
            </Typography>
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: '0.95rem' }}>
            {showingDemo
              ? 'Example profiles — complete your goal tree to see real matches'
              : `${allDisplayed.length} people aligned with your goals`}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters(f => !f)}
          size="small"
          sx={{ borderRadius: '10px', borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
        >
          Filters {compatibilityFilter > 0 || selectedDomainsFilter.length > 0 ? '·' : ''}
        </Button>
      </Box>

      {/* ── Filters (collapsible) ───────────────────────────────────────── */}
      <Collapse in={showFilters}>
        <GlassCard sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="domain-filter-label">Filter by Domain</InputLabel>
                <Select
                  labelId="domain-filter-label"
                  multiple
                  value={selectedDomainsFilter}
                  label="Filter by Domain"
                  onChange={(e) => setSelectedDomainsFilter(e.target.value as string[])}
                  renderValue={(selected) => (selected as string[]).join(', ')}
                >
                  {Object.values(Domain).map((domain) => (
                    <MenuItem key={domain} value={domain}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: domainColor(domain) }} />
                        {domain}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Minimum compatibility: <strong style={{ color: '#F59E0B' }}>{compatibilityFilter}%</strong>
              </Typography>
              <Slider
                value={compatibilityFilter}
                onChange={(_, v) => setCompatibilityFilter(v as number)}
                valueLabelDisplay="auto"
                min={0} max={100} step={5}
                sx={{ color: 'primary.main' }}
              />
            </Grid>
            {(compatibilityFilter > 0 || selectedDomainsFilter.length > 0) && (
              <Grid size={{ xs: 12 }}>
                <Button size="small" onClick={() => { setCompatibilityFilter(0); setSelectedDomainsFilter([]); }}>
                  Clear filters
                </Button>
              </Grid>
            )}
          </Grid>
        </GlassCard>
      </Collapse>

      {/* ── Demo mode banner ────────────────────────────────────────────── */}
      {showingDemo && (
        <Alert
          severity="info"
          icon={<TrendingUpIcon />}
          sx={{ mb: 4, bgcolor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px', color: 'text.secondary' }}
        >
          <strong style={{ color: '#fff' }}>These are example matches.</strong> Once you build your goal tree, our algorithm will find real people aligned with your specific goals and progress pace.
        </Alert>
      )}

      {/* ── Premium teaser (shown when not premium) ─────────────────────── */}
      {!user?.is_premium && (
        <GlassCard
          glowColor="rgba(139,92,246,0.12)"
          sx={{
            p: 3, mb: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 2,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(245,158,11,0.05))',
            border: '1px solid rgba(139,92,246,0.25)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ p: 1, borderRadius: '12px', bgcolor: 'rgba(139,92,246,0.15)', display: 'flex' }}>
              <WorkspacePremiumIcon sx={{ color: '#8B5CF6', fontSize: '1.4rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Unlock Advanced Matching
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 0.5 }}>
                {['Semantic AI matching', 'Chat priority', 'Unlimited filters', 'Mutual grading insights'].map(f => (
                  <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LockIcon sx={{ fontSize: '0.65rem', color: '#8B5CF6' }} />
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{f}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/upgrade')}
            sx={{
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem',
              boxShadow: '0 4px 16px rgba(139,92,246,0.4)',
              whiteSpace: 'nowrap',
              '&:hover': { background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
            }}
          >
            Upgrade to Premium
          </Button>
        </GlassCard>
      )}

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>
      )}

      {/* ── Match cards ─────────────────────────────────────────────────── */}
      {allDisplayed.length > 0 ? (
        <Grid container spacing={3}>
          {allDisplayed.map((match) => (
            <Grid key={match.userId} size={{ xs: 12, sm: 6, md: 4 }}>
              <MatchCard match={match} currentUserId={user!.id} onMessage={handleMessage} />
            </Grid>
          ))}
        </Grid>
      ) : (
        /* ── Empty state ─────────────────────────────────────────────── */
        <GlassCard sx={{ p: 8, textAlign: 'center' }}>
          <AutoAwesomeIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2, opacity: 0.7 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            No matches yet — keep building your goals!
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            The more detail you add to your goal tree, the more precisely our algorithm can find people aligned with where you're going.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/goals')}
            sx={{ borderRadius: '10px', px: 4 }}
          >
            Build my goal tree
          </Button>
        </GlassCard>
      )}

    </Container>
  );
};

export default MatchesPage;
