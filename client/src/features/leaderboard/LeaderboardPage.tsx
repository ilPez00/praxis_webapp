import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { DOMAIN_COLORS } from '../../types/goal';
import GlassCard from '../../components/common/GlassCard';
import {
  Container,
  Box,
  Typography,
  Avatar,
  Stack,
  Chip,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar_url?: string;
  praxis_points: number;
  is_premium?: boolean;
  current_streak?: number;
  reliability_score?: number;
  rank: number;
  similarity: number;
  domains: string[];
}

function getStreakTier(streak: number): { label: string; color: string } {
  if (streak >= 30) return { label: 'Elite', color: '#EF4444' };
  if (streak >= 14) return { label: 'Veteran', color: '#8B5CF6' };
  if (streak >= 7)  return { label: 'Disciplined', color: '#3B82F6' };
  if (streak >= 3)  return { label: 'Consistent', color: '#10B981' };
  return { label: 'Newcomer', color: '#6B7280' };
}

const MEDALS = ['🥇', '🥈', '🥉'];

const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'aligned'>('all');

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    axios
      .get(`${API_URL}/users/leaderboard`, { params: { userId: user.id } })
      .then(r => setEntries(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const myEntry = entries.find(e => e.id === user?.id);
  const myRank = myEntry?.rank ?? null;

  const visible = filter === 'aligned'
    ? entries.filter(e => e.similarity > 0)
    : entries;

  return (
    <Container maxWidth="md" sx={{ mt: 4, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <LeaderboardIcon sx={{ color: 'primary.main', fontSize: 32 }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            Leaderboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Top achievers ranked by points + streak
          </Typography>
        </Box>
      </Box>

      {/* Your rank card */}
      {myEntry && (
        <GlassCard sx={{
          p: 3, mb: 4, borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(139,92,246,0.08) 100%)',
          border: '1px solid rgba(245,158,11,0.25)',
        }}>
          <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
            <Box sx={{ textAlign: 'center', minWidth: 56 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, color: 'primary.main' }}>
                {myRank ? (myRank <= 3 ? MEDALS[myRank - 1] : `#${myRank}`) : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">Your rank</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
              <Avatar src={user?.avatarUrl || undefined} sx={{ width: 48, height: 48, fontWeight: 700, bgcolor: 'primary.main' }}>
                {user?.name?.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{user?.name}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {(() => { const t = getStreakTier(user?.current_streak ?? 0); return (
                    <Chip label={t.label} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: `${t.color}18`, color: t.color, border: `1px solid ${t.color}44` }} />
                  ); })()}
                  {user?.is_premium && (
                    <Chip label="Pro" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.15)', color: 'primary.main', border: '1px solid rgba(245,158,11,0.3)' }} />
                  )}
                </Stack>
              </Box>
            </Box>
            <Stack direction="row" spacing={3} alignItems="center">
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 18 }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#F97316', lineHeight: 1 }}>{user?.current_streak ?? 0}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">streak</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 16 }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1 }}>{(user?.praxis_points ?? 0).toLocaleString()}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">points</Typography>
              </Box>
              {myEntry.reliability_score != null && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#10B981', lineHeight: 1 }}>
                    {Math.round(myEntry.reliability_score * 100)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">reliability</Typography>
                </Box>
              )}
            </Stack>
          </Stack>
        </GlassCard>
      )}

      {/* Filter */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_e, v) => { if (v) setFilter(v); }}
          size="small"
          sx={{ '& .MuiToggleButton-root': { borderRadius: '8px !important', px: 2, fontSize: '0.75rem', fontWeight: 700 } }}
        >
          <ToggleButton value="all">All Users</ToggleButton>
          <ToggleButton value="aligned">Goal-Aligned</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Ranking list */}
      <GlassCard sx={{ borderRadius: '20px', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : visible.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No users found.</Typography>
          </Box>
        ) : (
          <Stack divider={<Box sx={{ height: 1, bgcolor: 'rgba(255,255,255,0.04)' }} />}>
            {visible.map((entry, idx) => {
              const isMe = entry.id === user?.id;
              const tier = getStreakTier(entry.current_streak ?? 0);
              const medal = idx < 3 ? MEDALS[idx] : null;
              const reliability = entry.reliability_score != null
                ? Math.round(entry.reliability_score * 100)
                : null;

              return (
                <Box
                  key={entry.id}
                  onClick={() => navigate(`/profile/${entry.id}`)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2,
                    cursor: 'pointer',
                    bgcolor: isMe ? 'rgba(245,158,11,0.05)' : 'transparent',
                    borderLeft: isMe ? '3px solid' : '3px solid transparent',
                    borderColor: isMe ? 'primary.main' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Rank */}
                  <Typography sx={{ minWidth: 32, fontSize: medal ? '1.3rem' : '0.85rem', fontWeight: 800, color: 'text.disabled', textAlign: 'center', lineHeight: 1 }}>
                    {medal ?? `#${entry.rank}`}
                  </Typography>

                  {/* Avatar */}
                  <Avatar
                    src={entry.avatar_url || undefined}
                    sx={{ width: 40, height: 40, fontWeight: 700, bgcolor: 'rgba(245,158,11,0.2)', color: 'primary.main', fontSize: '0.9rem' }}
                  >
                    {entry.name?.charAt(0)}
                  </Avatar>

                  {/* Name + badges */}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {entry.name}{isMe && ' (you)'}
                      </Typography>
                      <Chip
                        label={tier.label}
                        size="small"
                        sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}33` }}
                      />
                      {entry.is_premium && (
                        <Chip label="Pro" size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.12)', color: 'primary.main' }} />
                      )}
                    </Box>
                    {/* Domain chips — max 3 */}
                    {entry.domains.length > 0 && (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                        {entry.domains.slice(0, 3).map(d => (
                          <Chip
                            key={d}
                            label={d.split(' /')[0].split(' /')[0]}
                            size="small"
                            sx={{ height: 14, fontSize: '0.55rem', fontWeight: 600, bgcolor: `${DOMAIN_COLORS[d] ?? '#6B7280'}14`, color: DOMAIN_COLORS[d] ?? '#6B7280' }}
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>

                  {/* Stats */}
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ flexShrink: 0 }}>
                    {(entry.current_streak ?? 0) > 0 && (
                      <Tooltip title="Current streak">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                          <LocalFireDepartmentIcon sx={{ color: '#F97316', fontSize: 14 }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#F97316' }}>
                            {entry.current_streak}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )}
                    {reliability != null && (
                      <Tooltip title="Reliability (30-day check-in rate)">
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981' }}>
                          {reliability}%
                        </Typography>
                      </Tooltip>
                    )}
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                        {(entry.praxis_points ?? 0).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>pts</Typography>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </GlassCard>
    </Container>
  );
};

export default LeaderboardPage;
