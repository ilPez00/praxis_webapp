import React, { useState, useEffect } from 'react';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import { GoalNode as FrontendGoalNode, Domain } from '../../types/goal';
import NotesCardTree from './NotesCardTree';
import GoalWorkspaceSheet, { ActionItem } from '../goals/components/GoalWorkspaceSheet';
import NoteGoalDetail from './NoteGoalDetail';
import NodeJournalDrawer from '../goals/NodeJournalDrawer';
import DiaryFeed from './DiaryFeed';
import ActivityCalendar from './ActivityCalendar';
import DayDetailView from './DayDetailView';
import GoalNotesPanel from './GoalNotesPanel';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import Slider from '@mui/material/Slider';
import AccountTreeIcon2 from '@mui/icons-material/Park';

import {
  Container, Box, Typography, Stack, CircularProgress,
  Chip, useTheme, useMediaQuery, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, TextField, MenuItem,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText, Avatar,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import VerifiedIcon from '@mui/icons-material/Verified';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ShareIcon from '@mui/icons-material/Share';

function buildFrontendTree(backendNodes: any[]): FrontendGoalNode[] {
  const nodeMap = new Map<string, FrontendGoalNode>();
  for (const n of backendNodes) {
    nodeMap.set(n.id, {
      id: n.id,
      title: n.name,
      description: n.customDetails,
      weight: Math.round(n.weight * 100) / 100,
      progress: Math.round(n.progress * 100),
      status: n.status,
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

interface DMPartner { userId: string; name: string; }

/** All actions available in Notes (full goal management) */
const NOTES_ACTIONS: ActionItem[] = [
  { key: 'journal', icon: '📓', label: 'Journal' },
  { key: 'edit', icon: '✏️', label: 'Edit' },
  { key: 'bet', icon: '🎰', label: 'Bet' },
  { key: 'verify', icon: '✅', label: 'Verify' },
  { key: 'suspend', icon: '⏸', label: 'Suspend' },
  { key: 'share', icon: '📤', label: 'Share' },
];

const NotesPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [treeData, setTreeData] = useState<FrontendGoalNode[]>([]);
  const [backendNodes, setBackendNodes] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [streak, setStreak] = useState<number>(0);
  const [praxisPoints, setPraxisPoints] = useState<number | null>(null);

  const [selectedNode, setSelectedNode] = useState<FrontendGoalNode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeLogType, setActiveLogType] = useState<string | null>(null);
  const [activeBets, setActiveBets] = useState<any[]>([]);

  // Journal drawer
  const [journalNode, setJournalNode] = useState<FrontendGoalNode | null>(null);

  // Edit/Branch dialog
  const [editingNode, setEditingNode] = useState<FrontendGoalNode | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMetric, setEditMetric] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [isBranching, setIsBranching] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [newGoalDomain, setNewGoalDomain] = useState<Domain | ''>('');

  // Betting dialog
  const [betNode, setBetNode] = useState<FrontendGoalNode | null>(null);
  const [betDeadline, setBetDeadline] = useState('');
  const [betStake, setBetStake] = useState(10);
  const [placingBet, setPlacingBet] = useState(false);

  // Verification dialog
  const [claimNode, setClaimNode] = useState<FrontendGoalNode | null>(null);
  const [dmPartners, setDmPartners] = useState<DMPartner[]>([]);
  const [selectedVerifier, setSelectedVerifier] = useState<DMPartner | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Achievement dialog
  const [achieveNode, setAchieveNode] = useState<FrontendGoalNode | null>(null);
  const [claimingAchievement, setClaimingAchievement] = useState(false);

  // Suspend dialog
  const [suspendNode, setSuspendNode] = useState<FrontendGoalNode | null>(null);
  const [suspending, setSuspending] = useState(false);

  // Calendar day detail
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const currentUserId = user?.id;

  // ── Data fetching ──────────────────────────────────────────────
  const refreshTree = async () => {
    if (!currentUserId) return;
    const treeRes = await supabase
      .from('goal_trees')
      .select('nodes, root_nodes')
      .eq('user_id', currentUserId)
      .single();
    if (treeRes.data) {
      const nodes = treeRes.data.nodes || [];
      setBackendNodes(nodes);
      const freshTree = buildFrontendTree(nodes);
      setTreeData(freshTree);
      return freshTree;
    }
    return null;
  };

  useEffect(() => {
    if (!currentUserId) return;
    const fetchData = async () => {
      setLoadingContent(true);
      try {
        const treeRes = await supabase
          .from('goal_trees')
          .select('nodes, root_nodes')
          .eq('user_id', currentUserId)
          .single();
        if (treeRes.data) {
          const nodes = treeRes.data.nodes || [];
          setBackendNodes(nodes);
          setTreeData(buildFrontendTree(nodes));
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('current_streak, praxis_points')
          .eq('id', currentUserId)
          .single();
        if (profile?.current_streak) setStreak(profile.current_streak);
        if (profile?.praxis_points != null) setPraxisPoints(profile.praxis_points);

        const betsRes = await supabase
          .from('bets')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('status', 'active');
        setActiveBets(betsRes.data || []);
      } catch (err: any) {
        console.error('Notes fetch error:', err);
      } finally {
        setLoadingContent(false);
      }
    };
    fetchData();
  }, [currentUserId]);

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

  // ── Handlers ───────────────────────────────────────────────────
  const mobileDetailRef = React.useRef<HTMLDivElement>(null);

  const handleNodeSelect = (node: FrontendGoalNode) => {
    setSelectedNode(node);
    if (!isMobile) {
      setSheetOpen(true);
    } else {
      // On mobile: show inline detail and scroll to it
      setTimeout(() => {
        mobileDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleProgressUpdate = async (nodeId: string, progress: number) => {
    if (!currentUserId) return;
    
    // Validate node ID is not empty
    if (!nodeId || nodeId.trim().length === 0) {
      console.warn(`Empty node ID provided`);
      toast.error('Cannot update progress: Node ID is required');
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.patch(
        `${API_URL}/goals/${currentUserId}/node/${nodeId}/progress`,
        { progress },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      toast.success(`Progress updated to ${progress}%`);
      if (progress === 100) {
        const node = flattenTree(treeData).find(n => n.id === nodeId);
        if (node) setTimeout(() => setAchieveNode({ ...node, progress: 100 }), 400);
      }
      const freshTree = await refreshTree();
      if (freshTree) {
        const freshNode = flattenTree(freshTree).find(n => n.id === nodeId);
        if (freshNode) setSelectedNode(freshNode);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update progress.');
    }
  };

  const handleLogTracker = (trackerType: string, goalNode: FrontendGoalNode) => {
    setSelectedNode(goalNode);
    setActiveLogType(trackerType);
    if (!isMobile) {
      setSheetOpen(true);
    } else {
      setTimeout(() => {
        mobileDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
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

  const handleAddNewGoal = () => {
    setEditingNode(null);
    setNewGoalDomain('');
    setIsBranching(true);
    setEditName('');
    setEditDesc('');
    setEditMetric('');
    setEditTargetDate('');
    setEditProgress(0);
  };

  const handleAddGoalInDomain = (domain: string) => {
    setEditingNode(null);
    setNewGoalDomain(domain as Domain);
    setIsBranching(true);
    setEditName('');
    setEditDesc('');
    setEditMetric('');
    setEditTargetDate('');
    setEditProgress(0);
  };

  const handleAddSubgoal = (parentId: string) => {
    const parent = flattenTree(treeData).find(n => n.id === parentId);
    if (parent) handleOpenEdit(parent, true);
  };

  const handleAction = (action: string, node: FrontendGoalNode) => {
    switch (action) {
      case 'journal':
        setJournalNode(node);
        break;
      case 'edit':
        handleOpenEdit(node, false);
        break;
      case 'bet':
        setBetNode(node);
        break;
      case 'verify':
        setClaimNode(node);
        setSelectedVerifier(null);
        if (currentUserId) fetchDMPartners(currentUserId);
        break;
      case 'suspend':
        setSuspendNode(node);
        break;
      case 'share': {
        const text = `Working on "${node.title}" — ${node.progress}% complete on Praxis!`;
        if (navigator.share) {
          navigator.share({ text }).catch(() => {});
        } else {
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
            '_blank'
          );
        }
        break;
      }
    }
  };

  // ── Save edit/branch ──────────────────────────────────────────
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
        toast.success(parentId ? 'Sub-goal added!' : 'New goal added!');
        if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
      } else if (editingNode) {
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
          toast.success('Goal details updated!');
          if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
        }

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
      setIsBranching(false);
      const freshTree = await refreshTree();
      if (freshTree && editingNode) {
        const freshNode = flattenTree(freshTree).find(n => n.id === editingNode.id);
        if (freshNode) setSelectedNode(freshNode);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Bet handler ───────────────────────────────────────────────
  const handlePlaceBet = async () => {
    if (!betNode || !currentUserId || !betDeadline || betStake < 1) return;
    setPlacingBet(true);
    try {
      await axios.post(`${API_URL}/bets`, {
        userId: currentUserId,
        goalNodeId: betNode.id,
        goalName: betNode.title,
        deadline: new Date(betDeadline).toISOString(),
        stakePoints: betStake,
      });
      setPraxisPoints(p => (p !== null ? p - betStake : null));
      toast.success(`Bet placed! ${betStake} PP at stake.`);
      setBetNode(null);
      setBetDeadline('');
      setBetStake(10);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to place bet.');
    } finally {
      setPlacingBet(false);
    }
  };

  // ── Achievement handler ───────────────────────────────────────
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
      toast.success('Achievement posted to the community feed!');
      setAchieveNode(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to post achievement.');
    } finally {
      setClaimingAchievement(false);
    }
  };

  // ── Verification handler ──────────────────────────────────────
  const handleSendClaim = async () => {
    if (!claimNode || !selectedVerifier || !currentUserId) return;
    if (!evidenceFile) {
      toast.error('Please attach a photo or video as evidence.');
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

  // ── Loading ────────────────────────────────────────────────────
  if (userLoading || loadingContent) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Container>
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <Container maxWidth="lg" sx={{ py: 4, px: { xs: 0, sm: 3 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, px: { xs: 2, sm: 0 } }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main' }}>
              Notes & Goals
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage goals, track progress, log entries
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {praxisPoints !== null && (
              <Chip
                icon={<LocalFireDepartmentIcon sx={{ color: '#F59E0B !important' }} />}
                label={`${praxisPoints} PP`}
                size="small"
                sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700 }}
              />
            )}
            {streak > 0 && (
              <Chip
                icon={<LocalFireDepartmentIcon sx={{ color: '#F59E0B !important' }} />}
                label={`${streak}d`}
                size="small"
                sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700 }}
              />
            )}
          </Stack>
        </Box>

        {/* Activity calendar — clickable days */}
        {currentUserId && (
          <ActivityCalendar
            userId={currentUserId}
            selectedDate={selectedCalendarDate}
            onDaySelect={(date) => setSelectedCalendarDate(prev => prev === date ? null : date)}
          />
        )}

        {/* Day Detail — shown when a calendar day is clicked */}
        {currentUserId && selectedCalendarDate && (
          <DayDetailView
            userId={currentUserId}
            date={selectedCalendarDate}
            onClose={() => setSelectedCalendarDate(null)}
          />
        )}

        {/* Main content - Goal tree with diary below, infinitely scrollable */}
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Goal Tree Panel */}
          <Box sx={{
            width: '100%',
            mb: 4,
          }}>
            <NotesCardTree
              nodes={treeData}
              selectedNodeId={selectedNode?.id ?? null}
              onNodeSelect={handleNodeSelect}
              onLogTracker={handleLogTracker}
              onAddGoal={handleAddNewGoal}
              onAddGoalInDomain={handleAddGoalInDomain}
              onAddSubgoal={handleAddSubgoal}
            />
          </Box>

          {/* Mobile: NoteGoalDetail + actions inline below tree */}
          {isMobile && currentUserId && selectedNode && (
            <Box ref={mobileDetailRef} sx={{ width: '100%', mb: 3, px: 1 }}>
              {/* Inline action bar */}
              <Box sx={{
                display: 'flex', justifyContent: 'space-around',
                py: 1.5, mb: 2,
                borderRadius: '14px',
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {NOTES_ACTIONS.map(action => (
                  <Box
                    key={action.key}
                    onClick={() => handleAction(action.key, selectedNode)}
                    sx={{
                      textAlign: 'center', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.6)',
                      '&:hover': { color: 'rgba(255,255,255,0.9)' },
                    }}
                  >
                    <Typography sx={{ fontSize: '1.3rem', mb: 0.25 }}>{action.icon}</Typography>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700 }}>{action.label}</Typography>
                  </Box>
                ))}
              </Box>

              <NoteGoalDetail
                node={selectedNode}
                allNodes={backendNodes}
                userId={currentUserId}
                activeBets={activeBets}
                onProgressUpdate={(nodeId, progress) => handleProgressUpdate(nodeId, progress)}
                focusedTrackerType={activeLogType}
              />

              <Box sx={{ mt: 2 }}>
                <GoalNotesPanel
                  nodeId={selectedNode.id}
                  nodeTitle={selectedNode.title}
                  userId={currentUserId}
                  compact={true}
                />
              </Box>
            </Box>
          )}

          {/* Diary Feed - Infinite Scroll */}
          {currentUserId && (
            <Box sx={{ width: '100%' }}>
              <DiaryFeed userId={currentUserId} />
            </Box>
          )}
        </Box>

        {/* Desktop: Right panel for goal details and notes */}
        {!isMobile && (
          <Box sx={{
            position: 'fixed',
            right: 0,
            top: '80px',
            width: '40%',
            maxWidth: '500px',
            height: 'calc(100vh - 100px)',
            overflowY: 'auto',
            bgcolor: 'rgba(17,24,39,0.95)',
            backdropFilter: 'blur(10px)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            pl: 3,
          }}>
            {selectedNode && currentUserId ? (
              <>
                {/* Goal Details & Trackers */}
                <NoteGoalDetail
                  node={selectedNode}
                  allNodes={backendNodes}
                  userId={currentUserId}
                  activeBets={activeBets}
                  onProgressUpdate={(nodeId, progress) => handleProgressUpdate(nodeId, progress)}
                  focusedTrackerType={activeLogType}
                />
                
                {/* Goal Notes Panel */}
                <GoalNotesPanel
                  nodeId={selectedNode.id}
                  nodeTitle={selectedNode.title}
                  userId={currentUserId}
                />
                
                {/* Workspace Sheet (actions) */}
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
                  userId={currentUserId}
                  actions={NOTES_ACTIONS}
                />
              </>
            ) : (
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.2)', py: 6,
              }}>
                <Typography sx={{ color: 'inherit' }}>Select a goal to track progress</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Mobile bottom sheet removed — widgets + actions now inline above */}

        {/* ── Edit/Branch dialog ──────────────────────────────────── */}
        <Dialog open={isBranching || !!editingNode} onClose={() => { setEditingNode(null); setIsBranching(false); }} maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}>
          <DialogTitle sx={{ fontWeight: 700 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isBranching ? <AddCircleOutlineIcon sx={{ color: 'primary.main' }} /> : <EditNoteIcon sx={{ color: 'primary.main' }} />}
              {isBranching
                ? (editingNode ? `Add Sub-goal to: ${editingNode.title}` : 'Add New Goal')
                : 'Edit Goal'}
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

            {!isBranching && editingNode && (
              <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<AccountTreeIcon />}
                  onClick={() => { setIsBranching(true); setEditName(''); setEditDesc(''); setEditMetric(''); setEditTargetDate(''); setEditProgress(0); }}
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
              {savingEdit ? 'Saving...' : (isBranching ? (editingNode ? 'Add Sub-goal' : 'Add New Goal') : 'Save')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Betting dialog ──────────────────────────────────────── */}
        <Dialog open={!!betNode} onClose={() => setBetNode(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalFireDepartmentIcon sx={{ color: '#F59E0B' }} />
              Bet on this Goal
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Stake PP on completing <strong style={{ color: '#F59E0B' }}>{betNode?.title}</strong> by a deadline. Win 2x on peer verification!
            </Typography>
            {praxisPoints !== null && (
              <Typography variant="caption" sx={{ mb: 2, display: 'block', color: '#F59E0B', fontWeight: 700 }}>
                Balance: {praxisPoints} PP
              </Typography>
            )}
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField fullWidth size="small" type="date" label="Deadline" InputLabelProps={{ shrink: true }}
                value={betDeadline} onChange={e => setBetDeadline(e.target.value)}
                inputProps={{ min: new Date().toISOString().slice(0, 10) }} />
              <TextField fullWidth size="small" type="number" label="Stake (PP)"
                value={betStake} onChange={e => setBetStake(Math.max(1, parseInt(e.target.value) || 1))}
                inputProps={{ min: 1, max: praxisPoints ?? 999 }} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setBetNode(null)}>Cancel</Button>
            <Button variant="contained" onClick={handlePlaceBet} disabled={placingBet || !betDeadline || betStake < 1}
              sx={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}>
              {placingBet ? 'Placing...' : `Bet ${betStake} PP`}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Verification dialog ─────────────────────────────────── */}
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
              Attach evidence, then select a verifier:
            </Typography>
            <Box sx={{ mb: 2, p: 2, borderRadius: 2, border: '1px dashed rgba(245,158,11,0.4)', bgcolor: 'rgba(245,158,11,0.04)' }}>
              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, display: 'block', mb: 1 }}>
                PROOF REQUIRED
              </Typography>
              <Button variant="outlined" component="label" size="small"
                sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary', fontSize: '0.75rem' }}>
                {evidenceFile ? evidenceFile.name : 'Upload photo or video'}
                <input type="file" hidden accept="image/*,video/*" onChange={e => setEvidenceFile(e.target.files?.[0] ?? null)} />
              </Button>
            </Box>
            {dmPartners.length === 0 ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No DM partners found. Message someone first.
              </Typography>
            ) : (
              <List dense>
                {dmPartners.map(partner => (
                  <ListItem disablePadding key={partner.userId}>
                    <ListItemButton selected={selectedVerifier?.userId === partner.userId}
                      onClick={() => setSelectedVerifier(partner)} sx={{ borderRadius: 2, mb: 0.5 }}>
                      <ListItemAvatar>
                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem' }}>{partner.name.charAt(0)}</Avatar>
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
            <Button variant="outlined" startIcon={<LocalFireDepartmentIcon />}
              onClick={() => { setBetNode(claimNode); setClaimNode(null); }}
              sx={{ color: '#F59E0B', borderColor: '#F59E0B' }}>
              Bet Instead
            </Button>
            <Button variant="contained" disabled={!selectedVerifier || !evidenceFile || submittingClaim || uploadingEvidence}
              onClick={handleSendClaim}>
              {uploadingEvidence ? 'Uploading...' : submittingClaim ? 'Sending...' : 'Send Verification'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Achievement dialog ───────────────────────────────────── */}
        <Dialog open={!!achieveNode} onClose={() => setAchieveNode(null)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { borderRadius: '20px', border: '1px solid rgba(245,158,11,0.3)', background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(139,92,246,0.06))' } }}>
          <DialogTitle sx={{ fontWeight: 700, textAlign: 'center', pt: 3 }}>
            <Typography variant="h2" sx={{ mb: 1 }}>🏆</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Goal Completed!
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ textAlign: 'center', fontWeight: 600, mb: 0.5 }}>{achieveNode?.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 2.5 }}>
              Share the win and inspire your network.
            </Typography>
            <Button fullWidth variant="outlined" size="small" startIcon={<ShareIcon />}
              sx={{ borderRadius: '10px', mb: 1, borderColor: 'rgba(245,158,11,0.4)', color: 'primary.main' }}
              onClick={() => {
                const text = `Just completed "${achieveNode?.title}" on Praxis. Consistent effort pays off.`;
                if (navigator.share) { navigator.share({ text }).catch(() => {}); }
                else { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank'); }
              }}>
              Share your win
            </Button>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 1 }}>
            <Button fullWidth variant="contained" onClick={handleClaimAchievement} disabled={claimingAchievement}
              startIcon={<EmojiEventsIcon />}
              sx={{ borderRadius: '12px', py: 1.25, background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)', fontWeight: 700 }}>
              {claimingAchievement ? 'Posting...' : 'Post to Community Feed'}
            </Button>
            <Button onClick={() => setAchieveNode(null)} sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>Not now</Button>
          </DialogActions>
        </Dialog>

        {/* ── Suspend dialog ──────────────────────────────────────── */}
        <Dialog open={!!suspendNode} onClose={() => setSuspendNode(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Suspend Goal</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Suspending <strong>{suspendNode?.title}</strong> will pause it. Costs <strong>50 PP</strong>.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setSuspendNode(null)}>Cancel</Button>
            <Button variant="contained" color="warning" disabled={suspending}
              onClick={async () => {
                if (!suspendNode || !currentUserId) return;
                setSuspending(true);
                try {
                  await axios.post(`${API_URL}/points/spend`, { userId: currentUserId, item: 'suspend_goal', nodeId: suspendNode.id });
                  toast.success('Goal suspended!');
                  setSuspendNode(null);
                  await refreshTree();
                } catch (e: any) {
                  toast.error(e.response?.data?.message || 'Failed to suspend goal');
                } finally { setSuspending(false); }
              }}
              sx={{ borderRadius: '10px' }}>
              {suspending ? <CircularProgress size={18} color="inherit" /> : 'Confirm (50 PP)'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Node Journal Drawer */}
        <NodeJournalDrawer open={!!journalNode} node={journalNode} onClose={() => setJournalNode(null)} />
      </Container>
    </ErrorBoundary>
  );
};

export default NotesPage;
