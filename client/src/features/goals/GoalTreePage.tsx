import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { GoalNode as FrontendGoalNode, Domain } from '../../types/goal';
import GoalTreeVisualization from './components/GoalTreeVisualization';
import toast from 'react-hot-toast';
import {
  Container,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Avatar,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';

function buildFrontendTree(backendNodes: any[]): FrontendGoalNode[] {
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

interface DMPartner {
  userId: string;
  name: string;
}

const GoalTreePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [treeData, setTreeData] = useState<FrontendGoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [isOwnTree, setIsOwnTree] = useState(true);

  // Claim completion dialog state
  const [claimNode, setClaimNode] = useState<FrontendGoalNode | null>(null);
  const [dmPartners, setDmPartners] = useState<DMPartner[]>([]);
  const [selectedVerifier, setSelectedVerifier] = useState<DMPartner | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);

  useEffect(() => {
    const fetchGoalTree = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let userId = id;
      if (!userId) userId = authUser?.id;
      if (authUser?.created_at) setMemberSince(authUser.created_at);
      if (authUser?.id) setCurrentUserId(authUser.id);
      setIsOwnTree(!id || id === authUser?.id);

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
        const allNodes: any[] = goalTree.nodes || [];
        setTreeData(buildFrontendTree(allNodes));
      } catch (err: any) {
        if (err.response?.status === 404) {
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

  // Fetch DM partners (people the user has messaged) for the claim dialog
  const fetchDMPartners = async (userId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .limit(100);

    if (!data) return;

    const partnerIds = new Set<string>();
    for (const msg of data) {
      const other = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      if (other) partnerIds.add(other);
    }

    const partners: DMPartner[] = [];
    for (const pid of Array.from(partnerIds)) {
      const { data: profile } = await supabase.from('profiles').select('name').eq('id', pid).single();
      partners.push({ userId: pid, name: profile?.name || pid.slice(0, 8) });
    }
    setDmPartners(partners);
  };

  const handleNodeClick = (node: FrontendGoalNode) => {
    if (!isOwnTree) return; // Can't claim on someone else's tree
    if (node.progress >= 100) {
      toast('This goal is already marked complete!', { icon: '✅' });
      return;
    }
    setClaimNode(node);
    setSelectedVerifier(null);
    if (currentUserId) fetchDMPartners(currentUserId);
  };

  const handleSendClaim = async () => {
    if (!claimNode || !selectedVerifier || !currentUserId) return;
    setSubmittingClaim(true);
    try {
      await axios.post(`${API_URL}/completions`, {
        requesterId: currentUserId,
        verifierId: selectedVerifier.userId,
        goalNodeId: claimNode.id,
        goalName: claimNode.title,
      });
      toast.success(`Verification request sent to ${selectedVerifier.name}!`);
      setClaimNode(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send verification request.');
    } finally {
      setSubmittingClaim(false);
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" component="h1" sx={{ color: 'primary.main' }}>
          {isOwnTree ? 'Your Goal Tree' : 'Goal Tree'}
        </Typography>
        {isOwnTree && treeData.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Click any node to request peer verification
          </Typography>
        )}
      </Box>

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
        <Box sx={{ overflowX: 'auto', width: '100%' }}>
          <GoalTreeVisualization
            rootNodes={treeData}
            memberSince={memberSince}
            onNodeClick={isOwnTree ? handleNodeClick : undefined}
          />
        </Box>
      )}

      {/* Claim completion dialog */}
      <Dialog open={!!claimNode} onClose={() => setClaimNode(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VerifiedIcon sx={{ color: 'primary.main' }} />
            Request Peer Verification
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Claiming completion of <strong style={{ color: '#F59E0B' }}>{claimNode?.title}</strong>.
            Select a partner from your DMs to verify this achievement:
          </Typography>
          {dmPartners.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No DM partners found. Message someone first to request verification.
            </Typography>
          ) : (
            <List dense>
              {dmPartners.map((partner) => (
                <ListItem disablePadding key={partner.userId}>
                  <ListItemButton
                    selected={selectedVerifier?.userId === partner.userId}
                    onClick={() => setSelectedVerifier(partner)}
                    sx={{ borderRadius: 2, mb: 0.5 }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem' }}>
                        {partner.name.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={partner.name} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setClaimNode(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedVerifier || submittingClaim}
            onClick={handleSendClaim}
          >
            {submittingClaim ? 'Sending…' : 'Send Verification Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GoalTreePage;
