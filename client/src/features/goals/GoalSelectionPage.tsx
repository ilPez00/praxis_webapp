import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';
import toast from 'react-hot-toast';
import { Domain } from '../../models/Domain';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../types/goal';
import { GoalTree } from '../../models/GoalTree';
import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  Chip,
  IconButton,
  TextField,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';

// Suggested goal categories per domain
const DOMAIN_CATEGORIES: Record<Domain, string[]> = {
  [Domain.CAREER]: [
    'Get Promoted', 'Switch Careers', 'Start a Business',
    'Build Network', 'Learn New Skills', 'Freelance Work',
  ],
  [Domain.INVESTING]: [
    'Build Portfolio', 'Learn Trading', 'Real Estate',
    'Retirement Planning', 'Passive Income', 'Budgeting',
  ],
  [Domain.FITNESS]: [
    'Lose Weight', 'Build Muscle', 'Run a Marathon',
    'Yoga Practice', 'Sports Training', 'Nutrition Plan',
  ],
  [Domain.ACADEMICS]: [
    'Get a Degree', 'Learn a Language', 'Research Project',
    'Online Courses', 'Certifications', 'Study Group',
  ],
  [Domain.MENTAL_HEALTH]: [
    'Meditation', 'Therapy', 'Stress Management',
    'Better Sleep', 'Journaling', 'Mindfulness',
  ],
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: [
    'Reading Philosophy', 'Ethical Living', 'Self-Reflection',
    'Stoicism Practice', 'Writing Essays', 'Discussion Groups',
  ],
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: [
    'Learn Music', 'Photography', 'Painting',
    'Creative Writing', 'Film Making', 'Cooking',
  ],
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: [
    'Dating', 'Strengthen Relationship', 'Communication Skills',
    'Vulnerability Practice', 'Shared Activities', 'Boundaries',
  ],
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: [
    'Make New Friends', 'Community Service', 'Social Events',
    'Reconnect Old Friends', 'Group Activities', 'Mentoring',
  ],
};

const MAX_FREE_GOALS = 3;

interface SelectedGoal {
  id: string;
  domain: Domain;
  category: string;
  customName: string;
  details: string;
}

const GoalSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, loading: userLoading, refetch } = useUser();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [expandedDomain, setExpandedDomain] = useState<Domain | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<SelectedGoal[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingTree, setExistingTree] = useState<GoalTree | null>(null);

  // Gate: free re-edit notification and premium gate
  useEffect(() => {
    if (userLoading || !user) return;

    const isReEdit = user.onboarding_completed === true;
    const editCount = user.goal_tree_edit_count ?? 0;

    if (isReEdit && editCount >= 1 && !user.is_premium && !user.is_admin) {
      // Re-edit limit reached — redirect to upgrade
      toast.error("You've used your free goal tree edit. Upgrade to Premium for unlimited changes.");
      navigate('/upgrade');
      return;
    }

    if (isReEdit && editCount === 0 && !user.is_admin) {
      // Warn: this is the one free re-edit
      toast('✏️ You have 1 free goal tree edit. Future changes will require Premium.', {
        duration: 6000,
        style: { maxWidth: 400 },
      });
    }
  }, [user, userLoading, navigate]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const uid = authUser?.id || '1'; // Fallback for dev
      setCurrentUserId(uid);

      // Load existing goals if any
      try {
        const res = await axios.get(`${API_URL}/goals/${uid}`);
        const tree: GoalTree = res.data;
        setExistingTree(tree);

        // Convert existing root nodes into selected goals for editing
        if (tree.rootNodes && tree.rootNodes.length > 0) {
          const converted: SelectedGoal[] = tree.rootNodes.map((node) => ({
            id: node.id,
            domain: node.domain,
            category: node.category || node.name,
            customName: node.name,
            details: node.customDetails || '',
          }));
          setSelectedGoals(converted);
        }
      } catch (error) {
        // No existing tree — that's fine for first-time users
        console.log('No existing goal tree found:', error);
      }
    };
    init();
  }, []);

  const handleSelectCategory = (domain: Domain, category: string) => {
    if (!canAddMore) return; // Prevent adding if max reached

    // Don't add duplicates
    if (selectedGoals.some(g => g.domain === domain && g.category === category)) return;

    const newGoal: SelectedGoal = {
      id: Math.random().toString(36).substring(2, 9),
      domain,
      category,
      customName: category,
      details: '',
    };

    setSelectedGoals([...selectedGoals, newGoal]);
    setExpandedDomain(null); // Collapse domain after selection
  };

  const handleRemoveGoal = (goalId: string) => {
    setSelectedGoals(selectedGoals.filter(g => g.id !== goalId));
  };

  const handleUpdateGoal = (goalId: string, field: 'customName' | 'details', value: string) => {
    setSelectedGoals(selectedGoals.map(g =>
      g.id === goalId ? { ...g, [field]: value } : g
    ));
  };

  const handleSave = async () => {
    if (!currentUserId || selectedGoals.length === 0) return;
    setSaving(true);

    try {
      // Build GoalNode array from selected goals
      const nodes: GoalNode[] = selectedGoals.map((g) => ({
        id: g.id,
        domain: g.domain,
        title: g.customName || g.category,
        name: g.customName || g.category,
        weight: 1.0,
        progress: 0,
        category: g.category,
        customDetails: g.details || undefined,
        parentId: undefined,
        children: [],
      }));

      // Preserve existing sub-goals if we have an existing tree
      const existingSubGoals = (existingTree?.nodes || []).filter(n => n.parentId);
      // Only keep sub-goals whose parent still exists
      const validSubGoals = existingSubGoals.filter(sub =>
        nodes.some(n => n.id === sub.parentId)
      );

      const allNodes = [...nodes, ...validSubGoals];

      await axios.post(`${API_URL}/goals`, {
        userId: currentUserId,
        nodes: allNodes,
        rootNodes: nodes,
      });

      // Mark onboarding complete if this is the first goal tree setup.
      // Uses the backend endpoint (service-role key) to bypass RLS on profiles.
      if (!user?.onboarding_completed) {
        await axios.post(`${API_URL}/users/complete-onboarding`, { userId: currentUserId });
        await refetch(); // sync useUser cache before navigating to a guarded route
      }

      navigate(`/goals/${currentUserId}`);
    } catch (err: any) {
      console.error('Failed to save goals:', err);
      const msg = err.response?.data?.message || 'Failed to save goals. Please try again.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleDomain = (domain: Domain) => {
    setExpandedDomain(expandedDomain === domain ? null : domain);
  };

  const canAddMore = selectedGoals.length < MAX_FREE_GOALS;

  return (
    <Container component="main" maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography component="h1" variant="h4" gutterBottom sx={{ color: 'primary.main' }}>
          Choose Your Goals
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Select up to {MAX_FREE_GOALS} primary goals from any domain.
          You can customize names and add details to refine your matches.
        </Typography>
        <Typography variant="h6" sx={{ color: theme.palette.action.active }}>
          {selectedGoals.length} / {MAX_FREE_GOALS} Goals Selected
        </Typography>
      </Box>

      {selectedGoals.length > 0 && (
        <Paper elevation={1} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main' }}>
            Selected Goals
          </Typography>
          <Stack spacing={2}>
            {selectedGoals.map((goal) => (
              <Paper key={goal.id} variant="outlined" sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                borderColor: DOMAIN_COLORS[goal.domain],
                borderLeft: '8px solid',
              }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Chip
                      label={`${DOMAIN_ICONS[goal.domain]} ${goal.domain}`}
                      sx={{
                        backgroundColor: `${DOMAIN_COLORS[goal.domain]}15`,
                        color: DOMAIN_COLORS[goal.domain],
                        fontWeight: 'bold',
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveGoal(goal.id)}
                      aria-label="remove goal"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    label="Goal Name"
                    value={goal.customName}
                    onChange={(e) => handleUpdateGoal(goal.id, 'customName', e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    label="Details (optional)"
                    multiline
                    rows={2}
                    value={goal.details}
                    onChange={(e) => handleUpdateGoal(goal.id, 'details', e.target.value)}
                  />
                </Box>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ color: 'primary.main' }}>
          {selectedGoals.length > 0 ? 'Add More Goals' : 'Pick a Domain'}
        </Typography>
        <Stack spacing={1}>
          {Object.values(Domain).map((domain) => {
            const isExpanded = expandedDomain === domain;
            const alreadySelectedCount = selectedGoals.filter(g => g.domain === domain).length;

            return (
              <Paper key={domain} elevation={1} sx={{ p: 2 }}>
                <Button
                  fullWidth
                  variant="text"
                  onClick={() => toggleDomain(domain)}
                  disabled={!canAddMore && !isExpanded}
                  sx={{
                    justifyContent: 'flex-start',
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    }
                  }}
                >
                  <Box sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: DOMAIN_COLORS[domain],
                    mr: 1,
                  }} />
                  <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
                    {DOMAIN_ICONS[domain]} {domain}
                    {alreadySelectedCount > 0 && (
                      <Chip
                        label={`${alreadySelectedCount} selected`}
                        size="small"
                        sx={{ ml: 1, backgroundColor: `${DOMAIN_COLORS[domain]}15`, color: DOMAIN_COLORS[domain] }}
                      />
                    )}
                  </Typography>
                  <IconButton size="small" sx={{ color: 'text.secondary' }}>
                    {isExpanded ? <RemoveIcon /> : <AddIcon />}
                  </IconButton>
                </Button>

                {isExpanded && (
                  <Box sx={{ mt: 2, pl: 4, pr: 2 }}>
                    <Stack direction="row" flexWrap="wrap" spacing={1}>
                      {DOMAIN_CATEGORIES[domain].map((cat) => {
                        const isAlreadyPicked = selectedGoals.some(
                          g => g.domain === domain && g.category === cat
                        );
                        return (
                          <Chip
                            key={cat}
                            label={cat}
                            onClick={() => handleSelectCategory(domain, cat)}
                            disabled={isAlreadyPicked || !canAddMore}
                            variant={isAlreadyPicked ? 'filled' : 'outlined'}
                            color={isAlreadyPicked ? 'primary' : 'default'}
                            sx={{
                              borderColor: DOMAIN_COLORS[domain],
                              color: isAlreadyPicked ? theme.palette.common.white : DOMAIN_COLORS[domain],
                              backgroundColor: isAlreadyPicked ? DOMAIN_COLORS[domain] : 'transparent',
                              '&:hover': {
                                backgroundColor: isAlreadyPicked ? DOMAIN_COLORS[domain] : `${DOMAIN_COLORS[domain]}15`,
                              },
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      </Box>

      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate(-1)}
          sx={{ borderRadius: 0 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={selectedGoals.length === 0 || saving}
          sx={{
            borderRadius: 0,
            backgroundColor: theme.palette.action.active,
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          {saving ? 'Saving...' : `Save ${selectedGoals.length} Goal${selectedGoals.length !== 1 ? 's' : ''}`}
        </Button>
      </Stack>
    </Container>
  );
};

export default GoalSelectionPage;
