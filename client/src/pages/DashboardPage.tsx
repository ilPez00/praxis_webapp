import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../hooks/useUser';
import { supabase } from '../lib/supabase';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';
import { Achievement } from '../models/Achievement'; // Import Achievement model
import { AchievementComment } from '../models/AchievementComment'; // Import AchievementComment model

import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
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
  useTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';

// Interface for match results, typically including user ID and a compatibility score
interface MatchResult {
  userId: string;
  score: number;
}

// Map domain enum values to specific Material-UI colors for consistent styling
const DOMAIN_COLORS: Record<Domain, string> = {
  [Domain.CAREER]: '#4CAF50',
  [Domain.INVESTING]: '#26A69A',
  [Domain.FITNESS]: '#E57373',
  [Domain.ACADEMICS]: '#EC407A',
  [Domain.MENTAL_HEALTH]: '#64B5F6',
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: '#78909C',
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: '#9CCC65',
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: '#FFA726',
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: '#AB47BC',
};

/**
 * @description Dashboard page component for authenticated users.
 * Displays user's goal overview, top matches, community achievements, and quick actions.
 * Integrates conditional UI for premium features.
 */
const DashboardPage: React.FC = () => {
  const theme = useTheme(); // Access the Material-UI theme for styling
  const { user, loading: userLoading } = useUser(); // Custom hook to get authenticated user data
  const navigate = useNavigate(); // Hook for programmatic navigation

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined); // State for the current user's ID
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null); // State for the user's goal tree
  const [matches, setMatches] = useState<MatchResult[]>([]); // State for top matched users
  const [achievements, setAchievements] = useState<Achievement[]>([]); // State for community achievements
  const [loadingContent, setLoadingContent] = useState(true); // State to manage content loading
  const [error, setError] = useState<string | null>(null); // State to store error messages

  // States for comments dialog
  const [openCommentsDialog, setOpenCommentsDialog] = useState(false); // Controls visibility of comments dialog
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null); // Stores the achievement selected for comments
  const [comments, setComments] = useState<AchievementComment[]>([]); // Stores comments for the selected achievement
  const [newCommentText, setNewCommentText] = useState(''); // State for the new comment input
  const [commentsLoading, setCommentsLoading] = useState(false); // State to manage comments loading

  // Effect to set the current user ID once authentication is resolved
  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setCurrentUserId(authUser?.id);
    };
    fetchUserId();
  }, []); // Runs once on component mount

  // Effect to fetch dashboard data (goal tree, matches, achievements)
  useEffect(() => {
    if (!currentUserId) return; // Only fetch if currentUserId is available

    const fetchData = async () => {
      setLoadingContent(true); // Start loading
      try {
        // Fetch all data concurrently using Promise.allSettled for robust error handling
        const [goalsRes, matchesRes, achievementsRes] = await Promise.allSettled([
          axios.get(`http://localhost:3001/goals/${currentUserId}`), // Fetch user's goal tree
          axios.get(`http://localhost:3001/matches/${currentUserId}`), // Fetch user's matches
          axios.get(`http://localhost:3001/achievements`), // Fetch all community achievements
        ]);

        // Process results for goals
        if (goalsRes.status === 'fulfilled') {
          setGoalTree(goalsRes.value.data);
        } else {
          console.error('Error fetching goals:', goalsRes.reason);
        }

        // Process results for matches (limit to top 3 for dashboard display)
        if (matchesRes.status === 'fulfilled') {
          setMatches(matchesRes.value.data.slice(0, 3));
        } else {
          console.error('Error fetching matches:', matchesRes.reason);
        }

        // Process results for achievements
        if (achievementsRes.status === 'fulfilled') {
          setAchievements(achievementsRes.value.data);
        } else {
          console.error('Error fetching achievements:', achievementsRes.reason);
        }
      } catch (err) {
        setError('Failed to fetch dashboard data.'); // Catch any unexpected errors
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoadingContent(false); // End loading
      }
    };

    fetchData(); // Execute data fetching
  }, [currentUserId]); // Re-fetch if currentUserId changes

  /**
   * @description Refreshes the list of community achievements.
   */
  const refreshAchievements = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/achievements`);
      setAchievements(response.data);
    } catch (error) {
      console.error('Error refreshing achievements:', error);
    }
  };

  /**
   * @description Handles upvoting or downvoting an achievement.
   * @param achievementId - The ID of the achievement being voted on.
   * @param type - The type of vote ('upvote' or 'downvote').
   */
  const handleVote = async (achievementId: string, type: 'upvote' | 'downvote') => {
    if (!currentUserId) {
      alert('Please log in to vote.'); // Prompt user to log in if not authenticated
      return;
    }
    try {
      // Send a POST request to the backend to record the vote
      await axios.post(`http://localhost:3001/achievements/${achievementId}/votes`, {
        userId: currentUserId,
        type,
      });
      refreshAchievements(); // Refresh achievements to update vote counts on UI
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Failed to submit vote.');
    }
  };

  /**
   * @description Fetches comments for a specific achievement.
   * @param achievementId - The ID of the achievement to fetch comments for.
   */
  const fetchComments = async (achievementId: string) => {
    setCommentsLoading(true); // Start loading comments
    try {
      // Fetch comments from the backend
      const response = await axios.get(`http://localhost:3001/achievements/${achievementId}/comments`);
      setComments(response.data); // Update comments state
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]); // Clear comments on error
    } finally {
      setCommentsLoading(false); // End loading comments
    }
  };

  /**
   * @description Opens the comments dialog and fetches comments for the selected achievement.
   * @param achievement - The achievement object for which comments are to be displayed.
   */
  const handleOpenComments = (achievement: Achievement) => {
    setSelectedAchievement(achievement); // Set the achievement to display comments for
    fetchComments(achievement.id); // Fetch comments for this achievement
    setOpenCommentsDialog(true); // Open the dialog
  };

  /**
   * @description Closes the comments dialog and resets related states.
   */
  const handleCloseComments = () => {
    setOpenCommentsDialog(false); // Close the dialog
    setSelectedAchievement(null); // Clear selected achievement
    setComments([]); // Clear comments
    setNewCommentText(''); // Clear new comment input
  };

  /**
   * @description Adds a new comment to the currently selected achievement.
   */
  const handleAddComment = async () => {
    // Validate that user is logged in, an achievement is selected, and comment text is not empty
    if (!currentUserId || !selectedAchievement || !newCommentText.trim()) {
      alert('Comment cannot be empty.');
      return;
    }
    try {
      // Send POST request to backend to add comment
      await axios.post(`http://localhost:3001/achievements/${selectedAchievement.id}/comments`, {
        userId: currentUserId,
        userName: user?.name, // Pass current user's name (denormalized)
        userAvatarUrl: user?.avatarUrl, // Pass current user's avatar (denormalized)
        content: newCommentText, // The comment text
      });
      setNewCommentText(''); // Clear the input field
      fetchComments(selectedAchievement.id); // Refresh comments in dialog to show new comment
      refreshAchievements(); // Optionally refresh achievements on dashboard if comment counts are shown there
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment.');
    }
  };

  // Display loading spinner while user data or main content is loading
  if (userLoading || loadingContent) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Display error message if content loading failed
  if (error) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  // Derived state for rendering
  const rootGoals = goalTree?.rootNodes || [];
  const allNodes = goalTree?.nodes || [];
  const hasGoals = rootGoals.length > 0;
  const userName = user?.name || 'there';

  // Calculate average progress across root goals
  const avgProgress = hasGoals
    ? Math.round(rootGoals.reduce((sum, g) => sum + g.progress * 100, 0) / rootGoals.length)
    : 0;

  // Count unique domains represented in the user's goal tree
  const activeDomains = new Set(allNodes.map(n => n.domain)).size;

  return (
    <Container component="main" maxWidth="lg" sx={{ mt: 4 }}>
      {/* Welcome Section: Greets the user and provides a summary of their goals */}
      <Paper elevation={3} sx={{ p: 4, mb: 4, bgcolor: theme.palette.background.paper }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main' }}>
          Welcome back, {userName} ⚡
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {hasGoals
            ? `${allNodes.length} goals across ${activeDomains} domain${activeDomains !== 1 ? 's' : ''} · ${avgProgress}% average progress`
            : 'Start building your goal tree to find meaningful connections.'}
        </Typography>
      </Paper>

      {/* Premium Upgrade Section: Conditionally displayed if the user is not a premium member */}
      {!user?.is_premium && (
        <Paper elevation={3} sx={{ p: 3, mb: 4, bgcolor: theme.palette.warning.light, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: theme.palette.warning.contrastText }}>
              Unlock Premium Features!
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.warning.contrastText }}>
              Get unlimited matches, advanced goal insights, and more.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="warning"
            component={RouterLink}
            to="/upgrade"
            sx={{ ml: 2, bgcolor: theme.palette.warning.dark }}
          >
            Upgrade Now
          </Button>
        </Paper>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
        {/* Left Column: Contains user's goals overview and top matches */}
        <Box sx={{ flex: 1 }}>
          {/* Your Goals Overview Section */}
          <Paper elevation={3} sx={{ p: 3, mb: 4, bgcolor: theme.palette.background.paper }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" component="h2" sx={{ color: 'primary.main' }}>Your Goals</Typography>
              <Button component={RouterLink} to={`/goals/${currentUserId}`} variant="outlined" startIcon={<EditIcon />}>
                {hasGoals ? 'Edit Goals' : 'Create Goals'}
              </Button>
            </Box>
            {hasGoals ? (
              // Display each root goal with its domain, progress, and actions
              <Stack spacing={2}>
                {rootGoals.map((goal) => (
                  <Paper key={goal.id} variant="outlined" sx={{ p: 2, borderColor: DOMAIN_COLORS[goal.domain] }}>
                    <Typography variant="h6" sx={{ color: 'primary.main' }}>{goal.name}</Typography>
                    <Chip
                      label={goal.domain}
                      size="small"
                      sx={{
                        backgroundColor: `${DOMAIN_COLORS[goal.domain]}15`,
                        color: DOMAIN_COLORS[goal.domain],
                        fontWeight: 'bold',
                        mb: 1
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">Progress:</Typography>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <CircularProgress variant="determinate" value={goal.progress * 100} size={24} thickness={5} />
                      </Box>
                      <Typography variant="body2" color="text.secondary">{Math.round(goal.progress * 100)}%</Typography>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            ) : (
              // Prompt to create goals if none exist
              <Alert severity="info">No goals yet. Define your goals to start matching!</Alert>
            )}
          </Paper>

          {/* Top Matches Section */}
          <Paper elevation={3} sx={{ p: 3, bgcolor: theme.palette.background.paper }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" component="h2" sx={{ color: 'primary.main' }}>Top Matches</Typography>
              <Button component={RouterLink} to="/matches" variant="outlined">
                View All →
              </Button>
            </Box>
            {matches.length > 0 ? (
              // Display a list of top matches
              <Stack spacing={2}>
                {matches.map((match) => (
                  <Paper
                    key={match.userId}
                    variant="outlined"
                    sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: theme.palette.action.hover } }}
                    onClick={() => navigate(`/chat/${currentUserId}/${match.userId}`)} // Navigate to chat with match
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {/* Avatar for the matched user */}
                      <Avatar sx={{ bgcolor: theme.palette.action.active }}>
                        {match.userId.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" sx={{ color: 'primary.main' }}>User {match.userId.slice(0, 8)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {Math.round(match.score * 100)}% Compatible
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            ) : (
              // Message if no matches are found
              <Alert severity="info">
                {hasGoals
                  ? 'Waiting for other users with similar goals to join.'
                  : 'Set up your goals first to start finding matches.'}
              </Alert>
            )}
          </Paper>
        </Box>

        {/* Right Column: Community Achievements */}
        <Box sx={{ flex: 1 }}>
          <Paper elevation={3} sx={{ p: 3, bgcolor: theme.palette.background.paper }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ color: 'primary.main' }}>
              Community Achievements
            </Typography>
            {achievements.length > 0 ? (
              // Display a list of community achievements
              <Stack spacing={3}>
                {achievements.map((achievement) => (
                  <Paper key={achievement.id} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      {/* User avatar for the achiever */}
                      <Avatar src={achievement.userAvatarUrl || undefined} sx={{ bgcolor: theme.palette.secondary.main, color: theme.palette.primary.main }}>
                        {achievement.userName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {achievement.userName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Achieved on {new Date(achievement.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="h6" sx={{ color: 'primary.main', mt: 1 }}>
                      {achievement.title}
                    </Typography>
                    <Chip
                      label={achievement.domain}
                      size="small"
                      sx={{
                        backgroundColor: `${DOMAIN_COLORS[achievement.domain]}15`,
                        color: DOMAIN_COLORS[achievement.domain],
                        fontWeight: 'bold',
                        mb: 1
                      }}
                    />
                    {achievement.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {achievement.description}
                      </Typography>
                    )}

                    <Divider sx={{ my: 1 }} /> {/* Separator for actions */}
                    <Stack direction="row" spacing={1} alignItems="center">
                      {/* Upvote button and count */}
                      <IconButton size="small" onClick={() => handleVote(achievement.id, 'upvote')}>
                        <ThumbUpIcon fontSize="small" />
                      </IconButton>
                      <Typography variant="body2" color="text.secondary">{achievement.totalUpvotes}</Typography>
                      {/* Downvote button and count */}
                      <IconButton size="small" onClick={() => handleVote(achievement.id, 'downvote')}>
                        <ThumbDownIcon fontSize="small" />
                      </IconButton>
                      <Typography variant="body2" color="text.secondary">{achievement.totalDownvotes}</Typography>
                      {/* Comments button */}
                      <Button
                        size="small"
                        startIcon={<ChatBubbleOutlineIcon />}
                        onClick={() => handleOpenComments(achievement)}
                        sx={{ ml: 'auto' }}
                      >
                        Comments
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              // Message if no community achievements exist
              <Alert severity="info">No community achievements yet. Be the first to complete a goal!</Alert>
            )}
          </Paper>
        </Box>
      </Stack>

      {/* Quick Actions Section */}
      <Paper elevation={3} sx={{ p: 3, mt: 4, bgcolor: theme.palette.background.paper }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ color: 'primary.main' }}>Quick Actions</Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button
            component={RouterLink} to={`/profile/${currentUserId}`} variant="outlined"
            startIcon={<Avatar sx={{ width: 24, height: 24, bgcolor: theme.palette.grey[400] }}>👤</Avatar>}
          >
            Profile
          </Button>
          <Button
            component={RouterLink} to={`/goals/${currentUserId}`} variant="outlined"
            startIcon={<Avatar sx={{ width: 24, height: 24, bgcolor: theme.palette.grey[400] }}>🌳</Avatar>}
          >
            Goal Tree
          </Button>
          <Button
            component={RouterLink} to="/matches" variant="outlined"
            startIcon={<Avatar sx={{ width: 24, height: 24, bgcolor: theme.palette.grey[400] }}>🔍</Avatar>}
          >
            Find Matches
          </Button>
          <Button
            component={RouterLink} to="/chat" variant="outlined"
            startIcon={<Avatar sx={{ width: 24, height: 24, bgcolor: theme.palette.grey[400] }}>💬</Avatar>}
          >
            Messages
          </Button>
        </Stack>
      </Paper>


      {/* Comments Dialog: Displays and allows adding comments for a selected achievement */}
      <Dialog open={openCommentsDialog} onClose={handleCloseComments} maxWidth="sm" fullWidth>
        <DialogTitle>
          Comments for "{selectedAchievement?.title}"
          <IconButton
            aria-label="close"
            onClick={handleCloseComments}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {commentsLoading ? (
            // Show loading spinner if comments are being fetched
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : comments.length > 0 ? (
            // Display list of comments
            <List>
              {comments.map((comment, index) => (
                <React.Fragment key={comment.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemAvatar>
                      {/* Commenter's avatar */}
                      <Avatar alt={comment.userName} src={comment.userAvatarUrl || undefined} sx={{ bgcolor: theme.palette.secondary.main, color: theme.palette.primary.main }}>
                        {comment.userName.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        // Commenter's name
                        <Typography
                          sx={{ display: 'inline' }}
                          component="span"
                          variant="body2"
                          color="text.primary"
                          fontWeight="bold"
                        >
                          {comment.userName}
                        </Typography>
                      }
                      secondary={
                        <React.Fragment>
                          {/* Comment content */}
                          <Typography
                            sx={{ display: 'block' }}
                            component="span"
                            variant="body2"
                            color="text.secondary"
                          >
                            {comment.content}
                          </Typography>
                          {/* Comment timestamp */}
                          <Typography variant="caption" color="text.disabled">
                            {new Date(comment.createdAt).toLocaleString()}
                          </Typography>
                        </React.Fragment>
                      }
                    />
                  </ListItem>
                  {/* Add divider between comments */}
                  {index < comments.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            // Message if no comments exist yet
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No comments yet. Be the first to comment!
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {/* Textfield for new comment input */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Add a comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddComment()} // Send on Enter key
            size="small"
            sx={{ mr: 1 }}
          />
          {/* Button to post the new comment */}
          <Button variant="contained" onClick={handleAddComment} endIcon={<SendIcon />} sx={{ bgcolor: theme.palette.action.active }}>
            Post
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default DashboardPage;
