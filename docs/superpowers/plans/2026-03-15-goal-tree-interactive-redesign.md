# Goal Tree Interactive Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SVG radial/vertical goal tree with an interactive card tree + bottom sheet workspace that works well on mobile and makes goals the primary interaction surface.

**Architecture:** Collapsible card tree (DOM-based, no SVG) with domain sections and goal cards. Tapping a goal opens a bottom sheet (mobile) or right panel (desktop) with progress slider, smart tracker button, sub-goals list, and action icons. GoalTreePage is rewritten as a thin orchestrator (~300 lines down from 945), delegating display to GoalCardTree and interaction to GoalWorkspaceSheet.

**Tech Stack:** React, MUI v7 (SwipeableDrawer, Slider, Grid, Box), TypeScript, existing GoalNode type + DOMAIN_TRACKER_MAP + DOMAIN_COLORS/DOMAIN_ICONS from codebase.

**Spec:** `docs/superpowers/specs/2026-03-15-goal-tree-interactive-redesign.md`

---

## Chunk 1: GoalCardTree Component

### Task 1: Create GoalCardTree — collapsible card tree

**Files:**
- Create: `client/src/features/goals/components/GoalCardTree.tsx`

- [ ] **Step 1: Create GoalCardTree component**

```tsx
// client/src/features/goals/components/GoalCardTree.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import { GoalNode, Domain, DOMAIN_COLORS, DOMAIN_ICONS } from '../../../types/goal';

interface GoalCardTreeProps {
  nodes: GoalNode[];             // nested tree from buildFrontendTree
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onAddGoal: () => void;
  readOnly?: boolean;
}

// Group root nodes by domain
function groupByDomain(nodes: GoalNode[]): Record<string, GoalNode[]> {
  return nodes.reduce((acc, n) => {
    const domain = n.domain || 'Personal Goals';
    (acc[domain] ??= []).push(n);
    return acc;
  }, {} as Record<string, GoalNode[]>);
}

// Average progress of goals in a domain
function domainProgress(goals: GoalNode[]): number {
  if (goals.length === 0) return 0;
  return Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
}

// Recursive goal card renderer
const GoalCard: React.FC<{
  node: GoalNode;
  depth: number;
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
}> = ({ node, depth, selectedNodeId, onNodeSelect }) => {
  const isSelected = node.id === selectedNodeId;
  const isSuspended = node.status === 'suspended';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <Box sx={{ ml: depth > 0 ? 2 : 0 }}>
      <Box
        ref={ref}
        onClick={() => onNodeSelect(node)}
        sx={{
          p: '10px 14px',
          borderRadius: '12px',
          mb: 0.75,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: isSelected ? 'rgba(139,92,246,0.06)' : 'rgba(255,255,255,0.02)',
          border: '1px solid',
          borderColor: isSelected ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)',
          boxShadow: isSelected ? '0 0 12px rgba(139,92,246,0.15)' : 'none',
          opacity: isSuspended ? 0.35 : 1,
          filter: isSuspended ? 'grayscale(0.8)' : 'none',
          '&:hover': {
            background: isSelected ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.04)',
            borderColor: isSelected ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: depth > 0 ? '0.85rem' : '0.9rem' }}>
            {isSuspended ? '⏸ ' : ''}{node.title}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#A78BFA' }}>
            {node.progress}%
          </Typography>
        </Box>
        <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <Box sx={{
            height: '100%',
            width: `${node.progress}%`,
            background: 'linear-gradient(90deg, #F59E0B, #8B5CF6)',
            borderRadius: 2,
          }} />
        </Box>
        {/* Sub-goal pills (only for root goals with children) */}
        {depth === 0 && node.children.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {node.children.slice(0, 3).map(child => (
              <Box key={child.id} sx={{
                fontSize: '0.625rem', px: 1, py: 0.25, borderRadius: '6px',
                bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis', maxWidth: 120,
              }}>
                {child.title}
              </Box>
            ))}
            {node.children.length > 3 && (
              <Box sx={{ fontSize: '0.625rem', px: 1, py: 0.25, color: 'rgba(255,255,255,0.3)' }}>
                +{node.children.length - 3}
              </Box>
            )}
          </Box>
        )}
      </Box>
      {/* Render children recursively */}
      {node.children.map(child => (
        <GoalCard
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedNodeId={selectedNodeId}
          onNodeSelect={onNodeSelect}
        />
      ))}
    </Box>
  );
};

const GoalCardTree: React.FC<GoalCardTreeProps> = ({
  nodes, selectedNodeId, onNodeSelect, onAddGoal, readOnly,
}) => {
  const rootsByDomain = groupByDomain(nodes);
  const domainKeys = Object.keys(rootsByDomain);

  // All domains start expanded
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleDomain = (domain: string) => {
    setCollapsed(prev => ({ ...prev, [domain]: !prev[domain] }));
  };

  return (
    <Box sx={{ p: 2 }}>
      {domainKeys.map(domain => {
        const goals = rootsByDomain[domain];
        const progress = domainProgress(goals);
        const icon = DOMAIN_ICONS[domain] || '🎯';
        const color = DOMAIN_COLORS[domain] || DOMAIN_COLORS['defaultDomain'];
        const isCollapsed = collapsed[domain] ?? false;

        return (
          <Box key={domain} sx={{ mb: 2 }}>
            {/* Domain header */}
            <Box
              onClick={() => toggleDomain(domain)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 1, cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', color, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}>
                ▼
              </Typography>
              <Typography sx={{ fontSize: '1rem' }}>{icon}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '0.03em' }}>
                {domain.toUpperCase()}
              </Typography>
              <Box sx={{ flex: 1, height: 3, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 2, ml: 1 }}>
                <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: `${color}66`, borderRadius: 2 }} />
              </Box>
              <Typography sx={{ fontSize: '0.7rem', opacity: 0.4 }}>{progress}%</Typography>
            </Box>
            {/* Goals under this domain */}
            <Collapse in={!isCollapsed}>
              <Box sx={{ ml: 1.5 }}>
                {goals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    node={goal}
                    depth={0}
                    selectedNodeId={selectedNodeId}
                    onNodeSelect={onNodeSelect}
                  />
                ))}
              </Box>
            </Collapse>
          </Box>
        );
      })}

      {/* Add new goal button */}
      {!readOnly && (
        <Box
          onClick={onAddGoal}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, pt: 1.5, mt: 1,
            borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem',
            '&:hover': { color: 'rgba(255,255,255,0.5)' },
          }}
        >
          <Typography sx={{ fontSize: '1.1rem' }}>+</Typography>
          <Typography>Add new goal</Typography>
        </Box>
      )}
    </Box>
  );
};

export default GoalCardTree;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd client && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20`
Expected: No errors from GoalCardTree.tsx

