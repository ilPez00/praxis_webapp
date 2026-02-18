import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GoalTree } from '../models/GoalTree'; // Type definition for GoalTree structure
import { GoalNode } from '../models/GoalNode'; // Type definition for individual goal nodes
import { Domain } from '../models/Domain'; // Enum for various goal domains
import { useParams } from 'react-router-dom'; // Hook to access URL parameters
import { GoalTreeDisplay } from '../components/GoalTreeDisplay'; // Component to visualize the goal tree
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
  Slider, // Import Slider (currently unused, but kept from previous refactor)
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete'; // Icon for delete action

/**
 * @description Page component for displaying and editing a user's goal tree.
 * Allows users to add, edit, and delete goals and sub-goals.
 */
const GoalTreePage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Extract userId from URL parameters
  const [goalTree, setGoalTree] = useState<GoalTree | null>(null); // State to store the fetched goal tree
  const [loading, setLoading] = useState(true); // State to manage overall loading status
  const [error, setError] = useState<string | null>(null); // State to store error messages

  // States for adding a new root goal
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalDomain, setNewGoalDomain] = useState<Domain>(Domain.CAREER);

  // States for editing an existing goal
  const [editingGoal, setEditingGoal] = useState<GoalNode | null>(null); // Stores the goal being edited
  const [editedGoalName, setEditedGoalName] = useState('');
  const [editedGoalDomain, setEditedGoalDomain] = useState<Domain>(Domain.CAREER);
  const [editedCustomDetails, setEditedCustomDetails] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [editedProgress, setEditedProgress] = useState<number>(0); // Progress in 0-100 range
  const [editedWeight, setEditedWeight] = useState<number>(1.0);
  const [editedPrerequisiteGoalIds, setEditedPrerequisiteGoalIds] = useState<string[]>([]); // State for prerequisites

  // States for adding a sub-goal
  const [addingSubGoalTo, setAddingSubGoalTo] = useState<string | null>(null); // Parent goal ID for new sub-goal
  const [newSubGoalName, setNewSubGoalName] = useState('');
  const [newSubGoalDomain, setNewSubGoalDomain] = useState<Domain>(Domain.CAREER);
  const [newSubGoalCustomDetails, setNewSubGoalCustomDetails] = useState('');
  const [newSubGoalCategory, setNewSubGoalCategory] = useState('');
  const [newSubGoalPrerequisiteGoalIds, setNewSubGoalPrerequisiteGoalIds] = useState<string[]>([]); // State for sub-goal prerequisites

  // States for delete confirmation dialog
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null);

  // Effect to fetch the goal tree when the component mounts or userId changes
  useEffect(() => {
    const fetchGoalTree = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/goals/${id}`);
        setGoalTree(response.data);
      } catch (err) {
        // If goal tree not found (404), initialize an empty tree structure
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setGoalTree({ id: 'new', userId: id || '', nodes: [], rootNodes: [] });
        } else {
          setError('Failed to fetch goal tree.');
          console.error(err);
        }
      } finally {
        setLoading(false); // Stop loading regardless of success or failure
      }
    };

    if (id) {
      fetchGoalTree(); // Fetch only if a user ID is available
    }
  }, [id]); // Dependency array: re-run effect if 'id' changes

  /**
   * @description Handles adding a new root goal to the tree.
   * Sends the updated tree to the backend.
   */
  const handleAddGoal = async () => {
    if (!id || !newGoalName.trim()) {
      alert('Goal name cannot be empty.');
      return;
    }

    // Create a new GoalNode object
    const newGoal: GoalNode = {
      id: Math.random().toString(36).substring(7), // Generate a unique ID
      name: newGoalName,
      domain: newGoalDomain,
      progress: 0,
      weight: 1.0,
      parentId: undefined, // Root goal has no parent
      customDetails: '',
      category: '',
    };

    // Update local state with the new goal
    const updatedNodes = goalTree ? [...goalTree.nodes, newGoal] : [newGoal];
    const updatedRootNodes = goalTree ? [...goalTree.rootNodes, newGoal] : [newGoal];

    try {
      // Send the updated goal tree to the backend for persistence
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: updatedRootNodes,
      });
      setGoalTree(response.data); // Update state with the backend's response
      setNewGoalName(''); // Clear the input field
    } catch (err) {
      setError('Failed to add new goal.');
      console.error(err);
    }
  };

  /**
   * @description Initiates the editing process for a selected goal node.
   * Populates the editing dialog with the node's current values.
   * @param node - The GoalNode object to be edited.
   */
  const handleEdit = (node: GoalNode) => {
    setEditingGoal(node); // Set the goal to be edited
    setEditedGoalName(node.name);
    setEditedGoalDomain(node.domain);
    setEditedCustomDetails(node.customDetails || '');
    setEditedCategory(node.category || '');
    setEditedProgress(node.progress * 100 || 0); // Convert 0-1 to 0-100 for display
    setEditedWeight(node.weight || 1.0);
  };

  /**
   * @description Handles saving the changes made to an edited goal node.
   * Sends the updated tree to the backend.
   */
  const handleSaveEdit = async () => {
    if (!editingGoal || !editedGoalName.trim()) {
      alert('Edited goal name cannot be empty.');
      return;
    }

    // Create a new array of nodes with the edited goal updated
    const updatedNodes = goalTree?.nodes.map((node) =>
      node.id === editingGoal.id ? {
        ...node,
        name: editedGoalName,
        domain: editedGoalDomain,
        customDetails: editedCustomDetails,
        category: editedCategory,
        progress: editedProgress / 100, // Convert 0-100 back to 0-1 for storage
        weight: editedWeight,
      } : node
    ) || [];

    // Also update root nodes if the edited goal was a root node
    const updatedRootNodes = goalTree?.rootNodes.map((node) =>
      node.id === editingGoal.id ? {
        ...node,
        name: editedGoalName,
        domain: editedGoalDomain,
        customDetails: editedCustomDetails,
        category: editedCategory,
        progress: editedProgress / 100,
        weight: editedWeight,
      } : node
    ) || [];

    try {
      // Send the updated goal tree to the backend
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: updatedRootNodes,
      });
      setGoalTree(response.data); // Update state with backend's response
      setEditingGoal(null); // Close the editing dialog
      // Clear editing states
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

  /**
   * @description Initiates the process of adding a sub-goal to a specified parent goal.
   * @param parentId - The ID of the parent goal.
   */
  const handleAddSubGoal = (parentId: string) => {
    setAddingSubGoalTo(parentId); // Set the parent goal ID
    // Initialize sub-goal creation states
    setNewSubGoalName('');
    setNewSubGoalDomain(Domain.CAREER);
    setNewSubGoalCustomDetails('');
    setNewSubGoalCategory('');
  };

  /**
   * @description Handles saving a new sub-goal.
   * Sends the updated tree to the backend.
   */
  const handleSaveSubGoal = async () => {
    if (!id || !addingSubGoalTo || !newSubGoalName.trim()) {
      alert('Sub-goal name cannot be empty.');
      return;
    }

    // Create a new GoalNode for the sub-goal
    const newSubGoal: GoalNode = {
      id: Math.random().toString(36).substring(7),
      name: newSubGoalName,
      domain: newSubGoalDomain,
      progress: 0,
      weight: 1.0,
      parentId: addingSubGoalTo, // Assign the parent ID
      customDetails: newSubGoalCustomDetails,
      category: newSubGoalCategory,
    };

    // Add the new sub-goal to the list of all nodes
    const updatedNodes = goalTree ? [...goalTree.nodes, newSubGoal] : [newSubGoal];
    // Root nodes remain unchanged as sub-goals are not root nodes

    try {
      // Send the updated goal tree to the backend
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: goalTree?.rootNodes || [],
      });
      setGoalTree(response.data); // Update state with backend's response
      setAddingSubGoalTo(null); // Close the add sub-goal dialog
      // Clear sub-goal creation states
      setNewSubGoalName('');
      setNewSubGoalCustomDetails('');
      setNewSubGoalCategory('');
    } catch (err) {
      setError('Failed to add sub-goal.');
      console.error(err);
    }
  };

  /**
   * @description Opens a confirmation dialog before deleting a goal.
   * @param nodeId - The ID of the goal to be deleted.
   */
  const handleDeleteGoal = (nodeId: string) => {
    setGoalToDelete(nodeId); // Store the ID of the goal to be deleted
    setConfirmDeleteOpen(true); // Open the confirmation dialog
  };

  /**
   * @description Confirms and executes the deletion of a goal and its descendants.
   * Sends the updated tree to the backend.
   */
  const confirmDelete = async () => {
    if (!id || !goalToDelete) {
      return;
    }

    // Helper function to recursively find all descendant IDs of a node
    const getDescendantIds = (currentNodeId: string, allNodes: GoalNode[]): string[] => {
      const directChildren = allNodes.filter(node => node.parentId === currentNodeId);
      const descendantIds: string[] = [];
      directChildren.forEach(child => {
        descendantIds.push(child.id, ...getDescendantIds(child.id, allNodes));
      });
      return descendantIds;
    };

    // Get all nodes (including the target node) that need to be deleted
    const nodesToDelete = [goalToDelete, ...getDescendantIds(goalToDelete, goalTree?.nodes || [])];

    // Filter out the nodes marked for deletion from the main nodes array
    const updatedNodes = goalTree?.nodes.filter(node => !nodesToDelete.includes(node.id)) || [];
    // Also remove deleted nodes from the rootNodes list if they were root nodes
    const updatedRootNodes = goalTree?.rootNodes.filter(node => !nodesToDelete.includes(node.id)) || [];

    try {
      // Send the updated (deleted) goal tree to the backend
      const response = await axios.post(`http://localhost:3001/goals`, {
        userId: id,
        nodes: updatedNodes,
        rootNodes: updatedRootNodes,
      });
      setGoalTree(response.data); // Update state with backend's response
      setConfirmDeleteOpen(false); // Close confirmation dialog
      setGoalToDelete(null); // Clear the goal to delete
    } catch (err) {
      setError('Failed to delete goal.');
      console.error(err);
    }
  };

  // Display loading spinner while data is being fetched
  if (loading) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Display error message if fetching failed
  if (error) {
    return (
      <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  // Render the Goal Tree management UI
  return (
    <Container component="main" maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main' }}>
        Goal Tree for User {id}
      </Typography>

      {/* Section for adding a new root goal */}
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

      {/* Dialog for editing an existing goal */}
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
            {/* Multi-select for choosing prerequisite goals */}
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel>Prerequisite Goals</InputLabel>
              <Select
                multiple
                value={editedPrerequisiteGoalIds}
                onChange={(e) => setEditedPrerequisiteGoalIds(e.target.value as string[])}
                // Render selected chips for better UX
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      // Display goal name for the selected ID
                      <Chip key={value} label={goalTree?.nodes.find(n => n.id === value)?.name || value} />
                    ))}
                  </Box>
                )}
                label="Prerequisite Goals"
              >
                {/* Populate menu items with all available goals except the one being edited */}
                {goalTree?.nodes
                  .filter(node => node.id !== editingGoal?.id) // Cannot be a prerequisite for itself
                  .map((node) => (
                    <MenuItem key={node.id} value={node.id}>
                      {node.name} ({node.domain})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingGoal(null)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for adding a sub-goal to an existing goal */}
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
            {/* Multi-select for choosing prerequisite goals for the sub-goal */}
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel>Prerequisite Goals</InputLabel>
              <Select
                multiple
                value={newSubGoalPrerequisiteGoalIds}
                onChange={(e) => setNewSubGoalPrerequisiteGoalIds(e.target.value as string[])}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={goalTree?.nodes.find(n => n.id === value)?.name || value} />
                    ))}
                  </Box>
                )}
                label="Prerequisite Goals"
              >
                {/* Populate menu items with all available goals, filtering out the parent goal itself */}
                {goalTree?.nodes
                  .filter(node => node.id !== addingSubGoalTo) // Cannot be a prerequisite for itself or its parent
                  .map((node) => (
                    <MenuItem key={node.id} value={node.id}>
                      {node.name} ({node.domain})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddingSubGoalTo(null)}>Cancel</Button>
          <Button onClick={handleSaveSubGoal} variant="contained" color="primary">Add Sub-Goal</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog for deleting a goal */}
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

      {/* Display the Goal Tree using the GoalTreeDisplay component */}
      {goalTree && goalTree.rootNodes.length > 0 ? (
        <GoalTreeDisplay
          goalTree={goalTree}
          onEdit={handleEdit}
          onAddSubGoal={handleAddSubGoal}
          onDelete={handleDeleteGoal} // Pass the delete handler
        />
      ) : (
        // Message displayed if no goals are in the tree yet
        <Alert severity="info">No goals in your tree yet. Use the form above to add your first goal!</Alert>
      )}
    </Container>
  );
};

export default GoalTreePage;
