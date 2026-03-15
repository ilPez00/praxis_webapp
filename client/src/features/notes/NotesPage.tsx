import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import { GoalNode as FrontendGoalNode, Domain } from '../../types/goal';
import { DOMAIN_TRACKER_MAP } from '../trackers/trackerTypes';
import NotesCardTree from './NotesCardTree';
import GoalWorkspaceSheet, { ActionItem } from '../goals/components/GoalWorkspaceSheet';
import TrackerSection from '../trackers/TrackerSection';
import GoalWidgets from '../dashboard/components/GoalWidgets';
import WeeklyNarrativeWidget from '../dashboard/components/WeeklyNarrativeWidget';
import NodeJournalDrawer from '../goals/NodeJournalDrawer';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import GlassCard from '../../components/common/GlassCard';

import {
  Container, Box, Typography, Stack, CircularProgress,
  Chip, useTheme, useMediaQuery,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';

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

/** Walk up parentId chain to find the root domain */
function getNodeDomain(nodeId: string, allNodes: any[]): string {
  const node = allNodes.find((n: any) => n.id === nodeId);
  if (!node) return 'Personal Goals';
  if (node.domain) return node.domain;
  if (!node.parentId) return 'Personal Goals';
  return getNodeDomain(node.parentId, allNodes);
}

/** Notes-specific actions — no edit/suspend, adds share */
const NOTES_ACTIONS: ActionItem[] = [
  { key: 'journal', icon: '📓', label: 'Journal' },
  { key: 'bet', icon: '🎰', label: 'Bet' },
  { key: 'verify', icon: '✅', label: 'Verify' },
  { key: 'share', icon: '📤', label: 'Share' },
];

const NotesPage: React.FC = () => {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [treeData, setTreeData] = useState<FrontendGoalNode[]>([]);
  const [backendNodes, setBackendNodes] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [streak, setStreak] = useState<number>(0);

  const [selectedNode, setSelectedNode] = useState<FrontendGoalNode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [journalNode, setJournalNode] = useState<FrontendGoalNode | null>(null);
  const [activeLogType, setActiveLogType] = useState<string | null>(null);
  const [activeBets, setActiveBets] = useState<any[]>([]);

  const currentUserId = user?.id;

  // ── Data fetching ──────────────────────────────────────────────
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
          .select('current_streak')
          .eq('id', currentUserId)
          .single();

        if (profile?.current_streak) setStreak(profile.current_streak);

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

  // ── Handlers ───────────────────────────────────────────────────
  const handleNodeSelect = (node: FrontendGoalNode) => {
    setSelectedNode(node);
    setSheetOpen(true);
  };

  const handleProgressUpdate = async (nodeId: string, progress: number) => {
    if (!currentUserId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await axios.patch(
        `${API_URL}/goals/${currentUserId}/node/${nodeId}/progress`,
        { progress },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      toast.success(`Progress updated to ${progress}%`);
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
        const freshNode = flattenTree(freshTree).find(n => n.id === nodeId);
        if (freshNode) setSelectedNode(freshNode);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update progress.');
    }
  };

  const handleLogTracker = (trackerType: string, _goalNode: FrontendGoalNode) => {
    setActiveLogType(trackerType);
    // Clear after a tick so the prop change triggers the effect in TrackerSection
    setTimeout(() => setActiveLogType(null), 100);
  };

  const handleAction = (action: string, node: FrontendGoalNode) => {
    switch (action) {
      case 'journal':
        setJournalNode(node);
        break;
      case 'bet':
      case 'verify':
        navigate('/goals');
        break;
      case 'share': {
        const text = `Working on "${node.title}" — ${node.progress}% complete on Praxis! 🎯`;
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

  const handleAddSubgoal = (_parentId: string) => {
    navigate('/goals');
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
              Notes & Tracking
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track progress, log entries, review insights
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {streak > 0 && (
              <Chip
                icon={<LocalFireDepartmentIcon sx={{ color: '#F59E0B !important' }} />}
                label={`${streak}d streak`}
                size="small"
                sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B', fontWeight: 700 }}
              />
            )}
            {treeData.length > 0 && (
              <Chip
                icon={<TrackChangesIcon sx={{ color: '#60A5FA !important' }} />}
                label={`${treeData.length} goals`}
                size="small"
                sx={{ bgcolor: 'rgba(96,165,250,0.1)', color: '#60A5FA', fontWeight: 700 }}
              />
            )}
          </Stack>
        </Box>

        {treeData.length === 0 ? (
          <GlassCard sx={{ p: 4, textAlign: 'center' }}>
            <TrackChangesIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>No goals yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Start your journey by creating your first goal
            </Typography>
            <Box
              onClick={() => navigate('/goals')}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                color: '#A78BFA', fontWeight: 700, fontSize: '0.9rem',
                '&:hover': { color: '#C4B5FD' },
              }}
            >
              Go to Goals →
            </Box>
          </GlassCard>
        ) : (
          <Box sx={{ display: 'flex', height: { xs: 'auto', md: 'calc(100vh - 200px)' } }}>
            {/* Tree panel — with tracker pills on active roots */}
            <Box sx={{
              width: { xs: '100%', md: '40%' },
              overflowY: 'auto',
              borderRight: { xs: 'none', md: '1px solid rgba(255,255,255,0.06)' },
            }}>
              <NotesCardTree
                nodes={treeData}
                selectedNodeId={selectedNode?.id ?? null}
                onNodeSelect={handleNodeSelect}
                onLogTracker={handleLogTracker}
              />
            </Box>

            {/* Desktop: right panel — workspace + trackers + insights */}
            {!isMobile && (
              <Box sx={{ width: '60%', overflowY: 'auto' }}>
                {selectedNode ? (
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
                    actions={NOTES_ACTIONS}
                  />
                ) : (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.2)', py: 6,
                  }}>
                    <Typography sx={{ color: 'inherit' }}>Select a goal to track progress</Typography>
                  </Box>
                )}

                {/* Goal widget (bars, mini chart, quick log) + Trackers — filtered to domain */}
                {currentUserId && selectedNode && (() => {
                  const domain = getNodeDomain(selectedNode.id, backendNodes);
                  const domainTrackers = (DOMAIN_TRACKER_MAP as Record<string, string[]>)[domain] || [];
                  const selectedBackendNode = backendNodes.filter(n => n.id === selectedNode.id);
                  return (
                    <Box sx={{ px: 2.5, pb: 3 }}>
                      <Stack spacing={3}>
                        <GoalWidgets
                          userId={currentUserId}
                          allNodes={selectedBackendNode}
                          activeBets={activeBets}
                          onProgressUpdate={(nodeId, newProgress) => {
                            handleProgressUpdate(nodeId, newProgress);
                          }}
                        />
                        {domainTrackers.length > 0 && (
                          <TrackerSection userId={currentUserId} filterTypes={domainTrackers} initialLogType={activeLogType} />
                        )}
                        <WeeklyNarrativeWidget userId={currentUserId} />
                      </Stack>
                    </Box>
                  );
                })()}
              </Box>
            )}
          </Box>
        )}

        {/* Mobile: bottom sheet */}
        {isMobile && (
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
            actions={NOTES_ACTIONS}
          />
        )}

        {/* Mobile: widget + trackers below tree — filtered to selected goal's domain */}
        {isMobile && currentUserId && selectedNode && (() => {
          const domain = getNodeDomain(selectedNode.id, backendNodes);
          const domainTrackers = (DOMAIN_TRACKER_MAP as Record<string, string[]>)[domain] || [];
          const selectedBackendNode = backendNodes.filter(n => n.id === selectedNode.id);
          return (
            <Box sx={{ mt: 4, px: 2 }}>
              <Stack spacing={3}>
                <GoalWidgets
                  userId={currentUserId}
                  allNodes={selectedBackendNode}
                  activeBets={activeBets}
                  onProgressUpdate={(nodeId, newProgress) => {
                    handleProgressUpdate(nodeId, newProgress);
                  }}
                />
                {domainTrackers.length > 0 && (
                  <TrackerSection userId={currentUserId} filterTypes={domainTrackers} initialLogType={activeLogType} />
                )}
                <WeeklyNarrativeWidget userId={currentUserId} />
              </Stack>
            </Box>
          );
        })()}

        {/* Node Journal Drawer */}
        <NodeJournalDrawer
          open={!!journalNode}
          node={journalNode}
          onClose={() => setJournalNode(null)}
        />
      </Container>
    </ErrorBoundary>
  );
};

export default NotesPage;