- [ ] **Step 3: Commit**

```bash
git add client/src/features/goals/components/GoalCardTree.tsx
git commit -m "feat: GoalCardTree — collapsible card tree replacing SVG visualizations"
```

---

## Chunk 2: GoalWorkspaceSheet Component

### Task 2: Create GoalWorkspaceSheet — bottom sheet / right panel

**Files:**
- Create: `client/src/features/goals/components/GoalWorkspaceSheet.tsx`

- [ ] **Step 1: Create GoalWorkspaceSheet component**

```tsx
// client/src/features/goals/components/GoalWorkspaceSheet.tsx
import React, { useState } from 'react';
import {
  Box, Typography, SwipeableDrawer, Slider, useTheme, useMediaQuery,
} from '@mui/material';
import { GoalNode, DOMAIN_COLORS, DOMAIN_ICONS } from '../../../types/goal';
import { DOMAIN_TRACKER_MAP, TRACKER_TYPES } from '../../trackers/trackerTypes';

interface GoalWorkspaceSheetProps {
  node: GoalNode | null;
  allNodes: any[];                // flat backend nodes for parentId lookup
  open: boolean;
  onClose: () => void;
  onProgressChange: (nodeId: string, progress: number) => void;
  onNodeSelect: (node: GoalNode) => void;
  onAddSubgoal: (parentId: string) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  onAction: (action: 'journal' | 'bet' | 'verify' | 'edit' | 'suspend', node: GoalNode) => void;
  userId: string;
  readOnly?: boolean;
}

/** Walk up parentId chain to find the root domain. */
function getNodeDomain(nodeId: string, allNodes: any[]): string {
  const node = allNodes.find((n: any) => n.id === nodeId);
  if (!node) return 'Personal Goals';
  if (node.domain) return node.domain;
  if (!node.parentId) return 'Personal Goals';
  return getNodeDomain(node.parentId, allNodes);
}

const GoalWorkspaceSheet: React.FC<GoalWorkspaceSheetProps> = ({
  node, allNodes, open, onClose, onProgressChange, onNodeSelect,
  onAddSubgoal, onLogTracker, onAction, userId, readOnly,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [localProgress, setLocalProgress] = useState<number | null>(null);

  if (!node) return null;

  const domain = getNodeDomain(node.id, allNodes);
  const domainColor = DOMAIN_COLORS[domain] || DOMAIN_COLORS['defaultDomain'];
  const domainIcon = DOMAIN_ICONS[domain] || '🎯';

  // Smart tracker: pick first tracker type for this domain
  const trackerTypeId = (DOMAIN_TRACKER_MAP as Record<string, string[]>)[domain]?.[0] ?? 'progress';
  const trackerType = TRACKER_TYPES.find(t => t.id === trackerTypeId);

  const progress = localProgress ?? node.progress;

  const content = (
    <Box sx={{ p: 2.5 }}>
      {/* Drag handle (mobile only) */}
      {isMobile && (
        <Box sx={{ textAlign: 'center', mb: 1.5 }}>
          <Box sx={{ width: 32, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mx: 'auto' }} />
        </Box>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: domainColor, letterSpacing: '0.05em' }}>
            {domainIcon} {domain.toUpperCase()}
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, mt: 0.25 }}>
            {node.title}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#A78BFA' }}>
          {progress}%
        </Typography>
      </Box>

      {/* Progress slider */}
      {!readOnly && (
        <Box sx={{ mb: 2 }}>
          <Slider
            value={progress}
            onChange={(_, v) => setLocalProgress(v as number)}
            onChangeCommitted={(_, v) => {
              onProgressChange(node.id, v as number);
              setLocalProgress(null);
            }}
            min={0} max={100} step={5}
            sx={{
              color: '#A78BFA',
              height: 8,
              '& .MuiSlider-thumb': {
                width: 18, height: 18, bgcolor: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              },
              '& .MuiSlider-track': {
                background: 'linear-gradient(90deg, #F59E0B, #8B5CF6)',
                border: 'none',
              },
              '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '0.65rem', opacity: 0.3 }}>0%</Typography>
            <Typography sx={{ fontSize: '0.65rem', opacity: 0.3 }}>100%</Typography>
          </Box>
        </Box>
      )}

      {/* Smart tracker button */}
      {!readOnly && trackerType && (
        <Box
          onClick={() => onLogTracker(trackerType.id, node)}
          sx={{
            p: 1.75, borderRadius: '14px', mb: 2, cursor: 'pointer',
            background: `linear-gradient(135deg, ${trackerType.bg}, transparent)`,
            border: `1px solid ${trackerType.border}`,
            display: 'flex', alignItems: 'center', gap: 1.5,
            '&:hover': { borderColor: trackerType.color },
          }}
        >
          <Box sx={{
            width: 40, height: 40, borderRadius: '12px',
            bgcolor: trackerType.bg, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
          }}>
            {trackerType.icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.875rem' }}>
              {trackerType.label.replace(' Tracker', '')}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
              Tap to log entry
            </Typography>
          </Box>
          <Typography sx={{ color: trackerType.color, fontSize: '1.25rem', fontWeight: 700 }}>+</Typography>
        </Box>
      )}

      {/* Sub-goals list */}
      {node.children.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{
            fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.08em', mb: 0.75,
          }}>
            SUB-GOALS
          </Typography>
          {node.children.map(child => (
            <Box
              key={child.id}
              onClick={() => onNodeSelect(child)}
              sx={{
                p: '8px 10px', borderRadius: '8px', mb: 0.5, cursor: 'pointer',
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: 1,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              <Box sx={{
                width: 14, height: 14, borderRadius: '4px',
                border: `2px solid ${child.progress >= 100 ? '#10B981' : 'rgba(255,255,255,0.2)'}`,
                bgcolor: child.progress >= 100 ? 'rgba(16,185,129,0.2)' : 'transparent',
              }} />
              <Typography sx={{ fontSize: '0.85rem', flex: 1 }}>{child.title}</Typography>
              <Typography sx={{ fontSize: '0.7rem', opacity: 0.4 }}>{child.progress}%</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Add sub-goal */}
      {!readOnly && (
        <Box
          onClick={() => onAddSubgoal(node.id)}
          sx={{
            p: '6px 10px', fontSize: '0.8rem', color: '#A78BFA',
            display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
            mb: 2,
            '&:hover': { color: '#C4B5FD' },
          }}
        >
          <Typography sx={{ fontSize: '1rem' }}>+</Typography>
          <Typography sx={{ fontSize: '0.8rem' }}>Add sub-goal</Typography>
        </Box>
      )}

      {/* Action icon row */}
      {!readOnly && (
        <Box sx={{
          display: 'flex', justifyContent: 'space-around',
          pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          {([
            { key: 'journal' as const, icon: '📓', label: 'Journal' },
            { key: 'bet' as const, icon: '🎰', label: 'Bet' },
            { key: 'verify' as const, icon: '✅', label: 'Verify' },
            { key: 'suspend' as const, icon: '⏸', label: 'Suspend' },
            { key: 'edit' as const, icon: '✏️', label: 'Edit' },
          ]).map(action => (
            <Box
              key={action.key}
              onClick={() => onAction(action.key, node)}
              sx={{
                textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                '&:hover': { color: 'rgba(255,255,255,0.8)' },
              }}
            >
              <Typography sx={{ fontSize: '1.1rem', mb: 0.25 }}>{action.icon}</Typography>
              <Typography sx={{ fontSize: '0.65rem' }}>{action.label}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  // Mobile: SwipeableDrawer. Desktop: static panel.
  if (isMobile) {
    return (
      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        onOpen={() => {}}
        disableSwipeToOpen
        PaperProps={{
          sx: {
            height: '70vh',
            borderRadius: '16px 16px 0 0',
            background: 'rgba(15,15,25,0.98)',
            border: '1px solid rgba(139,92,246,0.15)',
            borderBottom: 'none',
          },
        }}
      >
        {content}
      </SwipeableDrawer>
    );
  }

  // Desktop: rendered inline as right panel
  return (
    <Box sx={{
      overflowY: 'auto', height: '100%',
      background: 'rgba(15,15,25,0.98)',
    }}>
      {content}
    </Box>
  );
};

export default GoalWorkspaceSheet;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd client && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20`
Expected: No errors from GoalWorkspaceSheet.tsx

