import React, { useState, useEffect } from 'react';
import { API_URL } from '../../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { GoalNode as FrontendGoalNode, Domain } from '../../types/goal';
import GoalTreeVisualization from './components/GoalTreeVisualization';
import TrackerSection from '../trackers/TrackerSection';
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
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import Slider from '@mui/material/Slider';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShareIcon from '@mui/icons-material/Share';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

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

interface DMPartner {
  userId: string;
  name: string;
}

const GoalTreePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [treeData, setTreeData] = useState<FrontendGoalNode[]>([]);
  const [backendNodes, setBackendNodes] = useState<any[]>([]); 
  const [domainProficiency, setDomainProficiency] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [isOwnTree, setIsOwnTree] = useState(true);

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

  // Mark Complete (achievement) dialog state
  const [achieveNode, setAchieveNode] = useState<FrontendGoalNode | null>(null);
  const [claimingAchievement, setClaimingAchievement] = useState(false);

  // Betting state
  const [betNode, setBetNode] = useState<FrontendGoalNode | null>(null);
  const [betDeadline, setBetDeadline] = useState('');
  const [betStake, setBetStake] = useState(10);
  const [placingBet, setPlacingBet] = useState(false);
  const [userBets, setUserBets] = useState<any[]>([]);
  const [praxisPoints, setPraxisPoints] = useState<number | null>(null);
  // Suspend goal dialog state
  const [suspendNode, setSuspendNode] = useState<FrontendGoalNode | null>(null);
  const [suspending, setSuspending] = useState(false);

  // New goal domain selection
  const [newGoalDomain, setNewGoalDomain] = useState<Domain | ''>('');

  // Countdown tick — re-renders every minute so timers stay live
  const [, setTick] = useState(0);

  useEffect(() => {
    const fetchGoalTree = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        let userId = id;
        if (!userId) userId = authUser?.id;
        if (authUser?.created_at) setMemberSince(authUser.created_at);
        if (authUser?.id) setCurrentUserId(authUser.id);
        setIsOwnTree(!id || id === authUser?.id);

        if (!userId) {
          setError('Could not determine user ID.');
          return;
        }

        const response = await axios.get(`${API_URL}/goals/${userId}`);
        const goalTree = response.data;
        const allNodes: any[] = goalTree.nodes || [];
        setBackendNodes(allNodes);
        setTreeData(buildFrontendTree(allNodes));
        if (goalTree.domain_proficiency && typeof goalTree.domain_proficiency === 'object') {
          setDomainProficiency(goalTree.domain_proficiency as Record<string, number>);
        }

        // Load bets + points for own tree
        if (!id || id === authUser?.id) {
          const [betsRes, profileRes] = await Promise.allSettled([
            axios.get(`${API_URL}/bets/${userId}`),
            supabase.from('profiles').select('praxis_points').eq('id', userId).single(),
          ]);
          if (betsRes.status === 'fulfilled') setUserBets(Array.isArray(betsRes.value.data) ? betsRes.value.data : []);
          if (profileRes.status === 'fulfilled') setPraxisPoints(profileRes.value.data?.praxis_points ?? null);
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

  const handleNodeClick = (node: FrontendGoalNode) => {
    if (!isOwnTree) return;
    
    // If it's a domain node, treat as "Add Goal" to that domain (full goal, side by side)
    if (node.id.startsWith('__dom__')) {
      const domain = node.domain;
      setNewGoalDomain(domain);
      setEditingNode(null);
      setIsBranching(true);
      setEditName('');
      setEditDesc('');
      setEditMetric('');
      setEditTargetDate('');
      setEditProgress(0);
      return;
    }

    handleOpenEdit(node, false);
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
      // Need original metric from backendNodes
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
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { Authorization: `Bearer ${session?.access_token}` };

      if (isBranching) {
        // Costs 500 PP
        const domain = editingNode ? editingNode.domain : (newGoalDomain as Domain);
        const parentId = editingNode ? editingNode.id : undefined;

        const res = await axios.post(
          `${API_URL}/goals/${currentUserId}/node`,
          {
            name: editName.trim(),
            description: editDesc.trim() || undefined,
            completionMetric: editMetric.trim() || undefined,
            targetDate: editTargetDate || undefined,
            parentId,
            domain,
          },
          { headers }
        );
        toast.success(parentId ? 'Sub-goal added! -500 PP' : 'New goal added! -500 PP');
        if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
      } else if (editingNode) {
        // Costs 100 PP for metadata changes
        const bNode = backendNodes.find(n => n.id === editingNode.id);
        const metadataChanged = 
          editName.trim() !== bNode?.name ||
          (editDesc.trim() || undefined) !== bNode?.customDetails ||
          (editMetric.trim() || undefined) !== bNode?.completionMetric ||
          (editTargetDate || undefined) !== bNode?.targetDate;

        if (metadataChanged) {
          const res = await axios.patch(
            `${API_URL}/goals/${currentUserId}/node/${editingNode.id}`,
            {
              name: editName.trim(),
              description: editDesc.trim() || undefined,
              completionMetric: editMetric.trim() || undefined,
              targetDate: editTargetDate || undefined,
            },
            { headers }
          );
          toast.success(`Goal details updated! -100 PP`);
          if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
        }

        // Check if progress changed
        if (editProgress !== editingNode.progress) {
          await axios.patch(
            `${API_URL}/goals/${currentUserId}/node/${editingNode.id}/progress`,
            { progress: editProgress },
            { headers }
          );
          if (!metadataChanged) toast.success(`Progress updated to ${editProgress}%`);
          if (editProgress === 100) {
            setTimeout(() => setAchieveNode({ ...editingNode, progress: 100 }), 400);
          }
        }
      }

      setEditingNode(null);
      // Reload to see updated tree
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
      const res = await axios.post(`${API_URL}/bets`, {
        userId: currentUserId,
        goalNodeId: betNode.id,
        goalName: betNode.title,
        deadline: new Date(betDeadline).toISOString(),
        stakePoints: betStake,
      });
      setUserBets((prev) => [res.data, ...prev]);
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

  const handleCancelBet = async (betId: string) => {
    if (!currentUserId) return;
    try {
      const res = await axios.delete(`${API_URL}/bets/${betId}`, { data: { userId: currentUserId } });
      setUserBets((prev) => prev.filter((b) => b.id !== betId));
      setPraxisPoints((p) => (p !== null ? p + res.data.refunded : null));
      toast.success(`Bet cancelled — points refunded.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel bet.');
    }
  };

  const handleClaimAchievement = async () => {
    if (!achieveNode || !currentUserId) return;
    setClaimingAchievement(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', currentUserId).single();
      await axios.post(`${API_URL}/achievements`, {
        userId: currentUserId,
        userName: profile?.name || 'Praxis User',
        userAvatarUrl: profile?.avatar_url || undefined,
        goalNodeId: achieveNode.id,
        title: achieveNode.title,
        description: achieveNode.description,
        domain: achieveNode.domain,
      }, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      toast.success('🏆 Achievement posted to the community feed!');
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
      await axios.post(`${API_URL}/completions`, {
        requesterId: currentUserId,
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

  // Tick every minute so bet countdowns stay live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const getCountdown = (deadline: string): string => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  const getCountdownColor = (deadline: string): string => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return '#ef4444';
    if (diff < 86_400_000) return '#ef4444';       // < 1 day — red
    if (diff < 3 * 86_400_000) return '#F59E0B';   // < 3 days — amber
    return '#10B981';                               // healthy — green
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
        <Stack direction="row" spacing={1} alignItems="center">
          {isOwnTree && praxisPoints !== null && (
            <Chip
              icon={<LocalFireDepartmentIcon sx={{ color: '#F59E0B !important' }} />}
              label={`${praxisPoints} pts`}
              size="small"
              sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700 }}
            />
          )}
          {isOwnTree && treeData.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Click node to verify or bet
            </Typography>
          )}
          {isOwnTree && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate('/goal-selection')}
              sx={{ borderRadius: '8px', fontSize: '0.8rem' }}
            >
              Edit Goals
            </Button>
          )}
        </Stack>
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
            domainProficiency={domainProficiency}
            memberSince={memberSince}
            onNodeClick={isOwnTree ? handleNodeClick : undefined}
            onRootClick={isOwnTree ? handleRootClick : undefined}
          />
        </Box>
      )}

      {/* Active bets list */}
      {isOwnTree && userBets.filter((b) => b.status === 'active').length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
            Active Bets
          </Typography>
          <Stack spacing={1.5}>
            {userBets.filter((b) => b.status === 'active').map((bet) => (
              <Box
                key={bet.id}
                sx={{
                  p: 2, borderRadius: 2,
                  bgcolor: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  display: 'flex', alignItems: 'center', gap: 2,
                }}
              >
                <LocalFireDepartmentIcon sx={{ color: getCountdownColor(bet.deadline) }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{bet.goal_name}</Typography>
                  <Typography variant="caption" sx={{ color: getCountdownColor(bet.deadline), fontWeight: 600 }}>
                    {getCountdown(bet.deadline)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary"> · Stake: {bet.stake_points} pts</Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => handleCancelBet(bet.id)}
                  sx={{ borderRadius: 2, flexShrink: 0 }}
                >
                  Cancel
                </Button>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Daily Trackers — workout logs, journals, etc. */}
      {isOwnTree && currentUserId && (
        <Box sx={{ mt: 5 }}>
          <TrackerSection userId={currentUserId} />
        </Box>
      )}

      {/* Mark Complete — claim achievement dialog with celebration */}
      <Dialog open={!!achieveNode} onClose={() => setAchieveNode(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px', border: '1px solid rgba(245,158,11,0.3)', background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.06) 100%)' } }}>
        <DialogTitle sx={{ fontWeight: 700, textAlign: 'center', pt: 3 }}>
          <Typography variant="h2" sx={{ mb: 1 }}>🏆</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Goal Completed!
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
              const text = `Just completed "${achieveNode?.title}" on Praxis. Consistent effort pays off. 🏆 praxis.app`;
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
            {claimingAchievement ? 'Posting…' : 'Post to Community Feed'}
          </Button>
          <Button onClick={() => setAchieveNode(null)} sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>
            Not now
          </Button>
        </DialogActions>
      </Dialog>

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
            Attach evidence (photo or video), then select a partner from your DMs to verify:
          </Typography>

          {/* Evidence upload */}
          <Box sx={{ mb: 2, p: 2, borderRadius: 2, border: '1px dashed rgba(245,158,11,0.4)', bgcolor: 'rgba(245,158,11,0.04)' }}>
            <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, display: 'block', mb: 1 }}>
              📎 PROOF REQUIRED
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
            {uploadingEvidence ? 'Uploading…' : submittingClaim ? 'Sending…' : 'Send Verification Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Betting dialog */}
      <Dialog open={!!betNode} onClose={() => setBetNode(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalFireDepartmentIcon sx={{ color: '#F59E0B' }} />
            Bet on this Goal
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Stake Praxis Points on completing{' '}
            <strong style={{ color: '#F59E0B' }}>{betNode?.title}</strong> by a deadline.
            Win 2× your stake when peer-verified!
          </Typography>
          {praxisPoints !== null && (
            <Typography variant="caption" sx={{ mb: 2, display: 'block', color: '#F59E0B', fontWeight: 700 }}>
              Your balance: {praxisPoints} pts
            </Typography>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Deadline"
              InputLabelProps={{ shrink: true }}
              value={betDeadline}
              onChange={(e) => setBetDeadline(e.target.value)}
              inputProps={{ min: new Date().toISOString().slice(0, 10) }}
            />
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Stake (Praxis Points)"
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
            {placingBet ? 'Placing…' : `Bet ${betStake} pts`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit/Branch Dialog — Consolidated UI */}
      <Dialog open={isBranching || !!editingNode} onClose={() => { setEditingNode(null); setIsBranching(false); }} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isBranching ? <AddCircleOutlineIcon sx={{ color: 'primary.main' }} /> : <EditNoteIcon sx={{ color: 'primary.main' }} />}
            {isBranching 
              ? (editingNode ? `Add Sub-goal to: ${editingNode.title}` : 'Add New Goal to Tree') 
              : 'Goal Details'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {isBranching && !editingNode && (
               <TextField
                 select
                 fullWidth
                 label="Select Domain"
                 value={newGoalDomain}
                 onChange={(e) => setNewGoalDomain(e.target.value as Domain)}
               >
                 {Object.values(Domain).map((dom) => (
                   <MenuItem key={dom} value={dom}>
                     {dom}
                   </MenuItem>
                 ))}
               </TextField>
            )}
            <TextField fullWidth label="Name" value={editName} onChange={e => setEditName(e.target.value)} placeholder={isBranching ? "What is the new goal?" : "Goal name"} />
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

          {/* Additional Actions */}
          {!isBranching && editingNode && (
             <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<AccountTreeIcon />} 
                  onClick={() => {
                    setEditingNode(editingNode); // Keep parent
                    setNewGoalDomain('');        // Not a root goal
                    setIsBranching(true);
                    setEditName('');
                    setEditDesc('');
                    setEditMetric('');
                    setEditTargetDate('');
                    setEditProgress(0);
                  }}
                  sx={{ borderRadius: '8px', color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.4)' }}
                >
                   Add Sub-goal
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
            {savingEdit ? 'Saving...' : (isBranching ? (editingNode ? 'Add Sub-goal (500 PP)' : 'Add New Goal (500 PP)') : (
              (editingNode && (editName.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.name || '') || 
               editDesc.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.customDetails || '') ||
               editMetric.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.completionMetric || '') ||
               editTargetDate !== (backendNodes.find(n => n.id === editingNode?.id)?.targetDate || '')
              )) ? 'Save Details (100 PP)' : 'Save Progress'
            ))}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Suspend goal confirmation */}
      <Dialog open={!!suspendNode} onClose={() => setSuspendNode(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Suspend Goal</DialogTitle>
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
                await axios.post(`${API_URL}/points/spend`, {
                  userId: currentUserId,
                  item: 'suspend_goal',
                  nodeId: suspendNode.id,
                });
                toast.success('Goal suspended!');
                setSuspendNode(null);
                window.location.reload();
              } catch (e: any) {
                toast.error(e.response?.data?.message || 'Failed to suspend goal');
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

    </Container>
  );
};

export default GoalTreePage;
