import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { GoalNode as FrontendGoalNode, Domain } from '../../types/goal';
import GoalTreeVisualization from './components/GoalTreeVisualization';
import {
  Container,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Box,
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
  const navigate = useNavigate();

  const [treeData, setTreeData] = useState<FrontendGoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchGoalTree = async () => {
      // Determine which user's tree to show: URL param or current authenticated user
      let userId = id;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!userId) {
        userId = authUser?.id;
      }
      // Capture registration date for the tree root circle
      if (authUser?.created_at) setMemberSince(authUser.created_at);
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
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5, color: 'text.primary' }}>
            No goals yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto', lineHeight: 1.7 }}>
            Your goal tree is empty. Set up your initial goals to start finding aligned partners.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/goal-selection')}
            sx={{ px: 5, py: 1.5, borderRadius: '12px', fontWeight: 700 }}
          >
            Set Up Your Goals
          </Button>
        </Box>
      ) : (
        <GoalTreeVisualization rootNodes={treeData} memberSince={memberSince} />
      )}
    </Container>
  );
};

export default GoalTreePage;