- [ ] **Step 3: Commit**

```bash
git add client/src/features/goals/components/GoalWorkspaceSheet.tsx
git commit -m "feat: GoalWorkspaceSheet — bottom sheet workspace with tracker + progress slider"
```

---

## Chunk 3: GoalTreePage Rewrite + Cleanup

### Task 3: Rewrite GoalTreePage as thin orchestrator

**Files:**
- Rewrite: `client/src/features/goals/GoalTreePage.tsx`
- Delete: `client/src/features/goals/components/GoalTreeRadial.tsx`
- Delete: `client/src/features/goals/components/GoalTreeVisualization.tsx`

- [ ] **Step 1: Rewrite GoalTreePage**

The new GoalTreePage keeps all existing handler functions (`handleSaveEdit`, `handlePlaceBet`, `handleCancelBet`, `handleClaimAchievement`, `handleSendClaim`, suspend handler) and all dialog JSX (achievement, claim, betting, edit/branch, suspend, journal drawer). What changes:

1. Replace `GoalTreeRadial` import → `GoalCardTree` import
2. Add `GoalWorkspaceSheet` import
3. Add state: `selectedNode`, `sheetOpen`
4. Replace the radial visualization render with split layout: tree (left/full on mobile) + panel (right on desktop)
5. Add `GoalWorkspaceSheet` with mobile drawer + desktop panel
6. Wire up new handlers: `handleNodeSelect`, `handleProgressUpdate`, `handleLogTracker`, `handleAction`
7. Remove `TrackerSection` import and render (replaced by per-goal smart tracker)
8. Remove active bets list (available on `/betting` page)
9. Remove `domainProficiency` and `memberSince` state (not needed for card tree)

