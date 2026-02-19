import React, { useState, useEffect } from 'react';
import { useUser } from '../hooks/useUser';
import axios from 'axios';
import { GoalTree } from '../models/GoalTree'; // Type definition for GoalTree structure
import { GoalNode } from '../models/GoalNode'; // Type definition for individual goal nodes
import { Domain, exampleGoalTreeData } from '../types/goal'; // Enum for various goal domains, and example data
import { useParams } from 'react-router-dom'; // Hook to access URL parameters
import GoalTreeComponent from '../components/GoalTree/GoalTreeComponent'; // New GoalTreeComponent

import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';

/**
 * @description Page component for displaying a user's goal tree.
 * Now uses the new GoalTreeComponent for visualization.
 */
const GoalTreePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useUser(); // Get authenticated user and premium status

  const [loading, setLoading] = useState(true); // State to manage overall loading status
  const [error, setError] = useState<string | null>(null); // State to store error messages

  // For demonstration, we will use exampleGoalTreeData directly.
  // In a real application, you would fetch this data from a backend.
  useEffect(() => {
    // Simulate loading data
    setLoading(true);
    setError(null);
    try {
      // Here you would typically fetch data based on `id`
      // For now, we just use the example data
      if (!id) {
        throw new Error("User ID is missing.");
      }
      // Assuming exampleGoalTreeData represents a user's tree
      // In a real app, filter/process exampleGoalTreeData based on 'id' if multiple users
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
        Your Goal Tree
      </Typography>

      <GoalTreeComponent data={exampleGoalTreeData} />
    </Container>
  );
};

export default GoalTreePage;
