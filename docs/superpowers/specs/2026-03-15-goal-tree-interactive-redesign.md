# Goal Tree Interactive Redesign

**Date:** 2026-03-15
**Status:** Approved

## Problem

The goal tree uses radial/vertical SVG visualizations that don't render well on mobile, lack interactivity, and treat goals as static display items. Users must navigate through dialogs to interact with goals. The tree should be the primary interaction surface — clickable nodes that open a workspace for tracking, adding sub-goals, and taking actions.

## Design Decisions

- **Card tree + bottom sheet hybrid** — collapsible card tree shows full hierarchy; tapping a goal opens a bottom sheet workspace
- **Smart tracker + progress slider** — one auto-detected tracker button per goal + draggable progress slider. Covers 90% of daily interactions
- **Navigate in tree** — tapping a sub-goal in the sheet closes it, highlights/expands the sub-goal in the tree, re-opens the sheet for it
- **Desktop: sidebar + panel** — same components, CSS layout shift. Tree as left sidebar (40%), workspace as right panel (60%)

## Data Model Notes

- **GoalNode type** uses `title` (not `name`). The backend stores `name`; `buildFrontendTree()` maps `name → title`. All new components receive transformed `GoalNode[]` and use `node.title`.
- **GoalNode.domain** only exists on root-level nodes. Sub-goals inherit domain from their root ancestor via `getNodeDomain()` helper.
- **Progress scale**: DB stores 0.0–1.0. `buildFrontendTree()` converts to 0–100. Slider operates in 0–100 range. `PATCH /goals/:userId/node/:nodeId/progress` receives 0–100.
- **DOMAIN_TRACKER_MAP** in `trackerTypes.ts` maps domains to tracker type arrays. Use `[0]` for smart tracker auto-detection.
- **DOMAIN_COLORS** and **DOMAIN_ICONS** in `client/src/types/goal.ts` provide per-domain colors and emoji icons.
- **`__dom__` synthetic nodes** (used by old SVG visualizations) are no longer needed — domains are section headers, not nodes.
- **No backend changes** — same endpoints, same data model. Frontend-only redesign.

## Intentionally Dropped Features

These features from the old GoalTreePage are intentionally removed in this redesign:

- **Domain proficiency display** — was shown on radial visualization nodes. Not needed in card tree.
- **`memberSince` display** — shown on radial trunk node. Not relevant to goal interaction.
- **Active Bets list below tree** — bets are already shown on `/betting` page. The workspace sheet's Bet action button is sufficient.
- **TrackerSection below tree** — replaced by per-goal smart tracker button in the workspace sheet. Full tracker view remains on the Dashboard.
- **"Edit Goals" button to GoalSelectionPage** — replaced by "+ Add new goal" in tree + Edit action in workspace sheet.

---

## Component 1: GoalCardTree

**File:** `client/src/features/goals/components/GoalCardTree.tsx` (~200 lines)

**Purpose:** Collapsible card-based tree replacing SVG radial/vertical visualizations.

### Props
```ts
interface GoalCardTreeProps {
  nodes: GoalNode[];           // transformed via buildFrontendTree — uses `title`, progress 0-100
  selectedNodeId: string | null;
  onNodeSelect: (node: GoalNode) => void;
  onAddGoal: () => void;
  readOnly?: boolean;          // true when viewing another user's tree — hides add button
}
```

### Structure
- **Domain sections** — collapsible headers with emoji icon (`DOMAIN_ICONS`), domain name, inline progress bar colored with `DOMAIN_COLORS`, percentage
  - Only domains that have goals are shown (no empty domain slots)
  - Expanded by default if domain has goals; tapping header toggles collapse
  - Domain progress = average of its root goals' progress
