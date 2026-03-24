import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { GoalNode as FrontendGoalNode, Domain } from '../../types/goal';
import GoalCardTree from './components/GoalCardTree';
import GoalWorkspaceSheet from './components/GoalWorkspaceSheet';
import NodeJournalDrawer from './NodeJournalDrawer';
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
  Stack,
  TextField,
  Chip,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import Slider from '@mui/material/Slider';
import ShareIcon from '@mui/icons-material/Share';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ErrorBoundary from '../../components/common/ErrorBoundary';

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
      parentId: n.parentId,
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

function flattenTree(nodes: FrontendGoalNode[]): FrontendGoalNode[] {
  return nodes.flatMap(function flatten(n: FrontendGoalNode): FrontendGoalNode[] {
    return [n, ...n.children.flatMap(flatten)];
  });
}

interface DMPartner {
  userId: string;
  name: string;
}

const GoalTreePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [treeData, setTreeData] = useState<FrontendGoalNode[]>([]);
  const [backendNodes, setBackendNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [isOwnTree, setIsOwnTree] = useState(true);

  // Card tree + workspace state
  const [selectedNode, setSelectedNode] = useState<FrontendGoalNode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Edit/Branch dialog state
  const [editingNode, setEditingNode] = useState<FrontendGoalNode | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMetric, setEditMetric] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [isBranching, setIsBranching] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Peer verification claim dialog state
  const [claimNode, setClaimNode] = useState<FrontendGoalNode | null>(null);
  const [dmPartners, setDmPartners] = useState<DMPartner[]>([]);
  const [selectedVerifier, setSelectedVerifier] = useState<DMPartner | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Achievement dialog state
  const [achieveNode, setAchieveNode] = useState<FrontendGoalNode | null>(null);
  const [claimingAchievement, setClaimingAchievement] = useState(false);

  // Betting state
  const [betNode, setBetNode] = useState<FrontendGoalNode | null>(null);
  const [betDeadline, setBetDeadline] = useState('');
  const [betStake, setBetStake] = useState(10);
  const [placingBet, setPlacingBet] = useState(false);
  const [praxisPoints, setPraxisPoints] = useState<number | null>(null);

  // Suspend goal dialog state
  const [suspendNode, setSuspendNode] = useState<FrontendGoalNode | null>(null);
  const [suspending, setSuspending] = useState(false);

  // Delete goal dialog state
  const [deleteNode, setDeleteNode] = useState<FrontendGoalNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Journal drawer state
  const [journalNode, setJournalNode] = useState<FrontendGoalNode | null>(null);

  // New goal domain selection
  const [newGoalDomain, setNewGoalDomain] = useState<Domain | ''>('');

  // ── Data fetching ──────────────────────────────────────────────
  useEffect(() => {
    const fetchGoalTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        let userId = id;
        if (!userId) userId = authUser?.id;
        if (authUser?.id) setCurrentUserId(authUser.id);
        setIsOwnTree(!id || id === authUser?.id);

        if (!userId) {
          setError('Could not determine user ID.');
          return;
        }

        const response = await api.get(`/goals/${userId}`);
        const allNodes: any[] = response.data.nodes || [];
        setBackendNodes(allNodes);
        setTreeData(buildFrontendTree(allNodes));

        if (!id || id === authUser?.id) {
          const profileRes = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
          if (profileRes.data) setPraxisPoints(profileRes.data.praxis_points ?? null);
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setTreeData([]);
        } else {
          setError(err?.response?.data?.message || err?.message || 'Failed to load goal tree.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchGoalTree();
  }, [id]);

  // ── DM partners for verification ──────────────────────────────
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

  // ── New handlers for card tree + workspace ─────────────────────
  const handleNodeSelect = (node: FrontendGoalNode) => {
    setSelectedNode(node);
    setSheetOpen(true);
  };

  const handleProgressUpdate = async (nodeId: string, progress: number) => {
    if (!currentUserId) return;
    try {
      await api.patch(
        `/goals/${currentUserId}/node/${nodeId}/progress`,
        { progress },
      );
      toast.success(`Progress updated to ${progress}%`);
      if (progress === 100) {
        const node = flattenTree(treeData).find(n => n.id === nodeId);
        if (node) setTimeout(() => setAchieveNode({ ...node, progress: 100 }), 400);
      }
      // Refresh tree
      const response = await api.get(`/goals/${currentUserId}`);
      const allNodes: any[] = response.data.nodes || [];
      setBackendNodes(allNodes);
      const freshTree = buildFrontendTree(allNodes);
      setTreeData(freshTree);
      const freshNode = flattenTree(freshTree).find(n => n.id === nodeId);
      if (freshNode) setSelectedNode(freshNode);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update progress.');
    }
  };

  const handleLogTracker = (_trackerType: string, _goalNode: FrontendGoalNode) => {
    navigate(`/dashboard?tracker=${_trackerType}`);
  };

  const handleAction = (action: string, node: FrontendGoalNode) => {
    switch (action) {
      case 'journal':
        setJournalNode(node);
        break;
      case 'bet':
        setBetNode(node);
        break;
      case 'verify':
        setClaimNode(node);
        setSelectedVerifier(null);
        if (currentUserId) fetchDMPartners(currentUserId);
        break;
      case 'edit':
        handleOpenEdit(node, false);
        break;
      case 'suspend':
        setSuspendNode(node);
        break;
      case 'delete':
        setDeleteNode(node);
        break;
    }
  };

  const handleAddSubgoal = (parentId: string) => {
    const parent = flattenTree(treeData).find(n => n.id === parentId);
    if (parent) handleOpenEdit(parent, true);
  };

  // ── Existing handlers (preserved) ──────────────────────────────
  const handleRootClick = () => {
    if (!isOwnTree) return;
    setEditingNode(null);
    setNewGoalDomain('');
    setIsBranching(true);
    setEditName('');
    setEditDesc('');
    setEditMetric('');
    setEditTargetDate('');
    setEditProgress(0);
  };

  const handleOpenEdit = (node: FrontendGoalNode, branch = false) => {
    setEditingNode(node);
    setIsBranching(branch);
    if (branch) {
      setEditName('');
      setEditDesc('');
      setEditMetric('');
      setEditTargetDate('');
      setEditProgress(0);
    } else {
      setEditName(node.title);
      setEditDesc(node.description || '');
      setEditProgress(node.progress);
      const bNode = backendNodes.find(n => n.id === node.id);
      setEditMetric(bNode?.completionMetric || '');
      setEditTargetDate(bNode?.targetDate || '');
    }
  };

  const handleSaveEdit = async () => {
    if (!currentUserId || !editName.trim()) return;
    if (isBranching && !editingNode && !newGoalDomain) {
      toast.error('Please select a domain.');
      return;
    }
    setSavingEdit(true);
    try {
      if (isBranching) {
        const domain = editingNode ? editingNode.domain : (newGoalDomain as Domain);
        const parentId = editingNode ? editingNode.id : undefined;
        const res = await api.post(
          `/goals/${currentUserId}/node`,
          {
            name: editName.trim(),
            description: editDesc.trim() || undefined,
            completionMetric: editMetric.trim() || undefined,
            targetDate: editTargetDate || undefined,
            parentId,
            domain,
          },
        );
        toast.success(parentId ? 'Chapter added! -150 PP' : 'New topic added! -150 PP');
        if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
      } else if (editingNode) {
        const bNode = backendNodes.find(n => n.id === editingNode.id);
        const metadataChanged =
          editName.trim() !== bNode?.name ||
          (editDesc.trim() || undefined) !== bNode?.customDetails ||
          (editMetric.trim() || undefined) !== bNode?.completionMetric ||
          (editTargetDate || undefined) !== bNode?.targetDate;

        if (metadataChanged) {
          const res = await api.patch(
            `/goals/${currentUserId}/node/${editingNode.id}`,
            {
              name: editName.trim(),
              description: editDesc.trim() || undefined,
              completionMetric: editMetric.trim() || undefined,
              targetDate: editTargetDate || undefined,
            },
          );
          toast.success('Details updated! -50 PP');
          if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
        }

        if (editProgress !== editingNode.progress) {
          await api.patch(
            `/goals/${currentUserId}/node/${editingNode.id}/progress`,
            { progress: editProgress },
          );
          if (!metadataChanged) toast.success(`Progress updated to ${editProgress}%`);
          if (editProgress === 100) {
            setTimeout(() => setAchieveNode({ ...editingNode, progress: 100 }), 400);
          }
        }
      }

      setEditingNode(null);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePlaceBet = async () => {
    if (!betNode || !currentUserId || !betDeadline || betStake < 1) return;
    setPlacingBet(true);
    try {
      await api.post(`/bets`, {
        goalNodeId: betNode.id,
        goalName: betNode.title,
        deadline: new Date(betDeadline).toISOString(),
        stakePoints: betStake,
      });
      setPraxisPoints((p) => (p !== null ? p - betStake : null));
      toast.success(`Bet placed! ${betStake} Praxis Points at stake.`);
      setBetNode(null);
      setBetDeadline('');
      setBetStake(10);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to place bet.');
    } finally {
      setPlacingBet(false);
    }
  };

  const handleClaimAchievement = async () => {
    if (!achieveNode || !currentUserId) return;
    setClaimingAchievement(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', currentUserId).single();
      await api.post(`/achievements`, {
        userId: currentUserId,
        userName: profile?.name || 'Praxis User',
        userAvatarUrl: profile?.avatar_url || undefined,
        goalNodeId: achieveNode.id,
        title: achieveNode.title,
        description: achieveNode.description,
        domain: achieveNode.domain,
      });
      toast.success('Achievement posted to the community feed!');
      setAchieveNode(null);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to post achievement.');
    } finally {
      setClaimingAchievement(false);
    }
  };

  const handleSendClaim = async () => {
    if (!claimNode || !selectedVerifier || !currentUserId) return;
    if (!evidenceFile) {
      toast.error('Please attach a photo or video as evidence before submitting.');
      return;
    }
    setUploadingEvidence(true);
    let evidenceUrl = '';
    try {
      const ext = evidenceFile.name.split('.').pop();
      const path = `evidence/${currentUserId}/${claimNode.id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('goal-evidence')
        .upload(path, evidenceFile, { upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data: urlData } = supabase.storage.from('goal-evidence').getPublicUrl(path);
      evidenceUrl = urlData.publicUrl;
    } catch (err: any) {
      toast.error('Evidence upload failed: ' + err.message);
      setUploadingEvidence(false);
      return;
    } finally {
      setUploadingEvidence(false);
    }

    setSubmittingClaim(true);
    try {
      await api.post(`/completions`, {
        verifierId: selectedVerifier.userId,
        goalNodeId: claimNode.id,
        goalName: claimNode.title,
        evidenceUrl,
      });
      toast.success(`Verification request sent to ${selectedVerifier.name}!`);
      setClaimNode(null);
      setEvidenceFile(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send verification request.');
    } finally {
      setSubmittingClaim(false);
    }
  };

  // ── Loading / Error ────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Container component="main" maxWidth="lg" sx={{ mt: 4, px: { xs: 0, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: { xs: 2, sm: 0 }, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" component="h1" sx={{ color: 'primary.main', fontWeight: 800 }}>
          {isOwnTree ? 'Your Notebook' : 'Notebook'}
        </Typography>
        {isOwnTree && praxisPoints !== null && (
          <Chip
            icon={<LocalFireDepartmentIcon sx={{ color: '#F59E0B !important' }} />}
            label={`${praxisPoints} PP`}
            size="small"
            sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700 }}
          />
        )}
      </Box>

      {treeData.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
            Your Notebook is empty
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto', lineHeight: 1.7 }}>
            Set up your initial topics to start organizing your life and finding aligned partners.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/goal-selection')}
            sx={{ px: 5, py: 1.5, borderRadius: '12px', fontWeight: 700 }}
          >
            Set Up Your Notebook
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', height: { xs: 'auto', md: 'calc(100vh - 120px)' } }}>
          {/* Tree panel */}
          <Box sx={{
            width: { xs: '100%', md: '40%' },
            overflowY: 'auto',
            borderRight: { xs: 'none', md: '1px solid rgba(255,255,255,0.06)' },
          }}>
            <ErrorBoundary label="Goal Tree">
              <GoalCardTree
                nodes={treeData}
                selectedNodeId={selectedNode?.id ?? null}
                onNodeSelect={handleNodeSelect}
                onAddGoal={handleRootClick}
                readOnly={!isOwnTree}
              />
            </ErrorBoundary>
          </Box>

          {/* Desktop: right panel workspace */}
          {!isMobile && selectedNode && (
            <Box sx={{ width: '60%' }}>
              <ErrorBoundary label="Goal Workspace">
                <GoalWorkspaceSheet
                  node={selectedNode}
                  allNodes={backendNodes}
                  open={true}
                  onClose={() => setSelectedNode(null)}
                  onProgressChange={handleProgressUpdate}
                  onNodeSelect={handleNodeSelect}
                  onAddSubgoal={handleAddSubgoal}
                  onLogTracker={handleLogTracker}
                  onAction={handleAction}
                  userId={currentUserId || ''}
                  readOnly={!isOwnTree}
                />
              </ErrorBoundary>
            </Box>
          )}
        </Box>
      )}

      {/* Mobile: bottom sheet */}
      {isMobile && (
        <ErrorBoundary label="Goal Workspace">
          <GoalWorkspaceSheet
            node={selectedNode}
            allNodes={backendNodes}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onProgressChange={handleProgressUpdate}
            onNodeSelect={handleNodeSelect}
            onAddSubgoal={handleAddSubgoal}
            onLogTracker={handleLogTracker}
            onAction={handleAction}
            userId={currentUserId || ''}
            readOnly={!isOwnTree}
          />
        </ErrorBoundary>
      )}

      {/* ── Achievement celebration dialog ──────────────────────── */}
      <Dialog open={!!achieveNode} onClose={() => setAchieveNode(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px', border: '1px solid rgba(245,158,11,0.3)', background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.06) 100%)' } }}>
        <DialogTitle sx={{ fontWeight: 700, textAlign: 'center', pt: 3 }}>
          <Typography variant="h2" sx={{ mb: 1 }}>🏆</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Topic Completed!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ textAlign: 'center', fontWeight: 600, mb: 0.5 }}>
            {achieveNode?.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 2.5 }}>
            You finished this. Share the win and inspire your network.
          </Typography>
          <Button
            fullWidth variant="outlined" size="small"
            startIcon={<ShareIcon />}
            sx={{ borderRadius: '10px', mb: 1, borderColor: 'rgba(245,158,11,0.4)', color: 'primary.main' }}
            onClick={() => {
              const text = `Just completed "${achieveNode?.title}" on Praxis. Consistent effort pays off. praxis.app`;
              if (navigator.share) {
                navigator.share({ text }).catch(() => {});
              } else {
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }
            }}
          >
            Share your win
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 1 }}>
          <Button
            fullWidth variant="contained"
            onClick={handleClaimAchievement}
            disabled={claimingAchievement}
            startIcon={<EmojiEventsIcon />}
            sx={{ borderRadius: '12px', py: 1.25, background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)', fontWeight: 700 }}
          >
            {claimingAchievement ? 'Posting...' : 'Post to Community Feed'}
          </Button>
          <Button onClick={() => setAchieveNode(null)} sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>
            Not now
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Claim completion dialog ─────────────────────────────── */}
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
            Attach evidence (photo or video), then select a partner from your DMs to verify:
          </Typography>
          <Box sx={{ mb: 2, p: 2, borderRadius: 2, border: '1px dashed rgba(245,158,11,0.4)', bgcolor: 'rgba(245,158,11,0.04)' }}>
            <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, display: 'block', mb: 1 }}>
              PROOF REQUIRED
            </Typography>
            <Button
              variant="outlined"
              component="label"
              size="small"
              sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary', fontSize: '0.75rem' }}
            >
              {evidenceFile ? evidenceFile.name : 'Upload photo or video'}
              <input
                type="file"
                hidden
                accept="image/*,video/*"
                onChange={e => setEvidenceFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            {evidenceFile && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                {(evidenceFile.size / 1024 / 1024).toFixed(1)} MB
              </Typography>
            )}
          </Box>
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
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setClaimNode(null)}>Cancel</Button>
          <Button
            variant="outlined"
            startIcon={<LocalFireDepartmentIcon />}
            onClick={() => { setBetNode(claimNode); setClaimNode(null); }}
            sx={{ color: '#F59E0B', borderColor: '#F59E0B' }}
          >
            Bet Instead
          </Button>
          <Button
            variant="contained"
            disabled={!selectedVerifier || !evidenceFile || submittingClaim || uploadingEvidence}
            onClick={handleSendClaim}
          >
            {uploadingEvidence ? 'Uploading...' : submittingClaim ? 'Sending...' : 'Send Verification Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Betting dialog ──────────────────────────────────────── */}
      <Dialog open={!!betNode} onClose={() => setBetNode(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalFireDepartmentIcon sx={{ color: '#F59E0B' }} />
            Bet on this Topic
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Stake Praxis Points on completing{' '}
            <strong style={{ color: '#F59E0B' }}>{betNode?.title}</strong> by a deadline.
            Win 2x your stake when peer-verified!
          </Typography>
          {praxisPoints !== null && (
            <Typography variant="caption" sx={{ mb: 2, display: 'block', color: '#F59E0B', fontWeight: 700 }}>
              Your balance: {praxisPoints} PP
            </Typography>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth size="small" type="date" label="Deadline"
              InputLabelProps={{ shrink: true }}
              value={betDeadline}
              onChange={(e) => setBetDeadline(e.target.value)}
              inputProps={{ min: new Date().toISOString().slice(0, 10) }}
            />
            <TextField
              fullWidth size="small" type="number" label="Stake (Praxis Points)"
              value={betStake}
              onChange={(e) => setBetStake(Math.max(1, parseInt(e.target.value) || 1))}
              inputProps={{ min: 1, max: praxisPoints ?? 999 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBetNode(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePlaceBet}
            disabled={placingBet || !betDeadline || betStake < 1}
            sx={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
          >
            {placingBet ? 'Placing...' : `Bet ${betStake} PP`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit/Branch dialog ──────────────────────────────────── */}
      <Dialog open={isBranching || !!editingNode} onClose={() => { setEditingNode(null); setIsBranching(false); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isBranching ? <AddCircleOutlineIcon sx={{ color: 'primary.main' }} /> : <EditNoteIcon sx={{ color: 'primary.main' }} />}
            {isBranching
              ? (editingNode ? `Add Chapter to: ${editingNode.title}` : 'Add New Topic')
              : 'Topic Details'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {isBranching && !editingNode && (
              <TextField
                select fullWidth label="Select Domain"
                value={newGoalDomain}
                onChange={(e) => setNewGoalDomain(e.target.value as Domain)}
              >
                {Object.values(Domain).map((dom) => (
                  <MenuItem key={dom} value={dom}>{dom}</MenuItem>
                ))}
              </TextField>
            )}
            <TextField fullWidth label="Name" value={editName} onChange={e => setEditName(e.target.value)} placeholder={isBranching ? "What is the new topic/chapter?" : "Topic name"} />
            <TextField fullWidth label="Description" multiline rows={2} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Details..." />
            <TextField fullWidth label="Success Metric" multiline rows={2} value={editMetric} onChange={e => setEditMetric(e.target.value)} placeholder="How will you know it's done?" />
            <TextField fullWidth label="Target Date" type="date" InputLabelProps={{ shrink: true }} value={editTargetDate} onChange={e => setEditTargetDate(e.target.value)} inputProps={{ min: new Date().toISOString().slice(0, 10) }} />

            {!isBranching && editingNode && (
              <Box sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Progress</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: editProgress === 100 ? '#10B981' : '#F59E0B' }}>
                    {editProgress}%
                  </Typography>
                </Box>
                <Slider
                  value={editProgress}
                  onChange={(_, v) => setEditProgress(v as number)}
                  min={0} max={100} step={5}
                  marks={[{ value: 0, label: '0%' }, { value: 50, label: '50%' }, { value: 100, label: '100%' }]}
                  sx={{ color: editProgress === 100 ? '#10B981' : '#F59E0B' }}
                />
              </Box>
            )}
          </Stack>

          {!isBranching && editingNode && (
            <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: 'wrap', gap: 1 }}>
              <Button size="small" variant="outlined" startIcon={<AccountTreeIcon />}
                onClick={() => {
                  setNewGoalDomain('');
                  setIsBranching(true);
                  setEditName('');
                  setEditDesc('');
                  setEditMetric('');
                  setEditTargetDate('');
                  setEditProgress(0);
                }}
                sx={{ borderRadius: '8px', color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.4)' }}
              >
                Add Chapter
              </Button>
              {editingNode.progress < 100 && (
                <>
                  <Button size="small" variant="outlined" startIcon={<VerifiedIcon />}
                    onClick={() => { setClaimNode(editingNode); setSelectedVerifier(null); if (currentUserId) fetchDMPartners(currentUserId); setEditingNode(null); }}
                    sx={{ borderRadius: '8px', color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.4)' }}
                  >
                    Verify
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<LocalFireDepartmentIcon />}
                    onClick={() => { setBetNode(editingNode); setEditingNode(null); }}
                    sx={{ borderRadius: '8px', color: '#F59E0B', borderColor: 'rgba(245,158,11,0.4)' }}
                  >
                    Bet
                  </Button>
                </>
              )}
              <Button size="small" variant="outlined" startIcon={<MenuBookIcon />}
                onClick={() => { setJournalNode(editingNode); setEditingNode(null); }}
                sx={{ borderRadius: '8px', color: '#10B981', borderColor: 'rgba(16,185,129,0.4)' }}
              >
                Journal
              </Button>
              {editingNode.progress >= 100 && (
                <Button size="small" variant="contained" startIcon={<EmojiEventsIcon />}
                  onClick={() => { setAchieveNode(editingNode); setEditingNode(null); }}
                  sx={{ borderRadius: '8px', background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)' }}
                >
                  Post Achievement
                </Button>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => { setEditingNode(null); setIsBranching(false); }} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={savingEdit || !editName.trim() || (isBranching && !editingNode && !newGoalDomain)}
            sx={{ borderRadius: '10px' }}>
            {savingEdit ? 'Saving...' : (isBranching ? (editingNode ? 'Add Chapter (150 PP)' : 'Add New Topic (150 PP)') : (
              (editingNode && (editName.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.name || '') ||
               editDesc.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.customDetails || '') ||
               editMetric.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.completionMetric || '') ||
               editTargetDate !== (backendNodes.find(n => n.id === editingNode?.id)?.targetDate || '')
              )) ? 'Save Details (50 PP)' : 'Save Progress'
            ))}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Suspend topic confirmation ───────────────────────────── */}
      <Dialog open={!!suspendNode} onClose={() => setSuspendNode(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Suspend Topic</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Suspending <strong>{suspendNode?.title}</strong> will pause it without deleting it. Costs <strong>50 PP</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSuspendNode(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={suspending}
            onClick={async () => {
              if (!suspendNode || !currentUserId) return;
              setSuspending(true);
              try {
                await api.post(`/points/spend`, {
                  userId: currentUserId,
                  item: 'suspend_goal',
                  nodeId: suspendNode.id,
                });
                toast.success('Topic suspended!');
                setSuspendNode(null);
                window.location.reload();
              } catch (e: any) {
                toast.error(e.response?.data?.message || 'Failed to suspend topic');
              } finally {
                setSuspending(false);
              }
            }}
            sx={{ borderRadius: '10px' }}
          >
            {suspending ? <CircularProgress size={18} color="inherit" /> : 'Confirm (50 PP)'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete topic confirmation ────────────────────────────── */}
      <Dialog open={!!deleteNode} onClose={() => setDeleteNode(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Topic</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Permanently delete <strong>{deleteNode?.title}</strong>{deleteNode?.children && deleteNode.children.length > 0 ? ' and all its chapters' : ''}? Costs <strong>150 PP</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteNode(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleting}
            onClick={async () => {
              if (!deleteNode || !currentUserId) return;
              setDeleting(true);
              try {
                const res = await api.delete(
                  `/goals/${currentUserId}/node/${deleteNode.id}`,
                );
                if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
                toast.success('Topic deleted! -150 PP');
                setDeleteNode(null);
                setSelectedNode(null);
                setSheetOpen(false);
                // Refresh tree
                const response = await api.get(`/goals/${currentUserId}`);
                const allNodes: any[] = response.data.nodes || [];
                setBackendNodes(allNodes);
                setTreeData(buildFrontendTree(allNodes));
              } catch (e: any) {
                toast.error(e.response?.data?.message || 'Failed to delete topic');
              } finally {
                setDeleting(false);
              }
            }}
            sx={{ borderRadius: '10px' }}
          >
            {deleting ? <CircularProgress size={18} color="inherit" /> : 'Delete (150 PP)'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Node Journal Drawer ─────────────────────────────────── */}
      <NodeJournalDrawer
        open={!!journalNode}
        node={journalNode}
        onClose={() => setJournalNode(null)}
      />
    </Container>
  );
};

export default GoalTreePage;