Key changes in the rewrite:

**Imports — replace:**
```tsx
// REMOVE these:
import GoalTreeRadial from './components/GoalTreeRadial';
import TrackerSection from '../trackers/TrackerSection';

// ADD these:
import GoalCardTree from './components/GoalCardTree';
import GoalWorkspaceSheet from './components/GoalWorkspaceSheet';
import { useTheme, useMediaQuery } from '@mui/material';
```

**State — add:**
```tsx
const [selectedNode, setSelectedNode] = useState<FrontendGoalNode | null>(null);
const [sheetOpen, setSheetOpen] = useState(false);
const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down('md'));
```

**State — remove:**
```tsx
// DELETE these (no longer needed):
const [domainProficiency, setDomainProficiency] = useState(...)
const [memberSince, setMemberSince] = useState(...)
const [, setTick] = useState(0);  // bet countdown timer
// Also remove the setInterval useEffect for tick
// Also remove getCountdown and getCountdownColor functions
```

**New handlers:**
```tsx
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
    if (progress === 100) {
      const node = treeData.flatMap(function flatten(n: FrontendGoalNode): FrontendGoalNode[] {
        return [n, ...n.children.flatMap(flatten)];
      }).find(n => n.id === nodeId);
      if (node) setTimeout(() => setAchieveNode({ ...node, progress: 100 }), 400);
    }
    // Refresh tree data
    const response = await axios.get(`${API_URL}/goals/${currentUserId}`);
    const allNodes: any[] = response.data.nodes || [];
    setBackendNodes(allNodes);
    setTreeData(buildFrontendTree(allNodes));
    // Update selectedNode with fresh data
    const freshNode = buildFrontendTree(allNodes)
      .flatMap(function flatten(n: FrontendGoalNode): FrontendGoalNode[] {
        return [n, ...n.children.flatMap(flatten)];
      }).find(n => n.id === nodeId);
    if (freshNode) setSelectedNode(freshNode);
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Failed to update progress.');
  }
};

const handleLogTracker = (trackerType: string, goalNode: FrontendGoalNode) => {
  // Navigate to trackers or open tracker inline — for now navigate
  navigate(`/dashboard?tracker=${trackerType}`);
};

const handleAction = (action: 'journal' | 'bet' | 'verify' | 'edit' | 'suspend', node: FrontendGoalNode) => {
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
  }
};

const handleAddSubgoal = (parentId: string) => {
  const parent = treeData.flatMap(function flatten(n: FrontendGoalNode): FrontendGoalNode[] {
    return [n, ...n.children.flatMap(flatten)];
  }).find(n => n.id === parentId);
  if (parent) {
    handleOpenEdit(parent, true);
  }
};
```

