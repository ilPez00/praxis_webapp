import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';
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

// Suggested topics per domain (Maslow Levels)
const DOMAIN_CATEGORIES: Record<Domain, string[]> = {
  [Domain.BODY_FITNESS]: ['Strength Training', 'Cardio Consistency', 'Mobility & Flexibility', 'Sport Performance'],
  [Domain.REST_RECOVERY]: ['Sleep Optimization', 'Scheduled Downtime', 'Digital Detox'],
  [Domain.MENTAL_BALANCE]: ['Daily Meditation', 'Journaling Habit', 'Stress Management'],
  [Domain.ENVIRONMENT_HOME]: ['Home Organization', 'Workspace Setup', 'Sustainable Living'],
  [Domain.HEALTH_LONGEVITY]: ['Nutritional Base', 'Supplements & Biohacking', 'Regular Checkups'],
  [Domain.FINANCIAL_SECURITY]: ['Emergency Fund', 'Debt Elimination', 'Insurance Coverage'],
  [Domain.FRIENDSHIP_SOCIAL]: ['Expanding Network', 'Deepening Friendships', 'Social Presence'],
  [Domain.ROMANCE_INTIMACY]: ['Dating Life', 'Relationship Growth', 'Emotional Connection'],
  [Domain.COMMUNITY_CONTRIBUTION]: ['Volunteering', 'Mentoring Others', 'Local Impact'],
  [Domain.CAREER_CRAFT]: ['Professional Skillup', 'Project Excellence', 'Job Searching'],
  [Domain.WEALTH_ASSETS]: ['Investment Portfolio', 'Passive Income', 'Asset Acquisition'],
  [Domain.GAMING_ESPORTS]: ['Rank Progression', 'Competitive Play', 'Content Creation'],
  [Domain.IMPACT_LEGACY]: ['Building a Brand', 'Public Speaking', 'Open Source Work'],
  [Domain.SPIRIT_PURPOSE]: ['Spiritual Practice', 'Philosophy Study', 'Life Alignment'],
};

const MAX_FREE_GOALS = 3;

interface SelectedGoal {
  id: string;
  domain: Domain;
  category: string;
  customName: string;
  description: string;
  completionMetric: string;
  targetDate: string;
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

