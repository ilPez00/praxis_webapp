import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Avatar,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Divider,
  LinearProgress,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HandshakeIcon from '@mui/icons-material/Handshake';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useCelebrations } from '../../hooks/useCelebrations';

interface BuddyPair {
  id: string;
  partner: {
    id: string;
    name: string;
    avatar_url: string | null;
    current_streak: number;
  };
  mutual_checkin_streak: number;
  longest_mutual_streak: number;
  status: string;
  myCheckin: boolean;
  partnerCheckedIn: boolean;
  bothCheckedIn: boolean;
}

interface PendingRequest {
  id: string;
  requester: {
    id: string;
    name: string;
    avatar_url: string | null;
    current_streak: number;
  };
}

interface BuddyStats {
  activePairs: number;
  thisWeekMutual: number;
  totalMutualDays: number;
  longestStreak: number;
  currentStreak: number;
}

interface AccountabilityBuddyProps {
  userId: string;
}

const AccountabilityBuddy: React.FC<AccountabilityBuddyProps> = ({ userId }) => {
  const [buddies, setBuddies] = useState<BuddyPair[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [stats, setStats] = useState<BuddyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [sending, setSending] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const [checkinLoading, setCheckinLoading] = useState<string | null>(null);
  const { celebrateMilestone } = useCelebrations();

  useEffect(() => {
    if (!userId) return;
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const [buddiesRes, requestsRes, statsRes] = await Promise.all([
        api.get('/buddies'),
        api.get('/buddies/requests'),
        api.get('/buddies/stats'),
      ]);
      setBuddies(buddiesRes.data.buddies || []);
      setRequests(requestsRes.data.requests || []);
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error('Failed to fetch buddy data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!partnerId.trim()) return;
    setSending(true);
    try {
      await api.post('/buddies/request', { receiverId: partnerId.trim() });
      toast.success('Buddy request sent!');
      setAddDialogOpen(false);
      setPartnerId('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    setResponding(requestId);
    try {
      await api.post(`/buddies/requests/${requestId}/respond`, { accept });
      toast.success(accept ? 'Buddy request accepted!' : 'Buddy request declined');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to respond');
    } finally {
      setResponding(null);
    }
  };

  const handleBuddyCheckin = async (pair: BuddyPair) => {
    setCheckinLoading(pair.id);
    try {
      const res = await api.post(`/buddies/pairs/${pair.id}/checkin`);
      const { bothCheckedIn, xpEarned, mutualStreakBonus, mutualStreak } = res.data;
      
      if (bothCheckedIn) {
        toast.success(
          `Mutual check-in! +${xpEarned} XP${mutualStreakBonus ? ' 🎉 Weekly streak bonus!' : ''}`,
          { icon: '🤝' }
        );
        
        if (mutualStreakBonus) {
          celebrateMilestone({
            milestone: mutualStreak,
            type: 'achievement',
            title: `${mutualStreak}-Day Mutual Streak!`,
            description: 'You and your buddy checked in together!',
            reward: { xp: xpEarned },
          });
        }
      } else {
        toast.success('Buddy check-in recorded! Waiting for partner...', { icon: '⏳' });
      }
      
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record check-in');
    } finally {
      setCheckinLoading(null);
    }
  };

  if (loading) return null;

  const acceptedBuddies = buddies.filter(b => b.status === 'accepted');
  const hasBuddy = acceptedBuddies.length > 0;

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HandshakeIcon sx={{ color: '#A78BFA' }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Accountability Buddies
          </Typography>
        </Box>
        <Button
          size="small"
          startIcon={<PersonAddIcon />}
          onClick={() => setAddDialogOpen(true)}
          sx={{ fontWeight: 700 }}
        >
          Find Buddy
        </Button>
      </Box>

      {/* Stats Bar */}
      {stats && stats.activePairs > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: '16px !important' }} />}
            label={`${stats.currentStreak}d mutual streak`}
            sx={{ bgcolor: '#22C55E20', color: '#22C55E', fontWeight: 700 }}
          />
          <Chip
            size="small"
            icon={<EmojiEventsIcon sx={{ fontSize: '16px !important' }} />}
            label={`Best: ${stats.longestStreak}d`}
            sx={{ bgcolor: '#F59E0B20', color: '#F59E0B', fontWeight: 700 }}
          />
          <Chip
            size="small"
            label={`${stats.thisWeekMutual}/7 this week`}
            sx={{ bgcolor: '#A78BFA20', color: '#A78BFA', fontWeight: 700 }}
          />
        </Stack>
      )}

      {/* Pending Requests */}
      {requests.length > 0 && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(167,139,250,0.1)', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#A78BFA' }}>
            Pending Requests ({requests.length})
          </Typography>
          <Stack spacing={1}>
            {requests.map(request => (
              <Box key={request.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar src={request.requester.avatar_url || undefined} sx={{ width: 32, height: 32 }}>
                  {request.requester.name?.[0]}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {request.requester.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    🔥 {request.requester.current_streak}d streak
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleRespond(request.id, true)}
                  disabled={responding === request.id}
                  sx={{ color: '#22C55E' }}
                >
                  <CheckCircleIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleRespond(request.id, false)}
                  disabled={responding === request.id}
                  sx={{ color: '#EF4444' }}
                >
                  <CancelIcon />
                </IconButton>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Buddy Pairs */}
      {!hasBuddy && requests.length === 0 ? (
        <Box
          sx={{
            p: 3,
            textAlign: 'center',
            borderRadius: 3,
            border: '2px dashed rgba(167,139,250,0.3)',
            bgcolor: 'rgba(167,139,250,0.05)',
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
            Find an Accountability Buddy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Check in together for bonus XP and mutual accountability!
          </Typography>
          <Button
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ fontWeight: 700 }}
          >
            Send Buddy Request
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {acceptedBuddies.map(pair => (
            <BuddyPairCard
              key={pair.id}
              pair={pair}
              onCheckin={() => handleBuddyCheckin(pair)}
              loading={checkinLoading === pair.id}
            />
          ))}
        </Stack>
      )}

      {/* Add Buddy Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon sx={{ color: '#A78BFA' }} />
          Find Accountability Buddy
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the user ID of the person you want to pair with. You can find their ID on their profile page.
          </Typography>
          <TextField
            fullWidth
            label="Partner's User ID"
            value={partnerId}
            onChange={e => setPartnerId(e.target.value)}
            placeholder="Enter user ID"
            helperText="Find it on their profile page under Settings"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSendRequest}
            disabled={sending || !partnerId.trim()}
            sx={{ bgcolor: '#A78BFA' }}
          >
            {sending ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

interface BuddyPairCardProps {
  pair: BuddyPair;
  onCheckin: () => void;
  loading: boolean;
}

const BuddyPairCard: React.FC<BuddyPairCardProps> = ({ pair, onCheckin, loading }) => {
  const partner = pair.partner;
  
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.1) 0%, rgba(167,139,250,0.05) 100%)',
        border: '1px solid rgba(167,139,250,0.2)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={partner.avatar_url || undefined} sx={{ width: 48, height: 48, bgcolor: '#A78BFA' }}>
            {partner.name?.[0] || '?'}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {partner.name || 'Buddy'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                🔥 {partner.current_streak}d streak
              </Typography>
              <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 600 }}>
                🤝 {pair.mutual_checkin_streak}d mutual
              </Typography>
            </Stack>
          </Box>
        </Box>
        
        <Button
          variant={pair.myCheckin ? 'outlined' : 'contained'}
          size="small"
          onClick={onCheckin}
          disabled={loading || pair.myCheckin}
          startIcon={pair.myCheckin ? <CheckCircleIcon /> : undefined}
          sx={{
            fontWeight: 700,
            bgcolor: pair.myCheckin ? undefined : '#A78BFA',
            '&:hover': { bgcolor: '#A78BFA' },
          }}
        >
          {pair.myCheckin ? 'Checked In' : loading ? '...' : 'Buddy Check-in'}
        </Button>
      </Box>
      
      {/* Partner status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Partner status:
        </Typography>
        {pair.partnerCheckedIn ? (
          <Chip
            size="small"
            label="Checked in ✓"
            sx={{ bgcolor: '#22C55E20', color: '#22C55E', fontSize: '0.7rem' }}
          />
        ) : (
          <Chip
            size="small"
            label="Waiting..."
            sx={{ bgcolor: '#F59E0B20', color: '#F59E0B', fontSize: '0.7rem' }}
          />
        )}
        
        {pair.bothCheckedIn && (
          <Chip
            size="small"
            label={`+25 XP Mutual!`}
            sx={{ bgcolor: '#A78BFA', color: '#fff', fontWeight: 700, fontSize: '0.7rem' }}
          />
        )}
      </Box>
      
      {/* Mutual streak progress */}
      {pair.mutual_checkin_streak > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Mutual streak: {pair.mutual_checkin_streak}d
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Best: {pair.longest_mutual_streak}d
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(pair.mutual_checkin_streak / Math.max(pair.longest_mutual_streak, 7)) * 100}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(167,139,250,0.2)',
              '& .MuiLinearProgress-bar': { bgcolor: '#A78BFA' },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default AccountabilityBuddy;
