import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { GoalNode as FrontendGoalNode, DOMAIN_COLORS, Domain } from '../../types/goal';
import GoalTreeComponent from './components/GoalTreeComponent';
import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';

/**
 * Maps a flat array of backend GoalNodes (with parentId) into the hierarchical
 * tree structure expected by GoalTreeComponent (with children arrays).
 * Also converts: name→title, progress 0-1→0-100, domain string→Domain enum.
 */
function buildFrontendTree(backendNodes: any[]): FrontendGoalNode[] {
  // Map each backend node to the frontend shape
  const nodeMap = new Map<string, FrontendGoalNode>();
  for (const n of backendNodes) {
    nodeMap.set(n.id, {
      id: n.id,
      title: n.name,
      description: n.customDetails,
      weight: Math.round(n.weight * 100) / 100,
      progress: Math.round(n.progress * 100),
      domain: n.domain as Domain,
      children: [],
    });
  }

  const roots: FrontendGoalNode[] = [];
  for (const n of backendNodes) {
    const node = nodeMap.get(n.id)!;
    if (n.parentId && nodeMap.has(n.parentId)) {
      nodeMap.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * @description Page component that displays a user's goal tree fetched from the backend.
 * Uses the GoalTreeComponent for hierarchical visualization.
 */
const GoalTreePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: authUser } = useUser();

  const [treeData, setTreeData] = useState<FrontendGoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoalTree = async () => {
      // Determine which user's tree to show: URL param or current authenticated user
      let userId = id;
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      }
      if (!userId) {
        setError('Could not determine user ID.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_URL}/goals/${userId}`);
        const goalTree = response.data;
        // goalTree = { id, userId, nodes: GoalNode[], rootNodes: GoalNode[] }
        const allNodes: any[] = goalTree.nodes || [];
        setTreeData(buildFrontendTree(allNodes));
      } catch (err: any) {
        if (err.response?.status === 404) {
          // User has no goals yet — not an error, just empty state
          setTreeData([]);
        } else {
          setError(err.response?.data?.message || 'Failed to load goal tree.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchGoalTree();
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

      {treeData.length === 0 ? (
        <Alert severity="info">
          You haven't set any goals yet. Complete onboarding to build your goal tree.
        </Alert>
      ) : (
        <GoalTreeComponent data={treeData} />
      )}
    </Container>
  );
};

export default GoalTreePage;
