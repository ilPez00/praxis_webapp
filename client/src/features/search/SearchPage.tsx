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
import EventIcon from '@mui/icons-material/Event';
import PlaceIcon from '@mui/icons-material/Place';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import api from '../../lib/api';

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

interface EventResult {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  city?: string;
  location?: string;
  creator?: { name: string };
}

interface PlaceResult {
  id: string;
  name: string;
  type?: string;
  address?: string;
  city?: string;
  description?: string;
}

interface NoteResult {
  id: string;
  entry_type: string;
  title: string;
  content: string;
  domain?: string;
  tags?: string[];
  occurred_at: string;
}

interface SearchResults {
  users?: UserResult[];
  coaches?: CoachResult[];
  groups?: GroupResult[];
  events?: EventResult[];
  places?: PlaceResult[];
  notes?: NoteResult[];
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
      const res = await api.get('/search', { params: { q: query, type } });
      setResults(res.data);
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
    (results.groups?.length ?? 0) +
    (results.events?.length ?? 0) +
    (results.places?.length ?? 0) +
    (results.notes?.length ?? 0);

  const showUsers  = tab === 'all' || tab === 'users';
  const showCoaches = tab === 'all' || tab === 'coaches';
  const showGroups  = tab === 'all' || tab === 'groups';
  const showEvents  = tab === 'all' || tab === 'events';
  const showPlaces  = tab === 'all' || tab === 'places';
  const showNotes   = tab === 'all' || tab === 'notes';

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
        <ToggleButton value="events">
          <EventIcon sx={{ fontSize: 16, mr: 0.5 }} />Events
        </ToggleButton>
        <ToggleButton value="places">
          <PlaceIcon sx={{ fontSize: 16, mr: 0.5 }} />Places
        </ToggleButton>
        <ToggleButton value="notes">
          <MenuBookIcon sx={{ fontSize: 16, mr: 0.5 }} />Notes
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
                          {(c.domains ?? []).slice(0, 3).map(d => (
                            <Chip key={d} label={d} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                          ))}
                          {(c.skills ?? []).slice(0, 2).map(s => (
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

          {/* Events */}
          {showEvents && (results.events?.length ?? 0) > 0 && (
            <Box>
              {tab === 'all' && (
                <Typography variant="overline" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  Events
                </Typography>
              )}
              <Stack spacing={1.5}>
                {results.events!.map(ev => (
                  <Card
                    key={ev.id}
                    onClick={() => navigate('/events')}
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
                          bgcolor: 'rgba(236,72,153,0.12)',
                          border: '1px solid rgba(236,72,153,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <EventIcon sx={{ color: '#EC4899', fontSize: 22 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{ev.title}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {new Date(ev.event_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          {ev.city && ` · ${ev.city}`}
                          {ev.creator?.name && ` · by ${ev.creator.name}`}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
          {/* Places */}
          {showPlaces && (results.places?.length ?? 0) > 0 && (
            <Box>
              {tab === 'all' && (
                <Typography variant="overline" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  Places
                </Typography>
              )}
              <Stack spacing={1.5}>
                {results.places!.map(p => (
                  <Card
                    key={p.id}
                    onClick={() => navigate('/discover?tab=places')}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: '#6366F1' },
                    }}
                  >
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
                      <Box
                        sx={{
                          width: 44, height: 44, borderRadius: '12px',
                          bgcolor: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(99,102,241,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <PlaceIcon sx={{ color: '#6366F1', fontSize: 22 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{p.name}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {[p.type, p.address, p.city].filter(Boolean).join(' · ')}
                        </Typography>
                        {p.description && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                            {p.description}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}

          {/* Notes */}
          {showNotes && (results.notes?.length ?? 0) > 0 && (
            <Box>
              {tab === 'all' && (
                <Typography variant="overline" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  Notes
                </Typography>
              )}
              <Stack spacing={1.5}>
                {results.notes!.map(n => (
                  <Card
                    key={n.id}
                    onClick={() => navigate(n.entry_type === 'axiom_brief' ? '/coaching' : '/notebook')}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: '#8B5CF6' },
                    }}
                  >
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '12px !important' }}>
                      <Box
                        sx={{
                          width: 44, height: 44, borderRadius: '12px',
                          bgcolor: 'rgba(139,92,246,0.12)',
                          border: '1px solid rgba(139,92,246,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <MenuBookIcon sx={{ color: '#8B5CF6', fontSize: 22 }} />
                      </Box>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            {n.title || n.entry_type}
                          </Typography>
                          <Chip
                            label={n.entry_type.replace(/_/g, ' ')}
                            size="small"
                            sx={{ height: 18, fontSize: '0.55rem', fontWeight: 700, bgcolor: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {n.content}
                        </Typography>
                        {Array.isArray(n.tags) && n.tags.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            {n.tags.slice(0, 4).map(t => (
                              <Chip key={t} label={`#${t}`} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                            ))}
                          </Box>
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
