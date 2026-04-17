import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Button,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useCelebrations } from '../../hooks/useCelebrations';

interface SeasonalEvent {
  id: string;
  slug: string;
  name: string;
  description: string;
  theme_color: string;
  icon: string;
  event_type: string;
  starts_at: string;
  ends_at: string;
  target_value: number;
  target_metric: string;
  reward_pp: number;
  reward_xp: number;
  reward_badge: string | null;
}

interface Participant {
  id: string;
  event_id: string;
  progress: number;
  completed_at: string | null;
  reward_claimed: boolean;
}

interface SeasonalEventCardProps {
  userId: string;
  compact?: boolean;
}

const formatTimeLeft = (endsAt: string): string => {
  const now = new Date();
  const end = new Date(endsAt);
  const diff = end.getTime() - now.getTime();
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
};

const getMetricLabel = (metric: string): string => {
  const labels: Record<string, string> = {
    streak_days: 'day streak',
    goals_completed: 'goals completed',
    checkins: 'check-ins',
    bets_won: 'bets won',
  };
  return labels[metric] || metric;
};

const SeasonalEventCard: React.FC<SeasonalEventCardProps> = ({ userId, compact = false }) => {
  const [events, setEvents] = useState<SeasonalEvent[]>([]);
  const [participations, setParticipations] = useState<Record<string, Participant>>({});
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SeasonalEvent | null>(null);
  const { celebrateMilestone } = useCelebrations();

  useEffect(() => {
    if (!userId) return;
    
    const fetchData = async () => {
      try {
        const [eventsRes, progressRes] = await Promise.all([
          api.get('/seasonal-events/active'),
          api.get('/seasonal-events/my-progress'),
        ]);
        
        setEvents(eventsRes.data.events || []);
        
        const participationsMap: Record<string, Participant> = {};
        for (const p of progressRes.data.participations || []) {
          participationsMap[p.event_id] = p;
        }
        setParticipations(participationsMap);
      } catch (err) {
        console.error('Failed to fetch seasonal events:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId]);

  const handleJoin = async (event: SeasonalEvent) => {
    if (!userId) return;
    setJoining(event.id);
    try {
      const res = await api.post(`/seasonal-events/${event.id}/join`);
      setParticipations(prev => ({
        ...prev,
        [event.id]: res.data.participant,
      }));
      toast.success(`Joined ${event.name}!`);
    } catch (err) {
      toast.error('Failed to join event');
    } finally {
      setJoining(null);
    }
  };

  const handleClaim = async (event: SeasonalEvent) => {
    if (!userId) return;
    setClaiming(event.id);
    try {
      const res = await api.post(`/seasonal-events/${event.id}/claim`);
      setParticipations(prev => ({
        ...prev,
        [event.id]: { ...prev[event.id], reward_claimed: true },
      }));
      
      celebrateMilestone({
        milestone: event.target_value,
        type: 'achievement',
        title: `${event.name} Complete!`,
        description: `You completed the challenge and earned your rewards!`,
        reward: {
          pp: event.reward_pp,
          xp: event.reward_xp,
          badge: event.reward_badge || undefined,
        },
      });
      
      toast.success(`Rewards claimed: +${event.reward_pp} PP, +${event.reward_xp} XP!`, {
        icon: event.reward_badge ? '🏆' : '🎉',
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to claim reward');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) return null;
  if (events.length === 0) return null;

  if (compact) {
    return (
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          {events.map(event => {
            const participation = participations[event.id];
            const isJoined = !!participation;
            const progress = participation ? (participation.progress / event.target_value) * 100 : 0;
            
            return (
              <Chip
                key={event.id}
                icon={<span style={{ fontSize: '14px' }}>{event.icon}</span>}
                label={`${event.name}: ${isJoined ? `${participation.progress}/${event.target_value}` : 'Join!'}`}
                onClick={() => setSelectedEvent(event)}
                sx={{
                  bgcolor: `${event.theme_color}20`,
                  color: event.theme_color,
                  border: `1px solid ${event.theme_color}40`,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
            );
          })}
        </Stack>
        
        {selectedEvent && (
          <EventDetailDialog
            event={selectedEvent}
            participation={participations[selectedEvent.id]}
            isJoined={!!participations[selectedEvent.id]}
            joining={joining === selectedEvent.id}
            claiming={claiming === selectedEvent.id}
            onJoin={() => handleJoin(selectedEvent)}
            onClaim={() => handleClaim(selectedEvent)}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <EmojiEventsIcon sx={{ color: '#F59E0B' }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Seasonal Events
        </Typography>
      </Box>
      
      <Stack spacing={2}>
        {events.map(event => {
          const participation = participations[event.id];
          const isJoined = !!participation;
          const progress = isJoined ? (participation.progress / event.target_value) * 100 : 0;
          const completed = participation?.completed_at;
          const rewardClaimed = participation?.reward_claimed;
          
          return (
            <Box
              key={event.id}
              sx={{
                p: 2.5,
                borderRadius: 3,
                opacity: rewardClaimed ? 0.6 : 1,
                background: rewardClaimed
                  ? 'linear-gradient(135deg, rgba(148,163,184,0.08) 0%, rgba(148,163,184,0.03) 100%)'
                  : `linear-gradient(135deg, ${event.theme_color}15 0%, ${event.theme_color}05 100%)`,
                border: rewardClaimed
                  ? '2px solid rgba(148,163,184,0.25)'
                  : `2px solid ${event.theme_color}30`,
                position: 'relative',
                overflow: 'hidden',
                transition: 'opacity 0.3s, background 0.3s, border-color 0.3s',
              }}
            >
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '2.5rem' }}>{event.icon}</Typography>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: event.theme_color }}>
                      {event.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatTimeLeft(event.ends_at)}
                    </Typography>
                  </Box>
                </Box>
                
                {!isJoined ? (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleJoin(event)}
                    disabled={joining === event.id}
                    sx={{
                      bgcolor: event.theme_color,
                      fontWeight: 700,
                      '&:hover': { bgcolor: event.theme_color },
                    }}
                  >
                    {joining === event.id ? 'Joining...' : 'Join Challenge'}
                  </Button>
                ) : completed && !rewardClaimed ? (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleClaim(event)}
                    disabled={claiming === event.id}
                    sx={{
                      bgcolor: '#22C55E',
                      fontWeight: 700,
                      '&:hover': { bgcolor: '#22C55E' },
                    }}
                  >
                    {claiming === event.id ? 'Claiming...' : '🎁 Claim Reward'}
                  </Button>
                ) : rewardClaimed ? (
                  <Chip
                    label="Claimed ✓"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(148,163,184,0.2)',
                      color: 'rgba(203,213,225,0.75)',
                      fontWeight: 700,
                    }}
                  />
                ) : null}
              </Box>
              
              {/* Description */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {event.description}
              </Typography>
              
              {/* Progress */}
              {isJoined && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Progress: {participation.progress} / {event.target_value} {getMetricLabel(event.target_metric)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: event.theme_color }}>
                      {Math.round(progress)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: `${event.theme_color}20`,
                      '& .MuiLinearProgress-bar': {
                        bgcolor: event.theme_color,
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              )}
              
              {/* Rewards */}
              <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
                {event.reward_pp > 0 && (
                  <Chip
                    size="small"
                    icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
                    label={`+${event.reward_pp} PP`}
                    sx={{
                      bgcolor: 'rgba(245,158,11,0.15)',
                      color: '#F59E0B',
                      fontWeight: 700,
                    }}
                  />
                )}
                {event.reward_xp > 0 && (
                  <Chip
                    size="small"
                    icon={<EmojiEventsIcon sx={{ fontSize: '14px !important' }} />}
                    label={`+${event.reward_xp} XP`}
                    sx={{
                      bgcolor: 'rgba(167,139,250,0.15)',
                      color: '#A78BFA',
                      fontWeight: 700,
                    }}
                  />
                )}
                {event.reward_badge && (
                  <Chip
                    size="small"
                    label={event.reward_badge}
                    sx={{
                      bgcolor: 'rgba(6,182,212,0.15)',
                      color: '#06B6D4',
                      fontWeight: 700,
                    }}
                  />
                )}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

interface EventDetailDialogProps {
  event: SeasonalEvent;
  participation?: Participant;
  isJoined: boolean;
  joining: boolean;
  claiming: boolean;
  onJoin: () => void;
  onClaim: () => void;
  onClose: () => void;
}

const EventDetailDialog: React.FC<EventDetailDialogProps> = ({
  event,
  participation,
  isJoined,
  joining,
  claiming,
  onJoin,
  onClaim,
  onClose,
}) => {
  const progress = isJoined && participation ? (participation.progress / event.target_value) * 100 : 0;
  
  return (
    <Dialog open={!!event} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography sx={{ fontSize: '2rem' }}>{event.icon}</Typography>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{event.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTimeLeft(event.ends_at)}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {event.description}
        </Typography>
        
        {isJoined && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Progress: {participation?.progress} / {event.target_value}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 12,
                borderRadius: 6,
                bgcolor: `${event.theme_color}20`,
                '& .MuiLinearProgress-bar': { bgcolor: event.theme_color },
              }}
            />
          </Box>
        )}
        
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Rewards</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {event.reward_pp > 0 && (
            <Chip label={`+${event.reward_pp} PP`} sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }} />
          )}
          {event.reward_xp > 0 && (
            <Chip label={`+${event.reward_xp} XP`} sx={{ bgcolor: 'rgba(167,139,250,0.15)', color: '#A78BFA' }} />
          )}
          {event.reward_badge && (
            <Chip label={event.reward_badge} sx={{ bgcolor: 'rgba(6,182,212,0.15)', color: '#06B6D4' }} />
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose}>Close</Button>
        {!isJoined ? (
          <Button
            variant="contained"
            onClick={onJoin}
            disabled={joining}
            sx={{ bgcolor: event.theme_color }}
          >
            {joining ? 'Joining...' : 'Join Challenge'}
          </Button>
        ) : participation?.completed_at && !participation.reward_claimed ? (
          <Button
            variant="contained"
            onClick={onClaim}
            disabled={claiming}
            sx={{ bgcolor: '#22C55E' }}
          >
            {claiming ? 'Claiming...' : '🎁 Claim Reward'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};

export default SeasonalEventCard;