  useEffect(() => {
    if (userLoading || !user) return;
    const isReEdit = user.onboarding_completed === true;
    const editCount = user.goal_tree_edit_count ?? 0;

    if (isReEdit && editCount >= 3 && !user.is_premium && !user.is_admin) {
      toast.error("You've used your free notebook edits. Upgrade to Premium for unlimited changes.");
      navigate('/upgrade');
      return;
    }

    if (isReEdit && !user.is_admin) {
      toast(`✏️ Editing your notebook setup costs 150 PP.`, {
        duration: 6000,
        style: { maxWidth: 400 },
      });
    }
  }, [user, userLoading, navigate]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const uid = authUser?.id || '1';
      setCurrentUserId(uid);

      try {
        const res = await api.get(`/goals/${uid}`);
        const tree: GoalTree = res.data;
        setExistingTree(tree);

        if (tree.root_nodes && tree.root_nodes.length > 0) {
          const converted: SelectedGoal[] = tree.root_nodes.map((node: any) => ({
            id: node.id,
            domain: node.domain,
            category: node.category || node.name,
            customName: node.name,
            description: node.customDetails || '',
            completionMetric: node.completionMetric || '',
            targetDate: node.targetDate || '',
          }));
          setSelectedGoals(converted);
        }
      } catch (error) {
        console.log('No existing notebook found:', error);
      }
    };
    init();
  }, []);

  const handleSelectCategory = (domain: Domain, category: string) => {
    if (!canAddMore) return;
    if (selectedGoals.some(g => g.domain === domain && g.category === category)) return;

    const newGoal: SelectedGoal = {
      id: Math.random().toString(36).substring(2, 9),
      domain,
      category,
      customName: category,
      description: '',
      completionMetric: '',
      targetDate: '',
    };

    setSelectedGoals([...selectedGoals, newGoal]);
    setExpandedDomain(null);
  };

  const handleRemoveGoal = (goalId: string) => {
    setSelectedGoals(selectedGoals.filter(g => g.id !== goalId));
  };

  const handleUpdateGoal = (goalId: string, field: 'customName' | 'description' | 'completionMetric' | 'targetDate', value: string) => {
    setSelectedGoals(selectedGoals.map(g =>
      g.id === goalId ? { ...g, [field]: value } : g
    ));
  };

  const handleSave = async () => {
    if (!currentUserId || selectedGoals.length === 0) return;

    const invalid = selectedGoals.find(g => !g.description.trim() || !g.completionMetric.trim());
    if (invalid) {
      toast.error(`Fill in description and success metric for "${invalid.customName || invalid.category}".`);
      return;
    }

    setSaving(true);

    try {
      const nodes: GoalNode[] = selectedGoals.map((g) => ({
        id: g.id,
        domain: g.domain,
        title: g.customName || g.category,
        name: g.customName || g.category,
        weight: 1.0,
        progress: 0,
        category: g.category,
        customDetails: g.description || undefined,
        completionMetric: g.completionMetric || undefined,
        targetDate: g.targetDate || undefined,
        parentId: undefined,
        children: [],
      }));

      const existingSubGoals = (existingTree?.nodes || []).filter(n => n.parentId);
      const validSubGoals = existingSubGoals.filter(sub =>
        nodes.some(n => n.id === sub.parentId)
      );

      const allNodes = [...nodes, ...validSubGoals];

      await api.post('/goals', {
        nodes: allNodes,
        root_nodes: nodes,
      });

      if (!user?.onboarding_completed) {
        await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', currentUserId);
        await supabase.auth.updateUser({ data: { onboarding_completed: true } });
        await refetch();
      }

      navigate(`/notes`);
    } catch (err: any) {
      console.error('Failed to save notebook:', err);
      const msg = err.response?.data?.message || 'Failed to save notebook. Please try again.';
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
        <Typography component="h1" variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 800 }}>
          Setup your Notebook
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Select up to {MAX_FREE_GOALS} primary topics to organize your life and find aligned partners.
        </Typography>
        <Typography variant="h6" sx={{ color: theme.palette.action.active, fontWeight: 700 }}>
          {selectedGoals.length} / {MAX_FREE_GOALS} Topics Selected
        </Typography>
      </Box>

      {selectedGoals.length > 0 && (
        <Paper elevation={1} sx={{ p: 3, mb: 4, borderRadius: '16px' }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 800 }}>
            Selected Topics
          </Typography>
          <Stack spacing={2}>
            {selectedGoals.map((goal) => (
              <Paper key={goal.id} variant="outlined" sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                borderColor: DOMAIN_COLORS[goal.domain],
                borderLeft: '8px solid',
                borderRadius: '12px',
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
                      aria-label="remove"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    label="Topic Name"
                    value={goal.customName}
                    onChange={(e) => handleUpdateGoal(goal.id, 'customName', e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    required
                    variant="outlined"
                    margin="dense"
                    label="Description *"
                    placeholder="What is this topic about?"
                    multiline
                    rows={2}
                    value={goal.description}
                    onChange={(e) => handleUpdateGoal(goal.id, 'description', e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    required
                    variant="outlined"
                    margin="dense"
                    label="Success Metric *"
                    placeholder="How will you know when this topic is complete?"
                    multiline
                    rows={2}
                    value={goal.completionMetric}
                    onChange={(e) => handleUpdateGoal(goal.id, 'completionMetric', e.target.value)}
                    sx={{ mb: 1 }}
                  />
                </Box>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 800 }}>
          {selectedGoals.length > 0 ? 'Add More Topics' : 'Pick a Life Domain'}
        </Typography>
        <Stack spacing={1}>
          {Object.values(Domain).map((domain) => {
            const isExpanded = expandedDomain === domain;
            const alreadySelectedCount = selectedGoals.filter(g => g.domain === domain).length;

            return (
              <Paper key={domain} elevation={1} sx={{ p: 2, borderRadius: '12px' }}>
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
                  <Typography variant="h6" component="span" sx={{ flexGrow: 1, fontWeight: 700 }}>
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
                              color: isAlreadyPicked ? '#000' : DOMAIN_COLORS[domain],
                              backgroundColor: isAlreadyPicked ? DOMAIN_COLORS[domain] : 'transparent',
                              fontWeight: 700,
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
          onClick={() => navigate(-1)}
          sx={{ borderRadius: '10px' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={selectedGoals.length === 0 || saving}
          sx={{
            borderRadius: '10px',
            px: 4,
            fontWeight: 800,
            backgroundColor: 'primary.main',
            color: '#000',
            '&:hover': {
              backgroundColor: 'primary.light',
            },
          }}
        >
          {saving ? 'Saving...' : `Save ${selectedGoals.length} Topics ${user?.onboarding_completed ? '(150 PP)' : '(Free)'}`}
        </Button>
      </Stack>
    </Container>
  );
};

export default GoalSelectionPage;
