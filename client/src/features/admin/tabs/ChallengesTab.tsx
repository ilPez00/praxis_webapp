import React, { useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AddIcon from '@mui/icons-material/Add';
import toast from 'react-hot-toast';
import api from '../../../lib/api';
import { AdminChallenge } from './adminTypes';
import { Domain } from '../../../models/Domain';
import { DOMAIN_COLORS } from '../../../types/goal';

interface ChallengesTabProps {
  challenges: AdminChallenge[];
  loading: boolean;
  fetchChallenges: () => Promise<void>;
}

const ChallengesTab: React.FC<ChallengesTabProps> = ({ challenges, loading, fetchChallenges }) => {
  const [newChallenge, setNewChallenge] = useState({
    title: '', description: '', domain: Domain.FITNESS as string,
    duration_days: 30, reward_points: 100,
  });
  const [creatingChallenge, setCreatingChallenge] = useState(false);

  const handleCreateChallenge = async () => {
    if (!newChallenge.title.trim()) { toast.error('Title is required.'); return; }
    setCreatingChallenge(true);
    try {
      const res = await api.post('/admin/challenges', newChallenge);
      const created = res.data;
      fetchChallenges();
      setNewChallenge({ title: '', description: '', domain: Domain.FITNESS, duration_days: 30, reward_points: 100 });
      toast.success(`Challenge "${created.title}" created!`);
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to create challenge.'); } finally { setCreatingChallenge(false); }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Community Challenges</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchChallenges} disabled={loading} sx={{ color: 'text.secondary' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Create form */}
      <Card sx={{ mb: 3, border: '1px solid rgba(251,191,36,0.2)', bgcolor: 'rgba(251,191,36,0.03)' }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Launch New Challenge</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth size="small" label="Title"
                value={newChallenge.title}
                onChange={e => setNewChallenge(prev => ({ ...prev, title: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Domain</InputLabel>
                <Select
                  label="Domain"
                  value={newChallenge.domain}
                  onChange={e => setNewChallenge(prev => ({ ...prev, domain: e.target.value }))}
                >
                  {Object.values(Domain).map(d => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth size="small" label="Description (optional)" multiline rows={2}
                value={newChallenge.description}
                onChange={e => setNewChallenge(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth size="small" label="Duration (days)" type="number"
                value={newChallenge.duration_days}
                onChange={e => setNewChallenge(prev => ({ ...prev, duration_days: Number(e.target.value) }))}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                fullWidth size="small" label="Reward Points" type="number"
                value={newChallenge.reward_points}
                onChange={e => setNewChallenge(prev => ({ ...prev, reward_points: Number(e.target.value) }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button
                fullWidth variant="contained" color="warning"
                startIcon={creatingChallenge ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                disabled={creatingChallenge || !newChallenge.title.trim()}
                onClick={handleCreateChallenge}
                sx={{ borderRadius: 2 }}
              >
                Launch Challenge
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Existing challenges */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : challenges.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <EmojiEventsIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">No challenges yet. Create the first one!</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {challenges.map(c => {
            const color = (DOMAIN_COLORS as Record<string, string>)[c.domain] || '#9CA3AF';
            return (
              <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ borderRadius: 3, border: `1px solid ${color}22`, height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{c.title}</Typography>
                      <Chip
                        label={`+${c.reward_points} pts`}
                        size="small"
                        sx={{ ml: 1, height: 20, fontSize: '0.65rem', bgcolor: `${color}22`, color }}
                      />
                    </Box>
                    {c.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {c.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={c.domain}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${color}18`, color, border: `1px solid ${color}33` }}
                      />
                      <Chip
                        label={`${c.duration_days}d`}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary' }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </>
  );
};

export default ChallengesTab;
