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
  Stack,
  TextField,
  Chip,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

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

  // Peer verification claim dialog state
  const [claimNode, setClaimNode] = useState<FrontendGoalNode | null>(null);
  const [dmPartners, setDmPartners] = useState<DMPartner[]>([]);
  const [selectedVerifier, setSelectedVerifier] = useState<DMPartner | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);

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
        setTreeData(buildFrontendTree(allNodes));

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

  const handleNodeClick = (node: FrontendGoalNode) => {
    if (!isOwnTree) return;
    if (node.progress >= 100) {
      // 100% — offer to post achievement to community feed
      setAchieveNode(node);
      return;
    }
    // < 100% — peer verification flow
    setClaimNode(node);
    setSelectedVerifier(null);
    if (currentUserId) fetchDMPartners(currentUserId);
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
            memberSince={memberSince}
            onNodeClick={isOwnTree ? handleNodeClick : undefined}
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

      {/* Mark Complete — claim achievement dialog */}
      <Dialog open={!!achieveNode} onClose={() => setAchieveNode(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ color: '#F59E0B' }} />
            Post Achievement
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong style={{ color: '#F59E0B' }}>{achieveNode?.title}</strong> is 100% complete!
            Share this win with the Praxis community?
          </Typography>
          <Typography variant="caption" color="text.disabled">
            It will appear in the Global Achievements feed on the Dashboard.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAchieveNode(null)}>Not now</Button>
          <Button
            variant="contained"
            onClick={handleClaimAchievement}
            disabled={claimingAchievement}
            startIcon={<EmojiEventsIcon />}
            sx={{ background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)' }}
          >
            {claimingAchievement ? 'Posting…' : 'Post to Feed'}
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
            disabled={!selectedVerifier || submittingClaim}
            onClick={handleSendClaim}
          >
            {submittingClaim ? 'Sending…' : 'Send Verification Request'}
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
    </Container>
  );
};

export default GoalTreePage;
