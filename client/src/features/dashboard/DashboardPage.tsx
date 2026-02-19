import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { GoalTree } from '../../models/GoalTree';
import { Domain } from '../../models/Domain';
import { Achievement } from '../../models/Achievement';
import { AchievementComment } from '../../models/AchievementComment';
import GlassCard from '../../components/common/GlassCard';

import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Avatar,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  LinearProgress,
  Grid,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StarIcon from '@mui/icons-material/Star';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import PeopleIcon from '@mui/icons-material/People';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExploreIcon from '@mui/icons-material/Explore';
import ChatIcon from '@mui/icons-material/Chat';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface MatchResult {
  userId: string;
  score: number;
}

const DOMAIN_COLORS: Record<Domain, string> = {
  [Domain.CAREER]: '#F59E0B',
  [Domain.INVESTING]: '#3B82F6',
  [Domain.FITNESS]: '#EF4444',
  [Domain.ACADEMICS]: '#8B5CF6',
  [Domain.MENTAL_HEALTH]: '#10B981',
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#EC4899',
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#A855F7',
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#F97316',
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#06B6D4',
};

const DashboardPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comments dialog state
  const [openCommentsDialog, setOpenCommentsDialog] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [comments, setComments] = useState<AchievementComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  // AI Coaching state
  const [aiCoachingResponse, setAiCoachingResponse] = useState<string | null>(null);
  const [aiCoachingLoading, setAiCoachingLoading] = useState(false);
  const [aiCoachingPrompt, setAiCoachingPrompt] = useState('');

  const requestAiCoaching = async () => {
    if (!currentUserId || !aiCoachingPrompt.trim()) {
      alert('Please enter a prompt for AI Coaching.');
      return;
    }
    setAiCoachingLoading(true);
    setAiCoachingResponse(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await axios.post(`${API_URL}/ai-coaching/request`, {
        userPrompt: aiCoachingPrompt,
      }, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      setAiCoachingResponse(response.data.response);
    } catch (error: any) {
      setAiCoachingResponse(`Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setAiCoachingLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setCurrentUserId(authUser?.id);
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const fetchData = async () => {
      setLoadingContent(true);
      try {
        const [goalsRes, matchesRes, achievementsRes] = await Promise.allSettled([
          axios.get(`${API_URL}/goals/${currentUserId}`),
          axios.get(`${API_URL}/matches/${currentUserId}`),
          axios.get(`${API_URL}/achievements`),
        ]);
        if (goalsRes.status === 'fulfilled') setGoalTree(goalsRes.value.data);
        if (matchesRes.status === 'fulfilled') setMatches(matchesRes.value.data.slice(0, 3));
        if (achievementsRes.status === 'fulfilled') setAchievements(achievementsRes.value.data);
      } catch (err) {
        setError('Failed to fetch dashboard data.');
      } finally {
        setLoadingContent(false);
      }
    };
    fetchData();
  }, [currentUserId]);

  const refreshAchievements = async () => {
    try {
      const response = await axios.get(`${API_URL}/achievements`);
      setAchievements(response.data);
    } catch (error) {
      console.error('Error refreshing achievements:', error);
    }
  };

  const handleVote = async (achievementId: string, type: 'upvote' | 'downvote') => {
    if (!currentUserId) return;
    try {
      await axios.post(`${API_URL}/achievements/${achievementId}/votes`, { userId: currentUserId, type });
      refreshAchievements();
    } catch (error) {
      console.error('Error submitting vote:', error);
    }
  };

  const fetchComments = async (achievementId: string) => {
    setCommentsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/achievements/${achievementId}/comments`);
      setComments(response.data);
    } catch (error) {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleOpenComments = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    fetchComments(achievement.id);
    setOpenCommentsDialog(true);
  };

  const handleCloseComments = () => {
    setOpenCommentsDialog(false);
    setSelectedAchievement(null);
    setComments([]);
    setNewCommentText('');
  };

  const handleAddComment = async () => {
    if (!currentUserId || !selectedAchievement || !newCommentText.trim()) return;
    try {
      await axios.post(`${API_URL}/achievements/${selectedAchievement.id}/comments`, {
        userId: currentUserId,
        userName: user?.name,
        userAvatarUrl: user?.avatarUrl,
        content: newCommentText,
      });
      setNewCommentText('');
      fetchComments(selectedAchievement.id);
      refreshAchievements();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (userLoading || loadingContent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const rootGoals = goalTree?.rootNodes || [];
  const allNodes = goalTree?.nodes || [];
  const hasGoals = rootGoals.length > 0;
  const userName = user?.name || 'Explorer';
  const avgProgress = hasGoals
    ? Math.round(rootGoals.reduce((sum, g) => sum + g.progress * 100, 0) / rootGoals.length)
    : 0;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 8 }}>
      <Container maxWidth="xl">
        {/* Welcome Banner */}
        <Box sx={{ py: 4 }}>
          <GlassCard
            sx={{
              p: 4,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(139,92,246,0.1) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
            }}
          >
            <Grid container alignItems="center" spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Typography variant="h3" sx={{ fontWeight: 900, mb: 1.5, letterSpacing: '-0.03em' }}>
                  Greetings, {' '}
                  <Box component="span" sx={{
                    background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)',
                    backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                    {userName}
                  </Box>
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mb: 3 }}>
                  Your journey continues. You've made significant progress across your goal architecture. 
                  Ready to reach the next milestone?
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Chip 
                    icon={<TrackChangesIcon sx={{ color: 'primary.main !important' }} />} 
                    label={`${allNodes.length} Goals`} 
                    sx={{ bgcolor: 'rgba(245,158,11,0.1)', fontWeight: 700, p: 1 }} 
                  />
                  <Chip 
                    icon={<TrendingUpIcon sx={{ color: 'secondary.main !important' }} />} 
                    label={`${avgProgress}% Avg Progress`} 
                    sx={{ bgcolor: 'rgba(139,92,246,0.1)', fontWeight: 700, p: 1 }} 
                  />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', justifyContent: { md: 'flex-end', xs: 'flex-start' } }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h2" sx={{ fontWeight: 900, lineHeight: 1, color: 'primary.main' }}>
                    {avgProgress}<Typography component="span" variant="h5" sx={{ fontWeight: 900, opacity: 0.6 }}>%</Typography>
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.1em', color: 'text.secondary' }}>
                    OVERALL COMPLETION
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </GlassCard>
        </Box>

        {/* Quick Actions Pill Row */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
          <GlassCard 
            sx={{ 
              p: 1, 
              borderRadius: '50px', 
              display: 'flex', 
              gap: 1, 
              background: 'rgba(17,24,39,0.8)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {[
              { label: 'Profile', to: `/profile/${currentUserId}`, icon: <AccountCircleIcon /> },
              { label: 'Goal Tree', to: `/goals/${currentUserId}`, icon: <TrackChangesIcon /> },
              { label: 'Matches', to: '/matches', icon: <ExploreIcon /> },
              { label: 'Chat', to: '/chat', icon: <ChatIcon /> },
            ].map((action) => (
              <Button
                key={action.label}
                component={RouterLink}
                to={action.to}
                variant="text"
                sx={{
                  borderRadius: '40px',
                  px: 3,
                  py: 1,
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'primary.main',
                  }
                }}
                startIcon={action.icon}
              >
                {action.label}
              </Button>
            ))}
          </GlassCard>
        </Box>

        {/* Bento Grid Layout */}
        <Grid container spacing={3}>
          {/* AI Coaching Section */}
          <Grid size={{ xs: 12, md: 7 }}>
            <GlassCard 
              glow="secondary"
              sx={{ 
                p: 4, 
                height: '100%', 
                minHeight: '400px',
                position: 'relative',
                boxShadow: '0 0 40px rgba(139,92,246,0.15)',
              }}
            >
              <Chip 
                label="PREMIUM" 
                size="small" 
                sx={{ 
                  position: 'absolute', 
                  top: 24, 
                  right: 24, 
                  background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)', 
                  color: '#0A0B14', 
                  fontWeight: 800, 
                  fontSize: '0.65rem' 
                }} 
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: '12px', 
                  bgcolor: 'rgba(139,92,246,0.15)', 
                  color: 'secondary.main' 
                }}>
                  <AutoAwesomeIcon />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>AI Performance Coach</Typography>
                  <Typography variant="body2" color="text.secondary">Powered by Gemini Pro</Typography>
                </Box>
              </Box>

              {user?.is_premium ? (
                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    variant="outlined"
                    placeholder="Ask about your strategy, blockers, or next steps..."
                    value={aiCoachingPrompt}
                    onChange={(e) => setAiCoachingPrompt(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: '16px',
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={requestAiCoaching}
                    disabled={aiCoachingLoading || !aiCoachingPrompt.trim()}
                    sx={{ 
                      py: 2, 
                      borderRadius: '16px', 
                      background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                      boxShadow: '0 8px 20px rgba(139,92,246,0.3)',
                      fontWeight: 700
                    }}
                    startIcon={aiCoachingLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
                  >
                    {aiCoachingLoading ? 'Analyzing Performance...' : 'Generate Strategic Insight'}
                  </Button>
                  {aiCoachingResponse && (
                    <Box sx={{ 
                      p: 3, 
                      borderRadius: '16px', 
                      bgcolor: 'rgba(139,92,246,0.05)', 
                      border: '1px solid rgba(139,92,246,0.15)',
                    }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                        {aiCoachingResponse}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              ) : (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '250px',
                  textAlign: 'center'
                }}>
                  <StarIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2, opacity: 0.5 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>Premium AI Insights</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 300 }}>
                    Unlock strategic coaching tailored to your specific goals and progress data.
                  </Typography>
                  <Button 
                    variant="contained" 
                    component={RouterLink} 
                    to="/upgrade" 
                    sx={{ px: 4, borderRadius: '12px' }}
                  >
                    Upgrade to Premium
                  </Button>
                </Box>
              )}
            </GlassCard>
          </Grid>

          {/* Goals Section */}
          <Grid size={{ xs: 12, md: 5 }}>
            <GlassCard sx={{ p: 4, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Core Objectives</Typography>
                <IconButton component={RouterLink} to={`/goals/${currentUserId}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
              
              {hasGoals ? (
                <Stack spacing={2.5}>
                  {rootGoals.map((goal) => (
                    <Box 
                      key={goal.id} 
                      sx={{ 
                        p: 2.5, 
                        borderRadius: '16px', 
                        bgcolor: 'background.paper',
                        borderLeft: `6px solid ${DOMAIN_COLORS[goal.domain]}`,
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateX(4px)' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{goal.name}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: DOMAIN_COLORS[goal.domain] }}>
                          {Math.round(goal.progress * 100)}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={goal.progress * 100} 
                        sx={{ 
                          height: 6, 
                          borderRadius: 3, 
                          bgcolor: 'rgba(255,255,255,0.05)',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: DOMAIN_COLORS[goal.domain],
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                        {goal.domain.toUpperCase()}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No active objectives found.</Typography>
                  <Button component={RouterLink} to={`/goals/${currentUserId}`} sx={{ mt: 2 }}>Initialize Tree</Button>
                </Box>
              )}
            </GlassCard>
          </Grid>

          {/* Matches Section */}
          <Grid size={{ xs: 12, md: 5 }}>
            <GlassCard sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>Top Alignments</Typography>
                <Button component={RouterLink} to="/matches" size="small" variant="text" color="primary">View All</Button>
              </Box>
              
              <Stack spacing={2}>
                {matches.length > 0 ? (
                  matches.map((match) => {
                    const compatibility = Math.round(match.score * 100);
                    const pillColor = compatibility > 70 ? '#10B981' : compatibility > 50 ? '#F59E0B' : '#9CA3AF';
                    
                    return (
                      <Box 
                        key={match.userId}
                        onClick={() => navigate(`/chat/${currentUserId}/${match.userId}`)}
                        sx={{ 
                          p: 2, 
                          borderRadius: '16px', 
                          cursor: 'pointer',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 2,
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.04)',
                            borderColor: 'primary.main',
                          }
                        }}
                      >
                        <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontWeight: 700 }}>
                          {match.userId.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            {match.userId.slice(0, 8)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Active today</Typography>
                        </Box>
                        <Box sx={{ 
                          px: 1.5, 
                          py: 0.5, 
                          borderRadius: '20px', 
                          bgcolor: `${pillColor}15`, 
                          color: pillColor,
                          border: `1px solid ${pillColor}40`,
                          fontSize: '0.75rem',
                          fontWeight: 800
                        }}>
                          {compatibility}% Match
                        </Box>
                      </Box>
                    );
                  })
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    Seeking optimal matches...
                  </Typography>
                )}
              </Stack>
            </GlassCard>
          </Grid>

          {/* Community Achievements Section */}
          <Grid size={{ xs: 12, md: 7 }}>
            <GlassCard sx={{ p: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 4 }}>Global Achievements</Typography>
              <Stack spacing={3}>
                {achievements.slice(0, 3).map((achievement) => (
                  <GlassCard 
                    key={achievement.id}
                    sx={{ 
                      p: 3, 
                      bgcolor: 'rgba(255,255,255,0.01)', 
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '20px'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Avatar 
                        src={achievement.userAvatarUrl || undefined}
                        sx={{ width: 44, height: 44, border: '2px solid rgba(255,255,255,0.1)' }}
                      >
                        {achievement.userName.charAt(0)}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>{achievement.userName}</Typography>
                          <Chip 
                            label={achievement.domain} 
                            size="small" 
                            sx={{ 
                              height: 20, 
                              fontSize: '0.65rem', 
                              fontWeight: 800,
                              bgcolor: `${DOMAIN_COLORS[achievement.domain]}15`,
                              color: DOMAIN_COLORS[achievement.domain],
                            }} 
                          />
                        </Box>
                        <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 800, mb: 0.5 }}>
                          {achievement.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {achievement.description}
                        </Typography>
                        
                        <Stack direction="row" spacing={3}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton size="small" onClick={() => handleVote(achievement.id, 'upvote')} sx={{ p: 0.5 }}>
                              <ThumbUpIcon fontSize="small" sx={{ opacity: 0.7 }} />
                            </IconButton>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{achievement.totalUpvotes}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton size="small" onClick={() => handleOpenComments(achievement)} sx={{ p: 0.5 }}>
                              <ChatBubbleOutlineIcon fontSize="small" sx={{ opacity: 0.7 }} />
                            </IconButton>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>0</Typography>
                          </Box>
                          <Typography variant="caption" sx={{ ml: 'auto', alignSelf: 'center', opacity: 0.5 }}>
                            {new Date(achievement.createdAt).toLocaleDateString()}
                          </Typography>
                        </Stack>
                      </Box>
                    </Box>
                  </GlassCard>
                ))}
              </Stack>
            </GlassCard>
          </Grid>
        </Grid>
      </Container>

      {/* Comments Dialog (Unchanged Logic) */}
      <Dialog open={openCommentsDialog} onClose={handleCloseComments} maxWidth="sm" fullWidth>
        <DialogTitle>
          Insights for "{selectedAchievement?.title}"
          <IconButton
            onClick={handleCloseComments}
            sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {commentsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : comments.length > 0 ? (
            <List>
              {comments.map((comment, index) => (
                <React.Fragment key={comment.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar src={comment.userAvatarUrl || undefined}>{comment.userName.charAt(0)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={700}>{comment.userName}</Typography>}
                      secondary={
                        <>
                          <Typography variant="body2" color="text.primary">{comment.content}</Typography>
                          <Typography variant="caption" color="text.disabled">
                            {new Date(comment.createdAt).toLocaleString()}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                  {index < comments.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Be the first to share an insight.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <TextField
            fullWidth variant="outlined" size="small" placeholder="Add a comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
          />
          <Button variant="contained" onClick={handleAddComment} endIcon={<SendIcon />}>Post</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardPage;
