import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../../hooks/useUser';
import { Domain } from '../../models/Domain';
import GlassCard from '../../components/common/GlassCard';
import {
  Container,
  Box,
  Typography,
  Grid,
  Avatar,
  Chip,
  Button,
  CircularProgress,
  Stack,
  Slider,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FilterListIcon from '@mui/icons-material/FilterList';
import ChatIcon from '@mui/icons-material/Chat';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import toast from 'react-hot-toast';

interface MatchProfile {
  userId: string;
  score: number;
  name: string;
  avatarUrl?: string;
  bio?: string;
  domains: string[];
  sharedGoals: string[];
  progressPace?: number;
  overallProgress?: number;
  currentStreak?: number;
  lastCheckinDate?: string | null;
  isDemo?: boolean;
}

interface MockMatch {
  id: string;
  name: string;
  compatibility: number;
  sharedDomains: string[];
  sharedGoals: string[];
  bio: string;
  avatarUrl: string;
  progressPace: number;
  overallProgress: number;
}

const mockMatches: MockMatch[] = [
  {
    id: '1',
    name: 'Marcus Aurelius',
    compatibility: 98,
    sharedDomains: ['Philosophy', 'Leadership'],
    sharedGoals: ['Daily Reflection', 'Stoic Practice'],
    bio: 'Focusing on what I can control and letting go of the rest.',
    avatarUrl: 'https://i.pravatar.cc/150?u=marcus',
    progressPace: 1.2,
    overallProgress: 85,
  },
  {
    id: '2',
    name: 'Leonardo da Vinci',
    compatibility: 92,
    sharedDomains: ['Art', 'Engineering', 'Anatomy'],
    sharedGoals: ['Mastering Perspective', 'Observational Drawing'],
    bio: 'Exploring the intersection of art and science through curiosity.',
    avatarUrl: 'https://i.pravatar.cc/150?u=leo',
    progressPace: 0.9,
    overallProgress: 70,
  },
  {
    id: '3',
    name: 'Ada Lovelace',
    compatibility: 88,
    sharedDomains: ['Mathematics', 'Computing'],
    sharedGoals: ['Analytical Engine algorithms', 'Poetical Science'],
    bio: 'Developing the first complex algorithms for computing machines.',
    avatarUrl: 'https://i.pravatar.cc/150?u=ada',
    progressPace: 1.5,
    overallProgress: 95,
  },
];

const PRAXIS_DOMAINS = [
  'Body & Health',
  'Mind & Learning',
  'Craft & Career',
  'Money & Assets',
  'Environment & Gear',
  'Spirit & Purpose',
  'Culture & Hobbies',
  'Intimacy & Romance',
  'Friendship & Social',
];

const MatchesPage: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();

  const [realMatches, setRealMatches] = useState<MatchProfile[]>([]);
  const [matchCache, setMatchCache] = useState<Record<string, MatchProfile[]>>({});
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
    const cacheKey = selectedDomain || 'all';
    
    if (matchCache[cacheKey]) {
      setRealMatches(matchCache[cacheKey]);
      setLoading(false);
      return;
    }

    const fetchMatches = async () => {
      setLoading(true);
      try {
        const url = selectedDomain
          ? `${API_URL}/matches/${user.id}?domain=${encodeURIComponent(selectedDomain)}`
          : `${API_URL}/matches/${user.id}`;
        const matchRes = await axios.get(url);
        const enrichedMatches: MatchProfile[] = (matchRes.data ?? []).map((m: any) => ({
          userId: m.userId,
          score: m.score,
          name: m.name,
          avatarUrl: m.avatarUrl,
          bio: m.bio,
          domains: m.domains ?? [],
          sharedGoals: m.sharedGoals ?? [],
          overallProgress: m.overallProgress,
          currentStreak: m.currentStreak ?? 0,
          lastCheckinDate: m.lastCheckinDate ?? null,
        }));
        setRealMatches(enrichedMatches);
        setMatchCache(prev => ({ ...prev, [cacheKey]: enrichedMatches }));
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
        (selectedDomainsFilter.length === 0 || 
         selectedDomainsFilter.some(d => m.domains.includes(d)));
    });

  const allDisplayed = applyFilters(realMatches.length > 0 ? realMatches : demoProfiles);
  const showingDemo = realMatches.length === 0;

  const handleToggleDomainFilter = (domain: string) => {
    setSelectedDomainsFilter(prev => 
      prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain]
    );
  };

  const handleChat = (match: MatchProfile) => {
    if (match.isDemo) {
      toast('This is a demo profile — build your goal tree to find real matches!', { icon: '👤' });
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
    <Box sx={compact ? {} : { py: 5 }}>
      {!compact && (
        <Container maxWidth="lg">
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
              {showFilters ? 'Hide Filters' : 'Filters'} {compatibilityFilter > 0 || selectedDomainsFilter.length > 0 ? '·' : ''}
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
          </Box>

          {/* ── Advanced Filters Collapse ────────────────────────────────────── */}
          <Collapse in={showFilters}>
            <GlassCard sx={{ p: 3, mb: 4, bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    Minimum Compatibility: {compatibilityFilter}%
                  </Typography>
                  <Slider
                    value={compatibilityFilter}
                    onChange={(_, v) => setCompatibilityFilter(v as number)}
                    valueLabelDisplay="auto"
                    sx={{ color: 'primary.main' }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    Filter by Shared Domains
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {PRAXIS_DOMAINS.map((domain) => (
                      <Chip
                        key={domain}
                        label={domain}
                        size="small"
                        onClick={() => handleToggleDomainFilter(domain)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: selectedDomainsFilter.includes(domain) ? 'primary.main' : 'transparent',
                          color: selectedDomainsFilter.includes(domain) ? '#0A0B14' : 'inherit',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </GlassCard>
          </Collapse>
        </Container>
      )}

      {/* ── Match Cards Grid ───────────────────────────────────────────── */}
      <Container maxWidth={compact ? false : "lg"} sx={compact ? { p: 0 } : {}}>
        <Grid container spacing={compact ? 2 : 3}>
          {allDisplayed.length === 0 ? (
            <Grid item xs={12}>
              <Box sx={{ py: 8, textAlign: 'center', opacity: 0.5 }}>
                <Typography variant="h6">No matches found with current filters.</Typography>
              </Box>
            </Grid>
          ) : (
            allDisplayed.map((match) => (
              <Grid item xs={12} sm={compact ? 12 : 6} md={compact ? 6 : 4} key={match.userId}>
                <GlassCard sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: 'primary.main',
                    boxShadow: '0 12px 40px rgba(245,158,11,0.1)',
                  },
                  transition: 'all 0.3s ease',
                }}>
                  {/* Compatibility Badge */}
                  <Box sx={{
                    position: 'absolute', top: 16, right: 16,
                    bgcolor: 'primary.main', color: '#0A0B14',
                    px: 1.5, py: 0.5, borderRadius: '10px',
                    fontWeight: 900, fontSize: '0.85rem',
                    boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                    zIndex: 2,
                  }}>
                    {Math.round(match.score * 100)}%
                  </Box>

                  <CardContent sx={{ p: 3, flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
                      <Avatar
                        src={match.avatarUrl}
                        sx={{
                          width: 64, height: 64,
                          border: '2px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.2 }}>
                          {match.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {match.currentStreak !== undefined && match.currentStreak > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 16 }} />
                              <Typography variant="caption" sx={{ fontWeight: 800, color: '#F97316' }}>
                                {match.currentStreak}d
                              </Typography>
                            </Box>
                          )}
                          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                            {match.isDemo ? 'Guide' : 'Student'}
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.6,
                        height: 40,
                      }}
                    >
                      {match.bio || 'Building a life of intentional progress and shared accountability.'}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: '0.1em' }}>
                        Shared Domains
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mt: 1 }}>
                        {match.domains.slice(0, 3).map((d) => (
                          <Chip
                            key={d} label={d} size="small"
                            sx={{
                              height: 20, fontSize: '0.65rem', fontWeight: 700,
                              bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary',
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}
                          />
                        ))}
                        {match.domains.length > 3 && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>
                            +{match.domains.length - 3}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ mb: 1 }}>
                      <Typography variant="overline" sx={{ color: 'text.disabled', fontWeight: 800 }}>
                        Matching Goals
                      </Typography>
                      <Stack spacing={0.8} sx={{ mt: 1 }}>
                        {match.sharedGoals.slice(0, 2).map((goal, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main' }} />
                            <Typography variant="caption" noWrap sx={{ fontWeight: 600, color: 'text.primary' }}>
                              {goal}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </CardContent>

                  <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
                    <Button
                      fullWidth variant="contained" size="small"
                      startIcon={<ChatIcon sx={{ fontSize: 16 }} />}
                      onClick={() => handleChat(match)}
                      sx={{ borderRadius: '10px', fontWeight: 800, textTransform: 'none' }}
                    >
                      Chat
                    </Button>
                    <IconButton
                      onClick={() => handleViewProfile(match)}
                      sx={{ borderRadius: '10px', bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary' }}
                    >
                      <AccountCircleIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </GlassCard>
              </Grid>
            ))
          )}
        </Grid>
      </Container>
    </Box>
  );
};

export default MatchesPage;