- **Goal cards** — under their domain section
  - Card shows: goal `title` (bold), progress bar (gradient #F59E0B → #8B5CF6), percentage
  - Sub-goal pills peek below the progress bar (small chips showing sub-goal titles)
  - Selected card: purple glow border (`box-shadow: 0 0 12px rgba(139,92,246,0.15)`, `border: 1px solid rgba(139,92,246,0.3)`)
  - Unselected cards: subtle border (`rgba(255,255,255,0.06)`)
  - Suspended goals: opacity 0.35, grayscale filter (existing behavior preserved)
- **Sub-goal cards** — indented under parent, same card style but slightly smaller
  - Visible when parent domain is expanded
  - Tappable — triggers `onNodeSelect`
- **"+ Add new goal" button** — at bottom of tree, triggers `onAddGoal`. Hidden when `readOnly`.

### Scroll behavior
When `selectedNodeId` changes, the tree auto-scrolls the selected card into view using `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.

### Building the tree from GoalNode[]
`GoalNode[]` is already a nested structure (each node has `children: GoalNode[]`). Group root nodes by domain:
```ts
// GoalNode[] from buildFrontendTree is already nested with children
// Group root-level nodes by domain
const rootsByDomain = nodes.reduce((acc, n) => {
  const domain = n.domain || 'Personal Goals';
  (acc[domain] ??= []).push(n);
  return acc;
}, {} as Record<string, GoalNode[]>);
```

Render each domain section, then its root goals, then recursively render `children` as indented sub-goal cards.

---

## Component 2: GoalWorkspaceSheet

**File:** `client/src/features/goals/components/GoalWorkspaceSheet.tsx` (~250 lines)

**Purpose:** Bottom sheet (mobile) / right panel (desktop) showing the selected goal's workspace.

### Props
```ts
interface GoalWorkspaceSheetProps {
  node: GoalNode | null;
  allNodes: GoalNode[];       // flat list for domain inheritance lookup
  open: boolean;
  onClose: () => void;
  onProgressChange: (nodeId: string, progress: number) => void;
  onNodeSelect: (node: GoalNode) => void;  // for sub-goal navigation
  onAddSubgoal: (parentId: string) => void;
  onLogTracker: (trackerType: string, goalNode: GoalNode) => void;
  onAction: (action: 'journal' | 'bet' | 'verify' | 'edit' | 'suspend', node: GoalNode) => void;
  userId: string;
  readOnly?: boolean;          // hides actions when viewing another user's tree
}
```

### Layout (all visible at ~70vh height)

**1. Header**
- Domain label (colored with `DOMAIN_COLORS`, uppercase, small) — e.g., "FITNESS" in #F59E0B
- Goal `title` (18px, font-weight 900)
- Large progress percentage (24px, #A78BFA)

**2. Progress Slider**
- MUI Slider styled with gradient track (#F59E0B → #8B5CF6)
- White circular thumb with shadow
- Range 0–100
- `onChangeCommitted` fires `onProgressChange` (calls PATCH endpoint)
- 0% and 100% labels at ends
- Hidden when `readOnly`

**3. Smart Tracker Button**
- Single prominent button, full-width card style
- Auto-detected from `DOMAIN_TRACKER_MAP[getNodeDomain(goal)]?.[0] ?? 'progress'`
- Shows: tracker emoji icon (from `TRACKER_TYPES`), tracker label ("Log Run"), last logged time
- Domain is inherited: if the node has no `domain`, walk up via `parentId` to find root's domain
- Tapping calls `onLogTracker(trackerType, node)` — GoalTreePage handles opening tracker entry form
- Hidden when `readOnly`

**Domain inheritance for tracker detection:**
```ts
function getNodeDomain(node: GoalNode, allNodes: GoalNode[]): string {
  if (node.domain) return node.domain;
  if (!node.parentId) return 'Personal Goals';
  const parent = allNodes.find(n => n.id === node.parentId);
  return parent ? getNodeDomain(parent, allNodes) : 'Personal Goals';
}
```

Note: `allNodes` here is a flat list (not the nested `GoalNode[]`). GoalTreePage keeps both the nested tree (for GoalCardTree) and the raw flat backend nodes (for `parentId` lookups). Alternatively, flatten the nested tree before passing.

**4. Sub-goals List**
- Each sub-goal as a row: progress indicator (small colored circle), `title`, progress %
- Tapping a sub-goal: calls `onNodeSelect(subgoal)` — the parent (GoalTreePage) will close the sheet, highlight the sub-goal in the tree, and re-open the sheet for it
- "+ Add sub-goal" row at bottom — calls `onAddSubgoal(node.id)`. Hidden when `readOnly`.

**5. Action Icon Row**
- Bottom bar, separated by a subtle top border
- Icons: Journal (📓), Bet (🎰), Verify (✅), Suspend (⏸), Edit (✏️)
- Each calls `onAction(type, node)` — GoalTreePage handles opening the respective dialog
- Hidden when `readOnly`

### Mobile vs Desktop
```ts
const isMobile = useMediaQuery(theme.breakpoints.down('md'));
```
- **Mobile**: MUI `SwipeableDrawer` with `anchor="bottom"`, `PaperProps.sx.height: '70vh'`, border-radius top corners 16px
- **Desktop**: Rendered as a `Box` in the right 60% of the page (no drawer), always visible when a node is selected

---

## Component 3: GoalTreePage (Rewrite)

**File:** `client/src/features/goals/GoalTreePage.tsx` (~300 lines, down from 945)

**Purpose:** Orchestrator — owns data, renders tree + workspace, manages dialog states.

### State
```ts
const [nodes, setNodes] = useState<GoalNode[]>([]);        // nested tree
const [backendNodes, setBackendNodes] = useState<any[]>([]); // flat from DB (for parentId lookups)
const [selectedNode, setSelectedNode] = useState<GoalNode | null>(null);
const [sheetOpen, setSheetOpen] = useState(false);
```

### Read-only mode
```ts
// Support viewing other users' trees via URL param
const { id } = useParams();
const isOwnTree = !id || id === currentUserId;
```
Pass `readOnly={!isOwnTree}` to both GoalCardTree and GoalWorkspaceSheet.

### Layout
```tsx
// Mobile: stack vertically, sheet overlays
// Desktop: side-by-side
<Box sx={{ display: 'flex', height: '100%' }}>
  <Box sx={{ width: { xs: '100%', md: '40%' }, overflowY: 'auto' }}>
    <GoalCardTree
      nodes={nodes}
      selectedNodeId={selectedNode?.id ?? null}
      onNodeSelect={handleNodeSelect}
      onAddGoal={handleAddGoal}
      readOnly={!isOwnTree}
    />
  </Box>
  {!isMobile && selectedNode && (
    <Box sx={{ width: '60%', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
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
        readOnly={!isOwnTree}
      />
    </Box>
  )}
</Box>
{isMobile && (
  <GoalWorkspaceSheet
    node={selectedNode}
    allNodes={backendNodes}
    open={sheetOpen}
    onClose={() => setSheetOpen(false)}
    ...
  />
)}
```

### Node selection flow
```ts
const handleNodeSelect = (node: GoalNode) => {
  setSelectedNode(node);
  setSheetOpen(true);
  // Tree auto-scrolls to selected node via useEffect + ref
};
```

### Sub-goal navigation (from sheet)
When user taps a sub-goal in the sheet:
1. `onNodeSelect(subgoalNode)` fires
2. GoalTreePage sets `selectedNode` to the sub-goal
3. Tree component receives new `selectedNodeId`, highlights it, scrolls into view
4. Sheet swaps to show the sub-goal's workspace

### Preserved functionality
These existing features stay, triggered from GoalWorkspaceSheet's action buttons:
- **Edit dialog** — MUI Dialog for editing goal name/description/metric/date (100 PP)
- **Add sub-goal dialog** — same creation form, pre-sets `parentId`
- **Peer verification** — claim dialog with evidence upload + verifier selection
- **Betting** — bet creation dialog with stake slider
- **Suspend goal** — confirmation dialog (50 PP)
- **Journal** — NodeJournalDrawer
- **Achievement celebration** — dialog when progress hits 100%

The dialog state management stays in GoalTreePage (it already has these handlers). They're just triggered differently — from sheet action buttons instead of a monolithic edit dialog.

### Data fetching
Unchanged — `GET /goals/:userId` on mount. Store both raw backend nodes (flat) and transformed `GoalNode[]` (nested via `buildFrontendTree`).

---

## Files Changed

| File | Change |
|------|--------|
| `client/src/features/goals/components/GoalCardTree.tsx` | **NEW** ~200 lines |
| `client/src/features/goals/components/GoalWorkspaceSheet.tsx` | **NEW** ~250 lines |
| `client/src/features/goals/GoalTreePage.tsx` | **REWRITE** ~300 lines (down from 945) |
| `client/src/features/goals/components/GoalTreeRadial.tsx` | **DELETE** |
| `client/src/features/goals/components/GoalTreeVisualization.tsx` | **DELETE** |

## No Backend Changes

All data comes from existing endpoints:
- `GET /goals/:userId` — fetches nodes
- `PATCH /goals/:userId/node/:nodeId/progress` — progress update (free)
- `PATCH /goals/:userId/node/:nodeId` — metadata edit (100 PP)
- `POST /goals/:userId/node` — create node (500 PP)
- Tracker entries via existing tracker endpoints

## Visual Style Reference

- **Card backgrounds**: `rgba(255,255,255,0.02)` default, `rgba(139,92,246,0.06)` selected
- **Selected glow**: `box-shadow: 0 0 12px rgba(139,92,246,0.15)`, `border: 1px solid rgba(139,92,246,0.3)`
- **Progress gradient**: `linear-gradient(90deg, #F59E0B, #8B5CF6)`
- **Domain colors**: use `DOMAIN_COLORS` from `client/src/types/goal.ts`
- **Domain icons**: use `DOMAIN_ICONS` from `client/src/types/goal.ts`
- **Domain header progress**: thin bar with domain-colored fill at 40% opacity
- **Sub-goal pills**: `font-size: 10px`, `padding: 2px 8px`, `border-radius: 6px`, `background: rgba(255,255,255,0.04)`
- **Sheet**: `border-radius: 16px 16px 0 0`, `background: rgba(15,15,25,0.98)`, drag handle pill at top
- **Action icons**: muted `rgba(255,255,255,0.5)`, 18px emoji, 11px label below
- **Suspended goals**: `opacity: 0.35`, `filter: grayscale(0.8)`, ⏸ badge
