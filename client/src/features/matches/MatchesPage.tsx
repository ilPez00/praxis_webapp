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
  Paper,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Button,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';

interface MatchResult {
  userId: string;
  score: number; // 0–1
}

interface MatchProfile {
  userId: string;
  score: number;
  name: string;
  avatarUrl?: string;
  domains: string[];
}

const MatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();

  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [compatibilityFilter, setCompatibilityFilter] = useState<number>(0);
  const [selectedDomainsFilter, setSelectedDomainsFilter] = useState<string[]>([]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) return;

    const fetchMatches = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Get the raw match scores from the backend matching engine
        const matchRes = await axios.get(`${API_URL}/matches/${user.id}`);
        const rawMatches: MatchResult[] = matchRes.data;

        if (!rawMatches || rawMatches.length === 0) {
          setMatches([]);
          return;
        }

        // 2. For each match, fetch the user's profile to get name/avatar/goals
        const profilePromises = rawMatches.map(async (m) => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('name, avatar_url')
              .eq('id', m.userId)
              .single();

            // Also fetch their goal tree to extract domains
            let domains: string[] = [];
            try {
              const goalRes = await axios.get(`${API_URL}/goals/${m.userId}`);
              const nodes = goalRes.data?.nodes || [];
              const domainSet = new Set<string>(nodes.map((n: any) => n.domain).filter(Boolean));
              domains = Array.from(domainSet);
            } catch {
              // Goals not found is non-fatal
            }

            return {
              userId: m.userId,
              score: m.score,
              name: profile?.name || `User ${m.userId.slice(0, 6)}`,
              avatarUrl: profile?.avatar_url,
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

        const profiles = await Promise.all(profilePromises);
        setMatches(profiles);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load matches.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [user, userLoading]);

  const filteredMatches = matches.filter((m) => {
    const scorePercent = Math.round(m.score * 100);
    const meetsScore = scorePercent >= compatibilityFilter;
    const meetsDomain =
      selectedDomainsFilter.length === 0 ||
      selectedDomainsFilter.some((d) => m.domains.includes(d));
    return meetsScore && meetsDomain;
  });

  if (userLoading || loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Matches
        </Typography>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="domain-filter-label">Filter by Domain</InputLabel>
              <Select
                labelId="domain-filter-label"
                multiple
                value={selectedDomainsFilter}
                onChange={(e) => setSelectedDomainsFilter(e.target.value as string[])}
                renderValue={(selected) => (selected as string[]).join(', ')}
              >
                {Object.values(Domain).map((domain) => (
                  <MenuItem key={domain} value={domain}>
                    {domain}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography gutterBottom>Minimum Compatibility (%)</Typography>
            <Slider
              value={compatibilityFilter}
              onChange={(_, newValue) => setCompatibilityFilter(newValue as number)}
              valueLabelDisplay="auto"
              min={0}
              max={100}
            />
          </Grid>
        </Grid>

        {matches.length === 0 ? (
          <Alert severity="info">
            No matches found yet. Set up your goals to start finding compatible users.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {filteredMatches.length > 0 ? (
              filteredMatches.map((match) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={match.userId}>
                  <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                      <Avatar
                        src={match.avatarUrl || undefined}
                        sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }}
                      >
                        {match.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="h6" gutterBottom>{match.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Compatibility: <strong>{Math.round(match.score * 100)}%</strong>
                      </Typography>
                      {match.domains.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.5, mt: 1 }}>
                          {match.domains.slice(0, 3).map((domain) => (
                            <Chip key={domain} label={domain} size="small" />
                          ))}
                          {match.domains.length > 3 && (
                            <Chip label={`+${match.domains.length - 3}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      )}
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                      <Button
                        variant="contained"
                        onClick={() => {
                          toast.success(`Opening chat with ${match.name}!`);
                          navigate(`/chat/${user!.id}/${match.userId}`);
                        }}
                      >
                        Message
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            ) : (
              <Grid size={{ xs: 12 }}>
                <Box sx={{ textAlign: 'center', py: 8, border: '2px dashed grey', borderRadius: 2 }}>
                  <Typography variant="h5" color="text.secondary" gutterBottom>
                    No matches with current filters.
                  </Typography>
                  <Button
                    variant="contained"
                    sx={{ mt: 2 }}
                    onClick={() => { setSelectedDomainsFilter([]); setCompatibilityFilter(0); }}
                  >
                    Reset Filters
                  </Button>
                </Box>
              </Grid>
            )}
          </Grid>
        )}
      </Paper>
    </Container>
  );
};

export default MatchesPage;
