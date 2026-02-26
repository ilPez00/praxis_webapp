import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  Avatar,
  Chip,
  CircularProgress,
  Stack,
  Rating,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import { API_URL } from '../../lib/api';

interface UserResult {
  id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
}

interface CoachResult {
  id: string;
  user_id: string;
  bio: string;
  skills: string[];
  domains: string[];
  rating: number;
  hourly_rate?: number;
  profiles?: {
    id: string;
    name: string;
    avatar_url?: string;
    is_verified?: boolean;
    is_premium?: boolean;
  };
}

interface GroupResult {
  id: string;
  name: string;
  description?: string;
  domain?: string;
}

interface SearchResults {
  users?: UserResult[];
  coaches?: CoachResult[];
  groups?: GroupResult[];
}

const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = searchParams.get('q') ?? '';
  const [tab, setTab] = useState<string>('all');
  const [results, setResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async (query: string, type: string) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}&type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (q) fetchResults(q, tab);
  }, [q, tab, fetchResults]);

  const handleTabChange = (_: React.MouseEvent<HTMLElement>, newTab: string | null) => {
    if (newTab) setTab(newTab);
  };

  const totalCount =
    (results.users?.length ?? 0) +
    (results.coaches?.length ?? 0) +
    (results.groups?.length ?? 0);

  const showUsers  = tab === 'all' || tab === 'users';
  const showCoaches = tab === 'all' || tab === 'coaches';
  const showGroups  = tab === 'all' || tab === 'groups';

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, md: 3 }, py: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        Search results
      </Typography>
      {q && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Showing results for <strong>"{q}"</strong>
        </Typography>
      )}

      <ToggleButtonGroup
        value={tab}
        exclusive
        onChange={handleTabChange}
        size="small"
        sx={{ mb: 3 }}
      >
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="users">
          <PersonIcon sx={{ fontSize: 16, mr: 0.5 }} />Users
        </ToggleButton>
        <ToggleButton value="coaches">
          <SchoolIcon sx={{ fontSize: 16, mr: 0.5 }} />Coaches
        </ToggleButton>
        <ToggleButton value="groups">
          <GroupsIcon sx={{ fontSize: 16, mr: 0.5 }} />Groups
        </ToggleButton>
      </ToggleButtonGroup>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && q && totalCount === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No results for "{q}"
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try a different search term or filter.
          </Typography>
        </Box>
      )}

      {!loading && (
        <Stack spacing={4}>
          {/* Users */}
          {showUsers && (results.users?.length ?? 0) > 0 && (
            <Box>
              {tab === 'all' && (
                <Typography variant="overline" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  Users
                </Typography>
              )}
              <Stack spacing={1.5}>
                {results.users!.map(u => (
                  <Card
                    key={u.id}
                    onClick={() => navigate(`/profile/${u.id}`)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'primary.main' },
                    }}
                  >
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
                      <Avatar src={u.avatar_url ?? undefined} sx={{ width: 44, height: 44 }}>
                        {u.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{u.name}</Typography>
                        {u.bio && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {u.bio}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}

          {/* Coaches */}
          {showCoaches && (results.coaches?.length ?? 0) > 0 && (
            <Box>
              {tab === 'all' && (
                <Typography variant="overline" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  Coaches
                </Typography>
              )}
              <Stack spacing={1.5}>
                {results.coaches!.map(c => (
                  <Card
                    key={c.id}
                    onClick={() => navigate('/coaching')}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'primary.main' },
                    }}
                  >
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
                      <Avatar
                        src={c.profiles?.avatar_url ?? undefined}
                        sx={{ width: 44, height: 44, border: '2px solid rgba(245,158,11,0.4)' }}
                      >
                        {c.profiles?.name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            {c.profiles?.name ?? 'Coach'}
                          </Typography>
                          <Rating value={c.rating} precision={0.5} size="small" readOnly />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                          {c.domains?.slice(0, 3).map(d => (
                            <Chip key={d} label={d} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                          ))}
                          {c.skills?.slice(0, 2).map(s => (
                            <Chip key={s} label={s} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                          ))}
                        </Box>
                      </Box>
                      {c.hourly_rate != null && (
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>
                          {c.hourly_rate} pts/hr
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}

          {/* Groups */}
          {showGroups && (results.groups?.length ?? 0) > 0 && (
            <Box>
              {tab === 'all' && (
                <Typography variant="overline" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  Groups
                </Typography>
              )}
              <Stack spacing={1.5}>
                {results.groups!.map(g => (
                  <Card
                    key={g.id}
                    onClick={() => navigate(`/groups/${g.id}`)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'primary.main' },
                    }}
                  >
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '12px',
                          bgcolor: 'rgba(245,158,11,0.12)',
                          border: '1px solid rgba(245,158,11,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <GroupsIcon sx={{ color: '#F59E0B', fontSize: 22 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{g.name}</Typography>
                        {g.description && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {g.description}
                          </Typography>
                        )}
                        {g.domain && (
                          <Chip label={g.domain} size="small" sx={{ mt: 0.5, fontSize: '0.65rem', height: 20 }} />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default SearchPage;
