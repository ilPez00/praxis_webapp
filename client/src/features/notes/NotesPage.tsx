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
import ClickableDiaryFeed from './ClickableDiaryFeed';
import ActivityCalendar from './ActivityCalendar';
import DayDetailView from './DayDetailView';
import GoalNotesPanel from './GoalNotesPanel';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import Slider from '@mui/material/Slider';

import {
  Container, Box, Typography, Stack, CircularProgress,
  Chip, useTheme, useMediaQuery, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, TextField, MenuItem,
  List, ListItem, ListItemButton, ListItemAvatar, ListItemText, Avatar, Divider,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import VerifiedIcon from '@mui/icons-material/Verified';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';

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

  // Diary export
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState<'plain' | 'axiom' | 'notes' | null>(null);
  const [axiomNarrative, setAxiomNarrative] = useState<string | null>(null);

  const currentUserId = user?.id;

  // ── Diary export handlers ─────────────────────────────────────
  const handleExportPlain = async () => {
    if (!currentUserId) return;
    setExporting('plain');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/diary/export/plain`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `praxis-diary-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Diary downloaded!');
      setExportDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to export diary');
    } finally {
      setExporting(null);
    }
  };

  const handleExportNotes = async () => {
    if (!currentUserId) return;
    setExporting('notes');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/diary/export/notes`, {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `praxis-notes-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Complete Notes Export downloaded!');
      if (!user?.is_premium) setPraxisPoints(prev => (prev ?? 0) - 500);
      setExportDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to export notes');
    } finally {
      setExporting(null);
    }
  };

  const handleExportAxiom = async () => {
    if (!currentUserId) return;
    setExporting('axiom');
    setAxiomNarrative(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await axios.post(`${API_URL}/diary/export/axiom`, {}, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      setAxiomNarrative(res.data.narrative);
      setPraxisPoints(prev => (prev ?? 0) - 500);
      toast.success(`Axiom diary created! (${res.data.entryCount} entries)`);

      // Trigger automatic download
      const blob = new Blob([res.data.narrative], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `praxis-axiom-diary-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDialogOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to generate';
      toast.error(msg);
    } finally {
      setExporting(null);
    }
  };

  const downloadAxiomNarrative = () => {
    if (!axiomNarrative) return;
    const blob = new Blob([axiomNarrative], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `praxis-axiom-diary-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        } else {
          setBackendNodes([]);
          setTreeData([]);
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
        setBackendNodes([]);
        setTreeData([]);
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
    if (isMobile) {
      setTimeout(() => {
        mobileDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleProgressUpdate = async (nodeId: string, progress: number) => {
    if (!currentUserId) return;
    if (!nodeId || nodeId.trim().length === 0) {
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
    if (isMobile) {
      setTimeout(() => {
        mobileDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleOpenEdit = (node: FrontendGoalNode, branch = false) => {
    setEditingNode(node);
    setIsBranching(branch);
    if (branch) {
      setEditName(''); setEditDesc(''); setEditMetric(''); setEditTargetDate(''); setEditProgress(0);
    } else {
      setEditName(node.title); setEditDesc(node.description || ''); setEditProgress(node.progress);
      const bNode = backendNodes.find(n => n.id === node.id);
      setEditMetric(bNode?.completionMetric || ''); setEditTargetDate(bNode?.targetDate || '');
    }
  };

  const handleAddNewGoal = () => {
    setEditingNode(null); setNewGoalDomain(''); setIsBranching(true);
    setEditName(''); setEditDesc(''); setEditMetric(''); setEditTargetDate(''); setEditProgress(0);
  };

  const handleAddGoalInDomain = (domain: string) => {
    setEditingNode(null); setNewGoalDomain(domain as Domain); setIsBranching(true);
    setEditName(''); setEditDesc(''); setEditMetric(''); setEditTargetDate(''); setEditProgress(0);
  };

  const handleAddSubgoal = (parentId: string) => {
    const parent = flattenTree(treeData).find(n => n.id === parentId);
    if (parent) handleOpenEdit(parent, true);
  };

  const handleAction = (action: string, node: FrontendGoalNode) => {
    switch (action) {
      case 'journal': setJournalNode(node); break;
      case 'edit': handleOpenEdit(node, false); break;
      case 'bet': setBetNode(node); break;
      case 'verify': setClaimNode(node); setSelectedVerifier(null); if (currentUserId) fetchDMPartners(currentUserId); break;
      case 'suspend': setSuspendNode(node); break;
      case 'share': {
        const text = `Working on "${node.title}" — ${node.progress}% complete on Praxis!`;
        if (navigator.share) { navigator.share({ text }).catch(() => {}); }
        else { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank'); }
        break;
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!currentUserId || !editName.trim()) return;
    if (isBranching && !editingNode && !newGoalDomain) {
      toast.error('Please select a domain.'); return;
    }
    setSavingEdit(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { Authorization: `Bearer ${session?.access_token}` };
      if (isBranching) {
        const domain = editingNode ? editingNode.domain : (newGoalDomain as Domain);
        const parentId = editingNode ? editingNode.id : undefined;
        const res = await axios.post(`${API_URL}/goals/${currentUserId}/node`, {
          name: editName.trim(), description: editDesc.trim() || undefined,
          completionMetric: editMetric.trim() || undefined, targetDate: editTargetDate || undefined,
          parentId, domain,
        }, { headers });
        toast.success(parentId ? 'Chapter added!' : 'Topic added!');
        if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
      } else if (editingNode) {
        const bNode = backendNodes.find(n => n.id === editingNode.id);
        const metadataChanged = editName.trim() !== bNode?.name || (editDesc.trim() || undefined) !== bNode?.customDetails ||
          (editMetric.trim() || undefined) !== bNode?.completionMetric || (editTargetDate || undefined) !== bNode?.targetDate;
        if (metadataChanged) {
          const res = await axios.patch(`${API_URL}/goals/${currentUserId}/node/${editingNode.id}`, {
            name: editName.trim(), description: editDesc.trim() || undefined,
            completionMetric: editMetric.trim() || undefined, targetDate: editTargetDate || undefined,
          }, { headers });
          toast.success('Updated!');
          if (res.data.newBalance !== undefined) setPraxisPoints(res.data.newBalance);
        }
        if (editProgress !== editingNode.progress) {
          await axios.patch(`${API_URL}/goals/${currentUserId}/node/${editingNode.id}/progress`, { progress: editProgress }, { headers });
          if (editProgress === 100) setTimeout(() => setAchieveNode({ ...editingNode, progress: 100 }), 400);
        }
      }
      setEditingNode(null); setIsBranching(false);
      const freshTree = await refreshTree();
      if (freshTree && editingNode) {
        const freshNode = flattenTree(freshTree).find(n => n.id === editingNode.id);
        if (freshNode) setSelectedNode(freshNode);
      }
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to save.'); }
    finally { setSavingEdit(false); }
  };

  const handlePlaceBet = async () => {
    if (!betNode || !currentUserId || !betDeadline || betStake < 1) return;
    setPlacingBet(true);
    try {
      await axios.post(`${API_URL}/bets`, {
        userId: currentUserId, goalNodeId: betNode.id, goalName: betNode.title,
        deadline: new Date(betDeadline).toISOString(), stakePoints: betStake,
      });
      setPraxisPoints(p => (p !== null ? p - betStake : null));
      toast.success(`Bet placed!`);
      setBetNode(null);
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to place bet.'); }
    finally { setPlacingBet(false); }
  };

  const handleClaimAchievement = async () => {
    if (!achieveNode || !currentUserId) return;
    setClaimingAchievement(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', currentUserId).single();
      await axios.post(`${API_URL}/achievements`, {
        userId: currentUserId, userName: profile?.name || 'User', userAvatarUrl: profile?.avatar_url || undefined,
        goalNodeId: achieveNode.id, title: achieveNode.title, description: achieveNode.description, domain: achieveNode.domain,
      }, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      toast.success('Posted!'); setAchieveNode(null);
    } catch { toast.error('Failed to post.'); }
    finally { setClaimingAchievement(false); }
  };

  const handleSendClaim = async () => {
    if (!claimNode || !selectedVerifier || !currentUserId || !evidenceFile) return;
    setUploadingEvidence(true);
    try {
      const ext = evidenceFile.name.split('.').pop();
      const path = `evidence/${currentUserId}/${claimNode.id}_${Date.now()}.${ext}`;
      await supabase.storage.from('goal-evidence').upload(path, evidenceFile, { upsert: true });
      const { data: urlData } = supabase.storage.from('goal-evidence').getPublicUrl(path);
      setSubmittingClaim(true);
      await axios.post(`${API_URL}/completions`, {
        requesterId: currentUserId, verifierId: selectedVerifier.userId,
        goalNodeId: claimNode.id, goalName: claimNode.title, evidenceUrl: urlData.publicUrl,
      });
      toast.success(`Request sent!`); setClaimNode(null); setEvidenceFile(null);
    } catch (err: any) { toast.error(err.message || 'Failed.'); }
    finally { setUploadingEvidence(false); setSubmittingClaim(false); }
  };

  if (userLoading || loadingContent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0a0b14' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0a0b14', overflow: 'hidden' }}>
        
        {/* ── LEFT SIDEBAR: Hierarchical Notebook TOC ── */}
        <Box sx={{
          width: isMobile ? '100%' : '320px',
          minWidth: isMobile ? '100%' : '320px',
          display: isMobile && selectedNode ? 'none' : 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          height: '100%',
          bgcolor: 'rgba(13,14,26,0.6)',
          backdropFilter: 'blur(10px)',
          overflowY: 'auto',
          zIndex: 10,
        }}>
          {/* Header */}
          <Box sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '-0.02em' }}>
                Notebook
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                {treeData.length} TOPICS
              </Typography>
            </Box>
            {praxisPoints !== null && (
              <Chip
                label={`${praxisPoints} PP`}
                size="small"
                sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 800, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          {/* Tree Section */}
          <Box sx={{ flex: 1 }}>
            {treeData.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Your notebook is empty.
                </Typography>
                <Button fullWidth variant="contained" onClick={handleAddNewGoal} startIcon={<AddIcon />}>
                  New Topic
                </Button>
              </Box>
            ) : (
              <NotesCardTree
                nodes={treeData}
                selectedNodeId={selectedNode?.id ?? null}
                onNodeSelect={handleNodeSelect}
                onLogTracker={handleLogTracker}
                onAddGoalInDomain={handleAddGoalInDomain}
                onAddSubgoal={handleAddSubgoal}
                onEdit={node => handleOpenEdit(node, false)}
              />
            )}
          </Box>

          {/* Bottom actions */}
          <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <Button
              fullWidth variant="outlined" startIcon={<DownloadIcon />}
              onClick={() => setExportDialogOpen(true)}
              sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }}
            >
              Download Notebook
            </Button>
          </Box>
        </Box>

        {/* ── RIGHT PANEL: Content Area ── */}
        <Box sx={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          display: isMobile && !selectedNode ? 'none' : 'block',
          bgcolor: '#0a0b14',
          position: 'relative',
        }}>
          <Box sx={{ maxWidth: '900px', mx: 'auto', p: { xs: 2, md: 4 }, pb: 10 }}>
            
            {/* 1. TOP: Activity Calendar (Persistent) */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, color: 'text.primary', opacity: 0.9 }}>
                Activity Calendar
              </Typography>
              {currentUserId && (
                <ActivityCalendar
                  userId={currentUserId}
                  onDaySelect={(date) => setSelectedCalendarDate(date)}
                />
              )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 4 }} />

            {/* 2. MIDDLE: Selected Goal or Overview */}
            {selectedNode ? (
              <Stack spacing={4}>
                {/* Back button on mobile */}
                {isMobile && (
                  <Button
                    startIcon={<AccountTreeIcon />}
                    onClick={() => setSelectedNode(null)}
                    sx={{ alignSelf: 'flex-start', color: 'primary.main' }}
                  >
                    Back to TOC
                  </Button>
                )}

                {/* 1. Management Actions (Workspace Sheet actions) */}
                <Box sx={{
                  p: 3, borderRadius: '24px',
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800, mb: 2, display: 'block' }}>
                    Management Actions
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {NOTES_ACTIONS.map(action => (
                      <Button
                        key={action.key}
                        variant="outlined"
                        startIcon={<span>{action.icon}</span>}
                        onClick={() => handleAction(action.key, selectedNode)}
                        sx={{
                          borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.8)', px: 2,
                          '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(139,92,246,0.05)' }
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Box>
                </Box>

                {/* 2. Notes Panel for Goal */}
                <GoalNotesPanel
                  nodeId={selectedNode.id}
                  nodeTitle={selectedNode.title}
                  userId={currentUserId || ''}
                />

                {/* 3. Goal Detail, Trackers (Widgets) & Activity Graph */}
                <NoteGoalDetail
                  node={selectedNode}
                  allNodes={backendNodes}
                  userId={currentUserId || ''}
                  activeBets={activeBets}
                  onProgressUpdate={handleProgressUpdate}
                  focusedTrackerType={activeLogType}
                />
              </Stack>
            ) : null}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', my: 6 }} />

            {/* 3. BOTTOM: Global Logs & Free Notes (Persistent) */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MenuBookIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
                Notebook Logs
              </Typography>
              
              {currentUserId && (
                <Stack spacing={4}>
                  {/* General Diary Feed */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 800, mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Recent Activity
                    </Typography>
                    <ClickableDiaryFeed userId={currentUserId} />
                  </Box>
                </Stack>
              )}
            </Box>
          </Box>
        </Box>

        {/* ── Edit/Branch dialog ── */}
        <Dialog open={isBranching || !!editingNode} onClose={() => { setEditingNode(null); setIsBranching(false); }} maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' } }}>
          <DialogTitle sx={{ fontWeight: 700 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isBranching ? <AddCircleOutlineIcon sx={{ color: 'primary.main' }} /> : <EditNoteIcon sx={{ color: 'primary.main' }} />}
              {isBranching
                ? (editingNode ? `New Chapter under: ${editingNode.title}` : 'New Topic')
                : 'Edit Topic'}
            </Box>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {isBranching && !editingNode && (
                <TextField select fullWidth label="Domain" value={newGoalDomain} onChange={e => setNewGoalDomain(e.target.value as Domain)}>
                  {Object.values(Domain).map(dom => <MenuItem key={dom} value={dom}>{dom}</MenuItem>)}
                </TextField>
              )}
              <TextField fullWidth label="Name" value={editName} onChange={e => setEditName(e.target.value)} placeholder={isBranching ? "What is the new topic?" : "Topic name"} />
              <TextField fullWidth label="Description" multiline rows={2} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Why is this important?" />
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
                  <Slider value={editProgress} onChange={(_, v) => setEditProgress(v as number)} min={0} max={100} step={5} sx={{ color: editProgress === 100 ? '#10B981' : '#F59E0B' }} />
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => { setEditingNode(null); setIsBranching(false); }} sx={{ color: 'text.secondary' }}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEdit} disabled={savingEdit || !editName.trim()} sx={{ borderRadius: '10px' }}>
              {savingEdit ? 'Saving...' : (isBranching ? (editingNode ? 'Add Chapter (150 PP)' : 'Add Topic (150 PP)') : (
                (editingNode && (editName.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.name || '') ||
                 editDesc.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.customDetails || '') ||
                 editMetric.trim() !== (backendNodes.find(n => n.id === editingNode?.id)?.completionMetric || '') ||
                 editTargetDate !== (backendNodes.find(n => n.id === editingNode?.id)?.targetDate || '')
                )) ? 'Save Details (50 PP)' : 'Save Progress'
              ))}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Betting dialog */}
        <Dialog open={!!betNode} onClose={() => setBetNode(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>🎰 Bet on this Goal</DialogTitle>
          <DialogContent>
            <TextField fullWidth type="date" label="Deadline" InputLabelProps={{ shrink: true }} sx={{ mt: 2 }}
              value={betDeadline} onChange={e => setBetDeadline(e.target.value)} />
            <TextField fullWidth type="number" label="Stake (PP)" sx={{ mt: 2 }}
              value={betStake} onChange={e => setBetStake(parseInt(e.target.value))} />
          </DialogContent>
          <DialogActions><Button onClick={() => setBetNode(null)}>Cancel</Button><Button variant="contained" onClick={handlePlaceBet}>Place Bet</Button></DialogActions>
        </Dialog>

        {/* Verification dialog */}
        <Dialog open={!!claimNode} onClose={() => setClaimNode(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>✅ Request Verification</DialogTitle>
          <DialogContent>
            <Button variant="outlined" component="label" sx={{ my: 2 }}>
              {evidenceFile ? evidenceFile.name : 'Upload Evidence'}
              <input type="file" hidden onChange={e => setEvidenceFile(e.target.files?.[0] ?? null)} />
            </Button>
            <List dense>
              {dmPartners.map(p => (
                <ListItem key={p.userId} disablePadding>
                  <ListItemButton selected={selectedVerifier?.userId === p.userId} onClick={() => setSelectedVerifier(p)}>
                    <ListItemText primary={p.name} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions><Button onClick={() => setClaimNode(null)}>Cancel</Button><Button variant="contained" onClick={handleSendClaim} disabled={!selectedVerifier || !evidenceFile}>Send</Button></DialogActions>
        </Dialog>

        <NodeJournalDrawer open={!!journalNode} node={journalNode} onClose={() => setJournalNode(null)} />

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onClose={() => !exporting && setExportDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DownloadIcon sx={{ color: '#A78BFA' }} />
              Export Your Notebook
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Download your goals, notes, trackers, and accountability network
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Plain Text Export - FREE */}
              <Box
                onClick={exporting ? undefined : handleExportPlain}
                sx={{
                  p: 2.5, borderRadius: '16px', cursor: exporting ? 'default' : 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(255,255,255,0.03)',
                  '&:hover': exporting ? {} : { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.2)' },
                  opacity: exporting && exporting !== 'plain' ? 0.4 : 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <DescriptionIcon sx={{ color: '#9CA3AF' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Plain Text Notebook</Typography>
                  <Chip label="FREE" size="small" sx={{ height: 18, bgcolor: 'rgba(148,163,184,0.2)', color: '#94A3B8' }} />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Raw chronological export of all entries, check-ins, and achievements
                </Typography>
                {exporting === 'plain' && (
                  <Box sx={{ mt: 1.5 }}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    <Typography variant="caption" color="text.secondary">Preparing download...</Typography>
                  </Box>
                )}
              </Box>

              {/* Notes Export - PREMIUM (500 PP or Pro) */}
              <Box
                onClick={exporting ? undefined : handleExportNotes}
                sx={{
                  p: 2.5, borderRadius: '16px', cursor: exporting ? 'default' : 'pointer',
                  border: '1px solid rgba(167,139,250,0.3)', bgcolor: 'rgba(167,139,250,0.06)',
                  '&:hover': exporting ? {} : { bgcolor: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.5)' },
                  opacity: exporting && exporting !== 'notes' ? 0.4 : 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <MenuBookIcon sx={{ color: '#A78BFA' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Complete Notebook Export</Typography>
                  {user?.is_premium ? (
                    <Chip label="PRO" size="small" sx={{ height: 18, bgcolor: 'rgba(245,158,11,0.2)', color: '#F59E0B' }} />
                  ) : (
                    <Chip label="500 PP" size="small" sx={{ height: 18, bgcolor: 'rgba(167,139,250,0.2)', color: '#A78BFA' }} />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Comprehensive export including goals, accountability partners, trackers, check-ins, achievements, and diary entries (formatted as Markdown)
                </Typography>
                <Box sx={{ mt: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip label="🎯 Goals" size="small" sx={{ height: 18, fontSize: '0.55rem' }} />
                  <Chip label="🤝 Partners" size="small" sx={{ height: 18, fontSize: '0.55rem' }} />
                  <Chip label="📊 Trackers" size="small" sx={{ height: 18, fontSize: '0.55rem' }} />
                  <Chip label="📓 Diary" size="small" sx={{ height: 18, fontSize: '0.55rem' }} />
                </Box>
                {exporting === 'notes' && (
                  <Box sx={{ mt: 1.5 }}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    <Typography variant="caption" color="text.secondary">Generating comprehensive export...</Typography>
                  </Box>
                )}
              </Box>

              {/* Axiom Narrative - 500 PP */}
              <Box
                onClick={exporting ? undefined : handleExportAxiom}
                sx={{
                  p: 2.5, borderRadius: '16px', cursor: exporting ? 'default' : 'pointer',
                  border: '1px solid rgba(245,158,11,0.3)', bgcolor: 'rgba(245,158,11,0.06)',
                  '&:hover': exporting ? {} : { bgcolor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.5)' },
                  opacity: exporting && exporting !== 'axiom' ? 0.4 : 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AutoAwesomeIcon sx={{ color: '#F59E0B' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Axiom AI Narrative</Typography>
                  <Chip label="500 PP" size="small" sx={{ height: 18, bgcolor: 'rgba(245,158,11,0.2)', color: '#F59E0B' }} />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  AI-generated coaching narrative analyzing your patterns, progress, and recommendations
                </Typography>
                {exporting === 'axiom' && (
                  <Box sx={{ mt: 1.5 }}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    <Typography variant="caption" color="text.secondary">Generating AI narrative...</Typography>
                  </Box>
                )}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)} disabled={!!exporting}>Close</Button>
          </DialogActions>
        </Dialog>

      </Box>
    </ErrorBoundary>
  );
};

export default NotesPage;