**Render — replace the visualization section and remove active bets + TrackerSection:**
```tsx
{treeData.length === 0 ? (
  /* ... existing empty state ... */
) : (
  <Box sx={{ display: 'flex', height: { xs: 'auto', md: 'calc(100vh - 120px)' } }}>
    {/* Tree panel */}
    <Box sx={{
      width: { xs: '100%', md: '40%' },
      overflowY: 'auto',
      borderRight: { xs: 'none', md: '1px solid rgba(255,255,255,0.06)' },
    }}>
      <GoalCardTree
        nodes={treeData}
        selectedNodeId={selectedNode?.id ?? null}
        onNodeSelect={handleNodeSelect}
        onAddGoal={handleRootClick}
        readOnly={!isOwnTree}
      />
    </Box>

    {/* Desktop: right panel workspace */}
    {!isMobile && selectedNode && (
      <Box sx={{ width: '60%' }}>
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
    readOnly={!isOwnTree}
  />
)}

{/* ALL EXISTING DIALOGS STAY UNCHANGED:
    - Achievement celebration dialog
    - Claim completion dialog
    - Betting dialog
    - Edit/Branch dialog
    - Suspend goal dialog
    - NodeJournalDrawer
*/}
```

**Header — simplify:**
Remove "Edit Goals" button and hint text. Keep the PP chip. Update title.

- [ ] **Step 2: Delete old SVG visualization files**

```bash
rm client/src/features/goals/components/GoalTreeRadial.tsx
rm client/src/features/goals/components/GoalTreeVisualization.tsx
```

- [ ] **Step 3: Verify it compiles**

Run: `cd client && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20`
Expected: No errors. The old files are deleted and no longer imported.

Check that nothing else imports GoalTreeRadial or GoalTreeVisualization:
Run: `grep -r "GoalTreeRadial\|GoalTreeVisualization" client/src/ --include="*.tsx" --include="*.ts"`
Expected: No matches (GoalTreePage no longer imports them).

- [ ] **Step 4: Test in browser**

Run: `cd client && npm run dev`
Then open http://localhost:3000/goals and verify:
1. Card tree renders with domain sections and goal cards
2. Tapping a goal opens bottom sheet (mobile) or right panel (desktop)
3. Progress slider works
4. Smart tracker button shows correct tracker for domain
5. Sub-goals listed and tappable (navigates to them in tree)
6. Action buttons (Journal, Bet, Verify, Suspend, Edit) open correct dialogs
7. "+ Add new goal" opens the creation dialog
8. "+ Add sub-goal" opens branching dialog with parent set

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Goal tree redesign — card tree + bottom sheet workspace

Replace SVG radial/vertical visualizations with interactive card tree.
Bottom sheet (mobile) / right panel (desktop) with progress slider,
smart tracker button, sub-goals, and action icons.

Deleted: GoalTreeRadial.tsx, GoalTreeVisualization.tsx
Rewritten: GoalTreePage.tsx (~300 lines, down from 945)"
```

- [ ] **Step 6: Push to deploy**

```bash
git push
```
