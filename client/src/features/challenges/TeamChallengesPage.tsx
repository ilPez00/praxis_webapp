import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Container, Box, Typography, Button, Stack, Chip, Grid,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Slider, Avatar, Tooltip, IconButton, Divider, Alert,
  Paper, LinearProgress, List, ListItem, ListItemAvatar, ListItemText,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GroupsIcon from '@mui/icons-material/Groups';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import BoltIcon from '@mui/icons-material/Bolt';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GlassCard from '../../components/common/GlassCard';
import api from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import { useNavigate } from 'react-router-dom';

const DOMAINS = [
  'Fitness', 'Business', 'Creative', 'Tech', 'Education',
  'Health', 'Finance', 'Relationships', 'Mindfulness', 'Personal Goals',
];

const DOMAIN_COLORS: Record<string, string> = {
  Fitness: '#F97316', Business: '#3B82F6', Creative: '#EC4899',
  Tech: '#8B5CF6', Education: '#10B981', Health: '#34D399',
  Finance: '#F59E0B', Relationships: '#E11D48', Mindfulness: '#A78BFA',
  'Personal Goals': '#F43F5E',
};

interface TeamChallenge {
  id: string;
  title: string;
  description: string | null;
  domain: string;
  stake_pp: number;
  deadline: string;
  deadline_days: number;
  max_members: number;
  is_team: boolean;
  team_id: string;
  created_at: string;
  team_name?: string;
  participants_count?: number;
}

