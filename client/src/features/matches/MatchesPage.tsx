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
  LinearProgress,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import MessageIcon from '@mui/icons-material/Message';
import PersonIcon from '@mui/icons-material/Person';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
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
  overallProgress?: number; // 0–100
}

// ─── Domain color mapping ─────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  'Career':                               '#FF9F0A',
  'Investing / Financial Growth':         '#007AFF',
  'Investing':                            '#007AFF',
  'Fitness':                              '#FF3B30',
  'Academics':                            '#5856D6',
  'Mental Health':                        '#34C759',
  'Philosophical Development':            '#FF2D55',
  'Culture / Hobbies / Creative Pursuits':'#AF52DE',
  'Culture, Hobbies & Creative Pursuits': '#AF52DE',
  'Intimacy / Romantic Exploration':      '#636366',
  'Intimacy & Romantic Exploration':      '#636366',
  'Friendship / Social Engagement':       '#00C7BE',
  'Friendship & Social Engagement':       '#00C7BE',
};

function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? '#9CA3AF';
}

// ─── Compatibility ring (SVG circular arc) ────────────────────────────────────

const CompatibilityRing: React.FC<{ score: number }> = ({ score }) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#6B7280';
  const glow  = score >= 80 ? 'rgba(16,185,129,0.5)' : score >= 60 ? 'rgba(245,158,11,0.5)' : 'rgba(107,114,128,0.3)';

  return (
    <Box sx={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="72" height="72" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        <circle
          cx="36" cy="36" r={radius}
          fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${glow})` }}
        />
      </svg>
      <Box sx={{ textAlign: 'center', zIndex: 1, lineHeight: 1 }}>
        <Typography sx={{ fontWeight: 800, color, fontSize: '1rem', lineHeight: 1 }}>{score}%</Typography>
        <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', letterSpacing: 0.5, textTransform: 'uppercase' }}>match</Typography>
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
    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: PACE_COLORS[pace] ?? '#6B7280' }} />
    <Typography sx={{ fontSize: '0.68rem', color: PACE_COLORS[pace] ?? '#9CA3AF', fontWeight: 600 }}>
      {pace}
    </Typography>
  </Box>
);

// ─── Single match card ────────────────────────────────────────────────────────

interface MatchCardProps {
  match: MatchProfile;
  onMessage: (match: MatchProfile) => void;
  onViewProfile: (match: MatchProfile) => void;
  onCollaborate: (match: MatchProfile) => void;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onMessage, onViewProfile, onCollaborate }) => {
  const compatPct = Math.round(match.score * 100);
  const color    = compatPct >= 80 ? '#10B981' : compatPct >= 60 ? '#F59E0B' : '#6B7280';
  const glowRgba = compatPct >= 80 ? 'rgba(16,185,129,0.12)' : compatPct >= 60 ? 'rgba(245,158,11,0.12)' : undefined;

  return (
    <GlassCard
      glowColor={glowRgba}
      sx={{
        p: 3, height: '100%',
        display: 'flex', flexDirection: 'column', position: 'relative',
        transition: 'transform 0.2s ease',
        '&:hover': { transform: 'translateY(-4px)' },
      }}
    >
      {/* Demo badge */}
      {match.isDemo && (
        <Chip label="DEMO" size="small" sx={{
          position: 'absolute', top: 12, left: 12,
          fontSize: '0.58rem', height: 17, letterSpacing: 1,
          bgcolor: 'rgba(255,255,255,0.05)', color: 'text.disabled',
          border: '1px solid rgba(255,255,255,0.09)',
        }} />
      )}

      {/* Top row: avatar + name + compatibility ring */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, mt: match.isDemo ? 2.5 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, mr: 1 }}>
          <Avatar
            src={match.avatarUrl}
            sx={{
              width: 54, height: 54, flexShrink: 0,
              border: `2.5px solid ${color}`,
              boxShadow: `0 0 14px ${color}55`,
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
        <Typography variant="body2" color="text.secondary"
          sx={{ mb: 2, lineHeight: 1.6, fontSize: '0.81rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {match.bio}
        </Typography>
      )}

      {/* Goal progress bar tease */}
      {match.overallProgress !== undefined && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
            <Typography sx={{ fontSize: '0.63rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>
              Goal Progress
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color, fontWeight: 700 }}>
              {match.overallProgress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={match.overallProgress}
            sx={{
              height: 4, borderRadius: '3px',
              bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: '3px',
                background: `linear-gradient(90deg, ${color}88, ${color})`,
              },
            }}
          />
        </Box>
      )}

      {/* Aligned goals */}
      {match.sharedGoals && match.sharedGoals.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '0.63rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 1.5, mb: 0.75, fontWeight: 600 }}>
            Aligned Goals
          </Typography>
          {match.sharedGoals.slice(0, 3).map((goal) => (
            <Box key={goal} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: color, flexShrink: 0, mt: '6px' }} />
              <Typography variant="body2" sx={{ fontSize: '0.79rem', lineHeight: 1.4, color: 'text.secondary' }}>
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
              <Chip key={domain} label={domain} size="small" sx={{
                height: 21, fontSize: '0.67rem',
                bgcolor: `${dc}16`, color: dc, border: `1px solid ${dc}38`,
                '& .MuiChip-label': { px: 1.25 },
              }} />
            );
          })}
          {match.domains.length > 4 && (
            <Chip label={`+${match.domains.length - 4}`} size="small"
              sx={{ height: 21, fontSize: '0.67rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'text.disabled' }} />
          )}
        </Box>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PersonIcon sx={{ fontSize: '0.85rem' }} />}
          onClick={() => onViewProfile(match)}
          sx={{
            flex: '0 0 auto', fontWeight: 600, fontSize: '0.78rem', borderRadius: '10px',
            borderColor: `${color}55`, color,
            '&:hover': { borderColor: color, bgcolor: `${color}0D` },
          }}
        >
          Profile
        </Button>
        {!match.isDemo && compatPct >= 60 && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AccountTreeIcon sx={{ fontSize: '0.85rem' }} />}
            onClick={() => onCollaborate(match)}
            sx={{
              flex: '0 0 auto', fontWeight: 600, fontSize: '0.78rem', borderRadius: '10px',
              borderColor: 'rgba(139,92,246,0.45)', color: '#8B5CF6',
              '&:hover': { borderColor: '#8B5CF6', bgcolor: 'rgba(139,92,246,0.08)' },
            }}
          >
            Collab
          </Button>
        )}
        <Button
          variant="contained"
          fullWidth
          startIcon={<MessageIcon sx={{ fontSize: '0.95rem' }} />}
          onClick={() => onMessage(match)}
          sx={{
            fontWeight: 700, fontSize: '0.84rem', borderRadius: '10px',
            background: `linear-gradient(135deg, ${color}CC, ${color}99)`,
            boxShadow: `0 4px 14px ${color}44`,
            '&:hover': {
              background: `linear-gradient(135deg, ${color}, ${color}BB)`,
              boxShadow: `0 6px 20px ${color}66`,
            },
          }}
        >
          Message
        </Button>
      </Box>
    </GlassCard>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const PRAXIS_DOMAINS = [
  'Career',
  'Investing',
  'Fitness',
  'Academics',
  'Mental Health',
  'Philosophy',
  'Culture & Hobbies',
  'Intimacy & Romance',
  'Friendship & Social',
];

const MatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();

  const [realMatches, setRealMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [compatibilityFilter, setCompatibilityFilter] = useState(0);
  const [selectedDomainsFilter, setSelectedDomainsFilter] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  // Convert mock data to MatchProfile shape (used as fallback)
  const demoProfiles: MatchProfile[] = mockMatches.map((m: MockMatch) => ({
    userId: m.id,
    score: m.compatibility / 100,
    name: m.name,
    avatarUrl: m.avatarUrl,
    domains: m.sharedDomains,
    bio: m.bio,
    sharedGoals: m.sharedGoals,
    progressPace: m.progressPace,
    overallProgress: m.overallProgress,
    isDemo: true,
  }));

  useEffect(() => {
    if (userLoading || !user) return;
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const url = selectedDomain
          ? `${API_URL}/matches/${user.id}?domain=${encodeURIComponent(selectedDomain)}`
          : `${API_URL}/matches/${user.id}`;
        const matchRes = await axios.get(url);
        const rawMatches: MatchResult[] = matchRes.data ?? [];

        if (rawMatches.length === 0) { setRealMatches([]); return; }

        const profiles = await Promise.all(rawMatches.map(async (m) => {
          try {
            const { data: profile } = await supabase
              .from('profiles').select('name, avatar_url, bio').eq('id', m.userId).single();
            let domains: string[] = [];
            try {
              const goalRes = await axios.get(`${API_URL}/goals/${m.userId}`);
              const nodes = goalRes.data?.nodes ?? [];
              domains = Array.from(new Set<string>(nodes.map((n: any) => n.domain).filter(Boolean)));
            } catch { /* non-fatal */ }
            return {
              userId: m.userId, score: m.score,
              name: profile?.name ?? `User ${m.userId.slice(0, 6)}`,
              avatarUrl: profile?.avatar_url ?? undefined,
              bio: profile?.bio ?? undefined,
              domains,
            } as MatchProfile;
          } catch {
            return { userId: m.userId, score: m.score, name: `User ${m.userId.slice(0, 6)}`, domains: [] } as MatchProfile;
          }
        }));
        setRealMatches(profiles);
      } catch {
        setRealMatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, [user, userLoading, selectedDomain]);

  const applyFilters = (list: MatchProfile[]) =>
    list.filter((m) => {
      const pct = Math.round(m.score * 100);
      return pct >= compatibilityFilter &&
        (selectedDomainsFilter.length === 0 || selectedDomainsFilter.some(d => m.domains.includes(d)));
    });

  const showingDemo = realMatches.length === 0;
  const allDisplayed = showingDemo ? applyFilters(demoProfiles) : applyFilters(realMatches);

  const handleMessage = (match: MatchProfile) => {
    if (match.isDemo) {
      toast('Build your goal tree first to connect with real users like this!', { icon: '🎯' });
      navigate('/goals/' + user!.id);
      return;
    }
    toast.success(`Opening chat with ${match.name}!`);
    navigate(`/chat/${user!.id}/${match.userId}`);
  };

  const handleViewProfile = (match: MatchProfile) => {
    if (match.isDemo) {
      toast('This is a demo profile — find real matches by building your goal tree!', { icon: '👤' });
      return;
    }
    navigate(`/profile/${match.userId}`);
  };

  const handleCollaborate = (match: MatchProfile) => {
    toast.success(`Opening goal-focused chat with ${match.name}!`, { icon: '🎯' });
    navigate(`/chat/${user!.id}/${match.userId}`);
  };

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
              ? 'Sample profiles — build your goal tree to see real matches'
              : `${allDisplayed.length} people aligned with your goals`}
          </Typography>
        </Box>
        <Button
          variant="outlined" startIcon={<FilterListIcon />} size="small"
          onClick={() => setShowFilters(f => !f)}
          sx={{ borderRadius: '10px', borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
        >
          Filters {compatibilityFilter > 0 || selectedDomainsFilter.length > 0 ? '·' : ''}
        </Button>
      </Box>

      {/* ── Domain Filter Chips ──────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {PRAXIS_DOMAINS.map((domain) => {
          const isSelected = selectedDomain === domain;
          return (
            <Chip
              key={domain}
              label={domain}
              onClick={() => setSelectedDomain(isSelected ? null : domain)}
              sx={{
                fontWeight: 600,
                fontSize: '0.78rem',
                bgcolor: isSelected ? 'primary.main' : 'rgba(255,255,255,0.05)',
                color: isSelected ? '#0A0B14' : 'text.secondary',
                border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                '&:hover': {
                  bgcolor: isSelected ? 'primary.dark' : 'rgba(255,255,255,0.1)',
                },
              }}
            />
          );
        })}
        {selectedDomain && (
          <Chip
            label="Clear"
            onClick={() => setSelectedDomain(null)}
            size="small"
            sx={{ fontWeight: 600, bgcolor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}
          />
        )}
      </Box>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Collapse in={showFilters}>
        <GlassCard sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="domain-filter-label">Filter by Domain</InputLabel>
                <Select
                  labelId="domain-filter-label" multiple label="Filter by Domain"
                  value={selectedDomainsFilter}
                  onChange={(e) => setSelectedDomainsFilter(e.target.value as string[])}
                  renderValue={(sel) => (sel as string[]).join(', ')}
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
              <Slider value={compatibilityFilter} onChange={(_, v) => setCompatibilityFilter(v as number)}
                valueLabelDisplay="auto" min={0} max={100} step={5} sx={{ color: 'primary.main' }} />
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

      {/* ── Demo banner ──────────────────────────────────────────────────── */}
      {showingDemo && (
        <Alert severity="info" icon={<TrendingUpIcon />}
          sx={{ mb: 3, bgcolor: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: '12px' }}>
          <strong>These are sample matches.</strong> Once you set up your goal tree, the algorithm will find real people aligned with your progress pace and specific goals.
        </Alert>
      )}

      {/* ── Upgrade teaser (non-premium) ─────────────────────────────────── */}
      {!user?.is_premium && (
        <GlassCard
          glowColor="rgba(139,92,246,0.1)"
          sx={{
            p: 3, mb: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.07), rgba(245,158,11,0.04))',
            border: '1px solid rgba(139,92,246,0.22)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ p: 1, borderRadius: '12px', bgcolor: 'rgba(139,92,246,0.14)', display: 'flex' }}>
              <WorkspacePremiumIcon sx={{ color: '#8B5CF6', fontSize: '1.3rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Unlock Advanced Matching</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 0.4 }}>
                {['Semantic AI matching', 'Chat priority', 'Unlimited filters', 'Mutual grading insights'].map(f => (
                  <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LockIcon sx={{ fontSize: '0.6rem', color: '#8B5CF6' }} />
                    <Typography sx={{ fontSize: '0.73rem', color: 'text.secondary' }}>{f}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <Button
            variant="contained" size="small"
            onClick={() => navigate('/upgrade')}
            sx={{
              background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
              borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem',
              boxShadow: '0 4px 14px rgba(139,92,246,0.38)', whiteSpace: 'nowrap',
              '&:hover': { background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
            }}
          >
            Upgrade to Premium
          </Button>
        </GlassCard>
      )}

      {/* ── Cards grid ───────────────────────────────────────────────────── */}
      {allDisplayed.length > 0 ? (
        <Grid container spacing={3}>
          {allDisplayed.map((match) => (
            <Grid key={match.userId} size={{ xs: 12, sm: 6, md: 4 }}>
              <MatchCard match={match} onMessage={handleMessage} onViewProfile={handleViewProfile} onCollaborate={handleCollaborate} />
            </Grid>
          ))}
        </Grid>
      ) : (
        /* ── Empty state ──────────────────────────────────────────────── */
        <GlassCard sx={{ p: { xs: 5, md: 8 }, textAlign: 'center' }}>
          <AutoAwesomeIcon sx={{ fontSize: 52, color: 'primary.main', mb: 2, opacity: 0.65 }} />
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
            No matches yet — keep building your goals!
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 420, mx: 'auto', lineHeight: 1.7 }}>
            The more specific your goal tree, the more precisely we can find people aligned with where you're heading.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={() => navigate(`/goals/${user?.id}`)} sx={{ borderRadius: '10px', px: 4 }}>
              Build my goal tree
            </Button>
            {!user?.is_premium && (
              <Button variant="outlined" onClick={() => navigate('/upgrade')} sx={{ borderRadius: '10px', px: 3, borderColor: '#8B5CF6', color: '#8B5CF6' }}>
                Upgrade for more matches
              </Button>
            )}
          </Box>
        </GlassCard>
      )}

    </Container>
  );
};

export default MatchesPage;
