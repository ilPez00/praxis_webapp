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
  [Domain.CAREER]: ['Professional Skillup', 'Project Excellence', 'Job Searching'],
  [Domain.INVESTING]: ['Investment Portfolio', 'Passive Income', 'Emergency Fund'],
  [Domain.FITNESS]: ['Strength Training', 'Cardio Consistency', 'Mobility & Flexibility'],
  [Domain.ACADEMICS]: ['Learning New Skills', 'Reading', 'Courses & Certifications'],
  [Domain.MENTAL_HEALTH]: ['Daily Meditation', 'Journaling Habit', 'Stress Management'],
  [Domain.PHILOSOPHICAL_DEVELOPMENT]: ['Philosophy Study', 'Spiritual Practice', 'Life Alignment'],
  [Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS]: ['Creative Projects', 'Hobby Development', 'Cultural Exploration'],
  [Domain.INTIMACY_ROMANTIC_EXPLORATION]: ['Dating Life', 'Relationship Growth', 'Emotional Connection'],
  [Domain.FRIENDSHIP_SOCIAL_ENGAGEMENT]: ['Expanding Network', 'Deepening Friendships', 'Social Presence'],
  [Domain.PERSONAL_GOALS]: ['Life Adventures', 'Bucket List', 'Personal Milestones'],
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
        console.debug('No existing notebook found:', error);
      }
    };
    init();
  }, []);

  const handleSelectCategory = (domain: Domain, category: string) => {
    setSelectedGoals(prev => {
      if (prev.length >= MAX_FREE_GOALS) return prev;
      if (prev.some(g => g.domain === domain && g.category === category)) return prev;
      const newId = (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `g_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newGoal: SelectedGoal = {
        id: newId,
        domain,
        category,
        customName: category,
        description: '',
        completionMetric: '',
        targetDate: '',
      };
      return [...prev, newGoal];
    });
    // Keep accordion open so user can pick more from same domain
  };

  const handleRemoveGoal = (goalId: string) => {
    setSelectedGoals(prev => prev.filter(g => g.id !== goalId));
  };

  const handleUpdateGoal = (goalId: string, field: 'customName' | 'description' | 'completionMetric' | 'targetDate', value: string) => {
    setSelectedGoals(prev => prev.map(g =>
      g.id === goalId ? { ...g, [field]: value } : g
    ));
  };

  const handleSave = async () => {
    if (!currentUserId || selectedGoals.length === 0) return;

    // During onboarding, only require topic name (not description + metric)
    const isFirstRun = !user?.onboarding_completed;
    if (!isFirstRun) {
      const invalid = selectedGoals.find(g => !g.description.trim() || !g.completionMetric.trim());
      if (invalid) {
        toast.error(`Fill in description and success metric for "${invalid.customName || invalid.category}".`);
        return;
      }
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
        toast.success('Notebook setup complete! Welcome to Praxis. 🎉');
        navigate('/dashboard');
      } else {
        toast.success('Notebook updated!');
        navigate('/notes');
      }
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
  const isFirstRun = !user?.onboarding_completed;

  return (
    <Container component="main" maxWidth="md" sx={{ py: 4, position: 'relative' }}>
      {/* Progress bar: 50-100% of full onboarding flow */}
      {isFirstRun && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100 }}>
          <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.05)' }}>
            <Box sx={{
              height: 4,
              bgcolor: 'primary.main',
              width: '75%',
              boxShadow: '0 0 8px rgba(245,158,11,0.5)',
            }} />
          </Box>
        </Box>
      )}

      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography component="h1" variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 800 }}>
          {isFirstRun ? 'Define Your First Goals' : 'Edit Your Notebook'}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {isFirstRun
            ? 'Pick 1–3 areas of life you want to focus on. You can always add details later.'
            : `Select up to ${MAX_FREE_GOALS} primary topics to organize your life and find aligned partners.`
          }
        </Typography>
        {isFirstRun && (
          <Chip
            label="Step 2 of 2 — Almost there!"
            sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700, fontSize: '0.85rem' }}
          />
        )}
        {!isFirstRun && (
          <Typography variant="h6" sx={{ color: theme.palette.action.active, fontWeight: 700 }}>
            {selectedGoals.length} / {MAX_FREE_GOALS} Topics Selected
          </Typography>
        )}
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
                    required={isFirstRun === false}
                    variant="outlined"
                    margin="dense"
                    label="Description"
                    placeholder={isFirstRun ? "What's this about? (optional, you can add details later)" : "What is this topic about?"}
                    multiline
                    rows={2}
                    value={goal.description}
                    onChange={(e) => handleUpdateGoal(goal.id, 'description', e.target.value)}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    fullWidth
                    required={isFirstRun === false}
                    variant="outlined"
                    margin="dense"
                    label="Success Metric"
                    placeholder={isFirstRun ? "How will you measure progress? (optional)" : "How will you know when this is complete?"}
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
        {isFirstRun && (
          <Button
            variant="text"
            onClick={() => {
              // Complete onboarding without goals — user can add later
              supabase.from('profiles').update({ onboarding_completed: true }).eq('id', currentUserId);
              supabase.auth.updateUser({ data: { onboarding_completed: true } });
              refetch();
              navigate('/dashboard');
            }}
            sx={{ borderRadius: '10px', color: 'text.secondary' }}
          >
            Skip for now
          </Button>
        )}
        {!isFirstRun && (
          <Button
            variant="outlined"
            onClick={() => navigate(-1)}
            sx={{ borderRadius: '10px' }}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || (!isFirstRun && selectedGoals.length === 0)}
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
          {saving ? 'Saving...' : isFirstRun ? `Continue${selectedGoals.length > 0 ? ` with ${selectedGoals.length} topic${selectedGoals.length !== 1 ? 's' : ''}` : ''}` : `Save ${selectedGoals.length} Topics (150 PP)`}
        </Button>
      </Stack>
    </Container>
  );
};

export default GoalSelectionPage;
