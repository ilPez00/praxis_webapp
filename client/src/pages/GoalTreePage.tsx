import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import { Domain } from '../models/Domain';
import { useParams } from 'react-router-dom';
import { GoalTreeDisplay } from '../components/GoalTreeDisplay';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider, // Import Slider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete'; // Import DeleteIcon

const GoalTreePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalDomain, setNewGoalDomain] = useState<Domain>(Domain.CAREER);

  const [editingGoal, setEditingGoal] = useState<GoalNode | null>(null);
  const [editedGoalName, setEditedGoalName] = useState('');
  const [editedGoalDomain, setEditedGoalDomain] = useState<Domain>(Domain.CAREER);
  const [editedCustomDetails, setEditedCustomDetails] = useState(''); // New state
  const [editedCategory, setEditedCategory] = useState('');           // New state
  const [editedProgress, setEditedProgress] = useState<number>(0);    // New state
  const [editedWeight, setEditedWeight] = useState<number>(1.0);      // New state

  const [addingSubGoalTo, setAddingSubGoalTo] = useState<string | null>(null);
  const [newSubGoalName, setNewSubGoalName] = useState('');
  const [newSubGoalDomain, setNewSubGoalDomain] = useState<Domain>(Domain.CAREER);
  const [newSubGoalCustomDetails, setNewSubGoalCustomDetails] = useState(''); // New state
  const [newSubGoalCategory, setNewSubGoalCategory] = useState('');           // New state


  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);


  useEffect(() => {
    const fetchGoalTree = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/goals/${id}`);
        setGoalTree(response.data);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setGoalTree({ id: 'new', userId: id || '', nodes: [], rootNodes: [] });
        } else {
          setError('Failed to fetch goal tree.');
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchGoalTree();
    }
  }, [id]);

  const handleAddGoal = async () => {
    if (!id || !newGoalName.trim()) {
      alert('Goal name cannot be empty.');
      return;
    }

    const newGoal: GoalNode = {
      id: Math.random().toString(36).substring(7),
      name: newGoalName,
      domain: newGoalDomain,
      progress: 0,
      weight: 1.0,
      parentId: undefined, // Root goal
      customDetails: '',
      category: '',
    };

    const updatedNodes = goalTree ? [...goalTree.nodes, newGoal] : [newGoal];
    const updatedRootNodes = goalTree ? [...goalTree.rootNodes, newGoal] : [newGoal];

    try {
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: updatedRootNodes,
      });
      setGoalTree(response.data);
      setNewGoalName('');
    } catch (err) {
      setError('Failed to add new goal.');
      console.error(err);
    }
  };

  const handleEdit = (node: GoalNode) => {
    setEditingGoal(node);
    setEditedGoalName(node.name);
    setEditedGoalDomain(node.domain);
    setEditedCustomDetails(node.customDetails || ''); // Populate new state
    setEditedCategory(node.category || '');           // Populate new state
    setEditedProgress(node.progress * 100 || 0);      // Populate new state (0-100)
    setEditedWeight(node.weight || 1.0);              // Populate new state
  };

  const handleSaveEdit = async () => {
    if (!editingGoal || !editedGoalName.trim()) {
      alert('Edited goal name cannot be empty.');
      return;
    }

    const updatedNodes = goalTree?.nodes.map((node) =>
      node.id === editingGoal.id ? {
        ...node,
        name: editedGoalName,
        domain: editedGoalDomain,
        customDetails: editedCustomDetails,
        category: editedCategory,
        progress: editedProgress / 100, // Convert back to 0-1
        weight: editedWeight,
      } : node
    ) || [];

    const updatedRootNodes = goalTree?.rootNodes.map((node) =>
      node.id === editingGoal.id ? {
        ...node,
        name: editedGoalName,
        domain: editedGoalDomain,
        customDetails: editedCustomDetails,
        category: editedCategory,
        progress: editedProgress / 100, // Convert back to 0-1
        weight: editedWeight,
      } : node
    ) || [];

    try {
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: updatedRootNodes,
      });
      setGoalTree(response.data);
      setEditingGoal(null); // Exit editing mode
      setEditedGoalName('');
      setEditedCustomDetails('');
      setEditedCategory('');
      setEditedProgress(0);
      setEditedWeight(1.0);
    } catch (err) {
      setError('Failed to save edited goal.');
      console.error(err);
    }
  };

  const handleAddSubGoal = (parentId: string) => {
    setAddingSubGoalTo(parentId);
    setNewSubGoalName('');
    setNewSubGoalDomain(Domain.CAREER);
    setNewSubGoalCustomDetails(''); // Initialize new state
    setNewSubGoalCategory('');     // Initialize new state
  };

  const handleSaveSubGoal = async () => {
    if (!id || !addingSubGoalTo || !newSubGoalName.trim()) {
      alert('Sub-goal name cannot be empty.');
      return;
    }

    const newSubGoal: GoalNode = {
      id: Math.random().toString(36).substring(7),
      name: newSubGoalName,
      domain: newSubGoalDomain,
      progress: 0,
      weight: 1.0,
      parentId: addingSubGoalTo,
      customDetails: newSubGoalCustomDetails, // Include new fields
      category: newSubGoalCategory,           // Include new fields
    };

    const updatedNodes = goalTree ? [...goalTree.nodes, newSubGoal] : [newSubGoal];
    // Sub-goals are not root nodes, so rootNodes remain unchanged

    try {
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: goalTree?.rootNodes || [], // rootNodes remain the same
      });
      setGoalTree(response.data);
      setAddingSubGoalTo(null); // Exit adding sub-goal mode
      setNewSubGoalName('');
      setNewSubGoalCustomDetails(''); // Clear new state
      setNewSubGoalCategory('');     // Clear new state
    } catch (err) {
      setError('Failed to add sub-goal.');
      console.error(err);
    }
  };

  const handleDeleteGoal = (nodeId: string) => {
    setGoalToDelete(nodeId);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!id || !goalToDelete) {
      return;
    }

    // Helper to recursively get all descendant IDs of a node
    const getDescendantIds = (currentNodeId: string, allNodes: GoalNode[]): string[] => {
      const directChildren = allNodes.filter(node => node.parentId === currentNodeId);
      const descendantIds: string[] = [];
      directChildren.forEach(child => {
        descendantIds.push(child.id, ...getDescendantIds(child.id, allNodes));
      });
      return descendantIds;
    };

    const nodesToDelete = [goalToDelete, ...getDescendantIds(goalToDelete, goalTree?.nodes || [])];

    const updatedNodes = goalTree?.nodes.filter(node => !nodesToDelete.includes(node.id)) || [];
    const updatedRootNodes = goalTree?.rootNodes.filter(node => !nodesToDelete.includes(node.id)) || [];

    try {
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: updatedRootNodes,
      });
      setGoalTree(response.data);
      setConfirmDeleteOpen(false);
      setGoalToDelete(null);
    } catch (err) {
      setError('Failed to delete goal.');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main' }}>
        Goal Tree for User {id}
      </Typography>

      <Box sx={{ mb: 4, p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="h5" component="h2" gutterBottom>Add New Goal</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="New Goal Name"
            variant="outlined"
            value={newGoalName}
            onChange={(e) => setNewGoalName(e.target.value)}
            fullWidth
            size="small"
          />
          <FormControl variant="outlined" sx={{ minWidth: 120 }} size="small">
            <InputLabel>Domain</InputLabel>
            <Select
              value={newGoalDomain}
              onChange={(e) => setNewGoalDomain(e.target.value as Domain)}
              label="Domain"
            >
              {Object.values(Domain).map((domain) => (
                <MenuItem key={domain} value={domain}>
                  {domain}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddGoal}
            sx={{ flexShrink: 0 }}
          >
            Add Goal
          </Button>
        </Stack>
      </Box>

      {/* Edit Goal Dialog */}
      <Dialog open={!!editingGoal} onClose={() => setEditingGoal(null)}>
        <DialogTitle>Edit Goal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Goal Name"
              variant="outlined"
              value={editedGoalName}
              onChange={(e) => setEditedGoalName(e.target.value)}
              fullWidth
              size="small"
            />
            <FormControl variant="outlined" fullWidth size="small">
              <InputLabel>Domain</InputLabel>
              <Select
                value={editedGoalDomain}
                onChange={(e) => setEditedGoalDomain(e.target.value as Domain)}
                label="Domain"
              >
                {Object.values(Domain).map((domain) => (
                  <MenuItem key={domain} value={domain}>
                    {domain}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Custom Details"
              variant="outlined"
              value={editedCustomDetails}
              onChange={(e) => setEditedCustomDetails(e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <TextField
              label="Category"
              variant="outlined"
              value={editedCategory}
              onChange={(e) => setEditedCategory(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Progress (%)"
              variant="outlined"
              type="number"
              value={editedProgress}
              onChange={(e) => setEditedProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
              fullWidth
              size="small"
              inputProps={{ min: 0, max: 100 }}
            />
            <TextField
              label="Weight"
              variant="outlined"
              type="number"
              value={editedWeight}
              onChange={(e) => setEditedWeight(Number(e.target.value))}
              fullWidth
              size="small"
              inputProps={{ step: 0.1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingGoal(null)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Add Sub-Goal Dialog */}
      <Dialog open={!!addingSubGoalTo} onClose={() => setAddingSubGoalTo(null)}>
        <DialogTitle>Add Sub-Goal to {goalTree?.nodes.find(node => node.id === addingSubGoalTo)?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="New Sub-Goal Name"
              variant="outlined"
              value={newSubGoalName}
              onChange={(e) => setNewSubGoalName(e.target.value)}
              fullWidth
              size="small"
            />
            <FormControl variant="outlined" fullWidth size="small">
              <InputLabel>Domain</InputLabel>
              <Select
                value={newSubGoalDomain}
                onChange={(e) => setNewSubGoalDomain(e.target.value as Domain)}
                label="Domain"
              >
                {Object.values(Domain).map((domain) => (
                  <MenuItem key={domain} value={domain}>
                    {domain}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Custom Details"
              variant="outlined"
              value={newSubGoalCustomDetails}
              onChange={(e) => setNewSubGoalCustomDetails(e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <TextField
              label="Category"
              variant="outlined"
              value={newSubGoalCategory}
              onChange={(e) => setNewSubGoalCategory(e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddingSubGoalTo(null)}>Cancel</Button>
          <Button onClick={handleSaveSubGoal} variant="contained" color="primary">Add Sub-Goal</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for Delete */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this goal and all its sub-goals? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {goalTree && goalTree.rootNodes.length > 0 ? (
        <GoalTreeDisplay
          goalTree={goalTree}
          onEdit={handleEdit}
          onAddSubGoal={handleAddSubGoal}
          onDelete={handleDeleteGoal} // Pass handleDeleteGoal
        />
      ) : (
        <Alert severity="info">No goals in your tree yet. Use the form above to add your first goal!</Alert>
      )}
    </Container>
  );
};

export default GoalTreePage;
