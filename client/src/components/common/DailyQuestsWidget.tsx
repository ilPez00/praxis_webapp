/**
 * DailyQuestsWidget Component
 * Displays user's daily quests with progress and claim buttons
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import hotToast from 'react-hot-toast';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Button,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ForumIcon from '@mui/icons-material/Forum';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WhatshotIcon from '@mui/icons-material/Whatshot';

interface Quest {
  quest_id: string;
  quest_type: string;
  title: string;
  description: string;
  xp_reward: number;
  pp_reward: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
}

const QUEST_ICONS: Record<string, React.ReactNode> = {
  check_in: <LocalFireDepartmentIcon sx={{ fontSize: 20 }} />,
  log_tracker: <EditNoteIcon sx={{ fontSize: 20 }} />,
  journal_entry: <EditNoteIcon sx={{ fontSize: 20 }} />,
  give_honor: <ThumbUpIcon sx={{ fontSize: 20 }} />,
  comment_post: <ForumIcon sx={{ fontSize: 20 }} />,
  create_post: <AddCircleIcon sx={{ fontSize: 20 }} />,
  complete_goal: <VerifiedUserIcon sx={{ fontSize: 20 }} />,
  win_bet: <WhatshotIcon sx={{ fontSize: 20 }} />,
  help_peer: <VerifiedUserIcon sx={{ fontSize: 20 }} />,
  streak_milestone: <LocalFireDepartmentIcon sx={{ fontSize: 20 }} />,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22C55E',
  medium: '#F59E0B',
  hard: '#F97316',
  legendary: '#A78BFA',
};

const DailyQuestsWidget: React.FC = () => {
  const navigate = useNavigate();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const fetchQuests = async (signal?: AbortSignal) => {
    try {
      const { data } = await api.get('/gamification/quests', { signal });
      setQuests(data.quests || []);
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Failed to fetch quests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchQuests();
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchQuests(controller.signal);
    return () => controller.abort();
  }, []);

  const handleClaimReward = async (quest: Quest) => {
    if (!quest.completed || quest.claimed) return;

    setClaiming(quest.quest_id);
    try {
      const { data } = await api.post(`/gamification/quests/${quest.quest_id}/claim`);
      
      if (data.success) {
        hotToast.success(
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Quest Completed!
            </Typography>
            <Typography variant="body2">
              +{data.xp_earned} XP | +{data.pp_earned} PP
            </Typography>
          </Box>
        );
        
        // Refresh quests
        await fetchQuests();
      }
    } catch (error: any) {
      hotToast.error(error.response?.data?.message || 'Failed to claim reward');
    } finally {
      setClaiming(null);
    }
  };

  const getProgressPercent = (quest: Quest) => {
    return Math.min(100, Math.round((quest.progress / quest.target) * 100));
  };

  const completedCount = quests.filter(q => q.completed && !q.claimed).length;
  const totalCount = quests.length;

  if (loading) {
    return (
      <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">
            Loading daily quests...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        bgcolor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'rgba(245,158,11,0.1)',
          borderBottom: '1px solid rgba(245,158,11,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEventsIcon sx={{ color: '#F59E0B', fontSize: 22 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F59E0B' }}>
            Daily Quests
          </Typography>
          {completedCount > 0 && (
            <Chip
              label={`${completedCount}/${totalCount}`}
              size="small"
              sx={{
                bgcolor: '#F59E0B',
                color: '#000',
                fontWeight: 700,
                fontSize: '0.7rem',
              }}
            />
          )}
        </Box>
        <Tooltip title="Refresh quests">
          <IconButton size="small" onClick={handleRefresh} sx={{ color: '#F59E0B' }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Quests List */}
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={2}>
          {quests.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No quests available today. Check back tomorrow!
            </Typography>
          ) : (
            quests.map((quest) => (
              <Box
                key={quest.quest_id}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: quest.completed
                    ? 'rgba(34,197,94,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  border: quest.completed
                    ? '1px solid rgba(34,197,94,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {/* Quest Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box
                    sx={{
                      color: quest.completed
                        ? '#22C55E'
                        : DIFFICULTY_COLORS[quest.difficulty],
                    }}
                  >
                    {QUEST_ICONS[quest.quest_type] || <EmojiEventsIcon />}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: quest.completed ? '#22C55E' : 'text.primary',
                      }}
                    >
                      {quest.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      {quest.description}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Chip
                      label={`+${quest.xp_reward} XP`}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(167,139,250,0.2)',
                        color: '#A78BFA',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                      }}
                    />
                    <Chip
                      label={`+${quest.pp_reward} PP`}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(245,158,11,0.2)',
                        color: '#F59E0B',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                </Box>

                {/* Progress Bar */}
                <Box sx={{ mb: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={getProgressPercent(quest)}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: quest.completed
                          ? '#22C55E'
                          : DIFFICULTY_COLORS[quest.difficulty],
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    {quest.progress} / {quest.target}
                  </Typography>
                </Box>

                {/* Action Button */}
                {quest.completed && !quest.claimed ? (
                  <Button
                    size="small"
                    variant="contained"
                    fullWidth
                    onClick={() => handleClaimReward(quest)}
                    disabled={claiming === quest.quest_id}
                    startIcon={<CheckCircleIcon />}
                    sx={{
                      bgcolor: '#22C55E',
                      color: '#fff',
                      fontWeight: 700,
                      '&:hover': { bgcolor: '#16A34A' },
                    }}
                  >
                    Claim Reward
                  </Button>
                ) : quest.claimed ? (
                  <Chip
                    label="Claimed ✓"
                    size="small"
                    sx={{
                      bgcolor: 'rgba(34,197,94,0.2)',
                      color: '#22C55E',
                      fontWeight: 600,
                    }}
                  />
                ) : (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic' }}
                  >
                    Complete to earn rewards
                  </Typography>
                )}
              </Box>
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default DailyQuestsWidget;