interface TeamMember {
  user_id: string;
  contributed_xp: number;
  contributed_pp: number;
  joined_at: string;
  profiles: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

interface MyTeam {
  in_team: boolean;
  challenge: TeamChallenge;
  team: { id: string; name: string };
  my_contribution: { xp: number; pp: number };
  team_total: { xp: number; pp: number; members: number };
  members: TeamMember[];
}

function daysLeft(deadline: string): number {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

const TeamChallengesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [challenges, setChallenges] = useState<TeamChallenge[]>([]);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<TeamChallenge | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    domain: 'Fitness',
    stake_pp: 50,
    deadline_days: 7,
    max_members: 5,
    team_name: '',
  });

  useEffect(() => {
    loadChallenges();
    loadMyTeam();
  }, [user?.id]);

  const loadChallenges = async () => {
    try {
      const res = await api.get('/team-challenges');
      setChallenges(res.data || []);
    } catch (err) {
      console.error('Failed to load challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyTeam = async () => {
    if (!user?.id) return;
    try {
      const res = await api.get('/team-challenges/my-team');
      setMyTeam(res.data);
    } catch (err) {
      console.error('Failed to load my team:', err);
    }
  };

  const handleCreate = async () => {
    if (!form.title) {
      toast.error('Title is required');
      return;
    }
    try {
      const res = await api.post('/team-challenges', form);
      toast.success('Team challenge created!');
      setCreateOpen(false);
      loadChallenges();
      loadMyTeam();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create challenge');
    }
  };

  const handleJoin = async (challengeId: string, teamId: string) => {
    try {
      await api.post(`/team-challenges/${challengeId}/join`, { teamId });
      toast.success('Joined team challenge!');
      loadChallenges();
      loadMyTeam();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to join');
    }
  };

  const handleContribute = async (challengeId: string, xp: number, pp: number) => {
    try {
      await api.post(`/team-challenges/${challengeId}/contribute`, { xp, pp });
      toast.success(`Contributed ${xp} XP!`);
      loadMyTeam();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to contribute');
    }
  };

  const handleLeaderboard = async (challengeId: string) => {
    try {
      const res = await api.get(`/team-challenges/${challengeId}/leaderboard`);
      setLeaderboard(res.data || []);
      setLeaderboardOpen(true);
    } catch (err) {
      toast.error('Failed to load leaderboard');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            <GroupsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Team Challenges
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => setCreateOpen(true)}
          sx={{ bgcolor: '#A78BFA', '&:hover': { bgcolor: '#8B5CF6' } }}
        >
          Create Team
        </Button>
      </Box>

      {myTeam?.in_team && (
        <GlassCard sx={{ p: 3, mb: 3, bgcolor: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Your Team
            </Typography>
            <Chip
              icon={<LeaderboardIcon />}
              label="View Leaderboard"
              onClick={() => handleLeaderboard(myTeam.challenge.id)}
              sx={{ bgcolor: 'rgba(167,139,250,0.2)', color: '#A78BFA' }}
            />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#A78BFA', mb: 1 }}>
            {myTeam.team.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {myTeam.challenge.title} · {daysLeft(myTeam.challenge.deadline)} days left
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={4}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(245,158,11,0.1)', borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#F59E0B' }}>
                  {myTeam.team_total.xp}
                </Typography>
                <Typography variant="caption" color="text.secondary">Team XP</Typography>
              </Box>
            </Grid>
            <Grid size={4}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(167,139,250,0.1)', borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#A78BFA' }}>
                  {myTeam.my_contribution.xp}
                </Typography>
                <Typography variant="caption" color="text.secondary">Your XP</Typography>
              </Box>
            </Grid>
            <Grid size={4}>
              <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'rgba(34,197,94,0.1)', borderRadius: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#22C55E' }}>
                  {myTeam.team_total.members}
                </Typography>
                <Typography variant="caption" color="text.secondary">Members</Typography>
              </Box>
            </Grid>
          </Grid>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Team Members</Typography>
          <List dense>
            {myTeam.members.map((member) => (
              <ListItem key={member.user_id} sx={{ px: 0 }}>
                <ListItemAvatar>
                  <Avatar src={member.profiles?.avatar_url || undefined} sx={{ width: 32, height: 32 }}>
                    {member.profiles?.name?.[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={member.profiles?.name || 'Unknown'}
                  secondary={`${member.contributed_xp} XP contributed`}
                />
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Contribute to Your Team</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleContribute(myTeam.challenge.id, 100, 0)}
            >
              +100 XP
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleContribute(myTeam.challenge.id, 250, 0)}
            >
              +250 XP
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleContribute(myTeam.challenge.id, 500, 0)}
            >
              +500 XP
            </Button>
          </Stack>
        </GlassCard>
      )}

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Active Team Challenges
      </Typography>

      {challenges.length === 0 ? (
        <GlassCard sx={{ p: 4, textAlign: 'center' }}>
          <GroupsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography color="text.secondary">
            No team challenges yet. Create one to start collaborating!
          </Typography>
        </GlassCard>
      ) : (
        <Grid container spacing={2}>
          {challenges.map((challenge) => {
            const color = DOMAIN_COLORS[challenge.domain] || '#6B7280';
            const days = daysLeft(challenge.deadline);
            
            return (
              <Grid size={{ xs: 12, md: 6 }} key={challenge.id}>
                <GlassCard sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Chip
                      label={challenge.domain}
                      size="small"
                      sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: '0.7rem' }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <BoltIcon sx={{ fontSize: 14, color: '#A78BFA' }} />
                      <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 800 }}>
                        {challenge.stake_pp} PP
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {challenge.title}
                  </Typography>
                  {challenge.description && (
                    <Typography variant="body2" color="text.secondary">
                      {challenge.description}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<GroupsIcon />}
                      label={`${challenge.participants_count || 0}/${challenge.max_members} members`}
                      size="small"
                      sx={{ bgcolor: 'rgba(167,139,250,0.1)', color: '#A78BFA' }}
                    />
                    <Chip
                      label={`${days}d left`}
                      size="small"
                      sx={{ bgcolor: days <= 1 ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)', 
                           color: days <= 1 ? '#EF4444' : '#6B7280' }}
                    />
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<PersonAddIcon />}
                      onClick={() => handleJoin(challenge.id, challenge.team_id)}
                      disabled={!user?.id}
                      sx={{ flex: 1, bgcolor: '#22C55E', '&:hover': { bgcolor: '#16A34A' } }}
                    >
                      Join Team
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleLeaderboard(challenge.id)}
                    >
                      <LeaderboardIcon />
                    </Button>
                  </Stack>
                </GlassCard>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Team Challenge</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Challenge Title"
              fullWidth
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextField
              label="Team Name"
              fullWidth
              value={form.team_name}
              onChange={(e) => setForm({ ...form, team_name: e.target.value })}
              placeholder="Optional custom team name"
            />
            <Box>
              <Typography variant="body2" gutterBottom>Domain</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {DOMAINS.map((domain) => (
                  <Chip
                    key={domain}
                    label={domain}
                    onClick={() => setForm({ ...form, domain })}
                    sx={{
                      bgcolor: form.domain === domain ? DOMAIN_COLORS[domain] + '30' : 'transparent',
                      border: form.domain === domain ? `1px solid ${DOMAIN_COLORS[domain]}` : '1px solid',
                      color: form.domain === domain ? DOMAIN_COLORS[domain] : 'text.secondary',
                    }}
                  />
                ))}
              </Box>
            </Box>
            <Box>
              <Typography variant="body2">Stake: {form.stake_pp} PP</Typography>
              <Slider
                value={form.stake_pp}
                onChange={(_, v) => setForm({ ...form, stake_pp: v as number })}
                min={10}
                max={200}
                step={10}
                marks={[{ value: 10, label: '10' }, { value: 100, label: '100' }, { value: 200, label: '200' }]}
              />
            </Box>
            <Box>
              <Typography variant="body2">Duration: {form.deadline_days} days</Typography>
              <Slider
                value={form.deadline_days}
                onChange={(_, v) => setForm({ ...form, deadline_days: v as number })}
                min={1}
                max={30}
                marks={[{ value: 1, label: '1' }, { value: 7, label: '7' }, { value: 30, label: '30' }]}
              />
            </Box>
            <Box>
              <Typography variant="body2">Max Team Members: {form.max_members}</Typography>
              <Slider
                value={form.max_members}
                onChange={(_, v) => setForm({ ...form, max_members: v as number })}
                min={2}
                max={10}
                marks={[{ value: 2, label: '2' }, { value: 5, label: '5' }, { value: 10, label: '10' }]}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} sx={{ bgcolor: '#A78BFA' }}>
            Create Challenge
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <LeaderboardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Team Leaderboard
        </DialogTitle>
        <DialogContent>
          {leaderboard.length === 0 ? (
            <Typography color="text.secondary">No teams yet</Typography>
          ) : (
            <List>
              {leaderboard.map((team: any, index: number) => (
                <ListItem key={team.team_id} sx={{ bgcolor: index === 0 ? 'rgba(245,158,11,0.1)' : 'transparent', borderRadius: 1, mb: 1 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: index === 0 ? '#F59E0B' : index === 1 ? '#9CA3AF' : index === 2 ? '#CD7F32' : '#6B7280' }}>
                      {index + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={team.team_name}
                    secondary={`${team.members_count} members · ${team.total_xp} XP`}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#A78BFA' }}>
                    {team.total_xp} XP
                  </Typography>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaderboardOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TeamChallengesPage;
