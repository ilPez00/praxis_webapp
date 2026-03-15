# Hierarchical Notebook System — Design Proposal

**Date:** 2026-03-15  
**Status:** Proposal / Planning  
**Version:** 0.1

---

## Vision

Replace the separate **Goals** and **Notes** tabs with a unified **Hierarchical Notebook** system where:

1. **Topics** = Root goals (Life domains: Career, Fitness, Relationships, etc.)
2. **Chapters** = Sub-goals / milestones
3. **Subchapters** = Further subdivisions or actionable tasks
4. **Notes** = Rich text content attached to any node
5. **Tracking** = Built into each node (progress, trackers, bets)

The system **visually resembles a tree** but **feels like a notebook** — combining the structure of goal trees with the flexibility of note-taking.

---

## User Experience

### Onboarding (Account Creation)

```
┌─────────────────────────────────────────────────────────────┐
│  Welcome to Praxis — Let's set up your notebook            │
│                                                             │
│  What areas of life do you want to focus on?               │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  📈 Career   │ │  💪 Fitness  │ │  ❤️ Relationships│   │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  🧠 Learning │ │  🎨 Creative │ │  ✨ Personal  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                             │
│  [Skip for now]                           [Continue →]     │
└─────────────────────────────────────────────────────────────┘
```

**What happens:**
- Selected topics become **root notebooks** (appearing from the left)
- Each topic is pre-populated with starter prompts
- User can immediately start adding chapters (sub-goals) and notes

---

### Main Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│  Praxis — Notebook                                   [Search] [👤] │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                       │
│  📈 CAREER   │  Career / Software Engineering / Learn Rust          │
│  ▼           │                                                       │
│    ┌───────────────────────────────────────────────────────────┐   │
│    │ 📘 Learn Rust                                      [65%] │   │
│    │ ─────────────────────────────────────────────────────── │   │
│    │                                                           │   │
│    │ 📝 Notes (3)  |  📊 Trackers  |  🎯 Bets  |  ⚡ Actions  │   │
│    │                                                           │   │
│    │ ──────────────────────────────────────────────────────── │   │
│    │                                                           │   │
│    │ Last updated: 2 days ago                                  │   │
│    │                                                           │   │
│    │ "Started Chapter 3 on ownership. The borrow checker is    │   │
│    │  tricky but making sense now. Need to practice more with │   │
│    │  lifetimes."                                              │   │
│    │                                                           │   │
│    │ [Continue Journaling...]                                  │   │
│    │                                                           │   │
│    ├───────────────────────────────────────────────────────────┤   │
│    │                                                           │   │
│    │ SUBCHAPTERS:                                              │   │
│    │                                                           │   │
│    │   ▶ Complete Rust Book (Ch 1-6)                    [✓]  │   │
│    │   ▶ Build CLI Tool                                 [65%] │   │
│    │   ▶ Contribute to Open Source                      [0%]  │   │
│    │                                                           │   │
│    │ [+ Add Subchapter]                                        │   │
│    │                                                           │   │
│    ├───────────────────────────────────────────────────────────┤   │
│    │                                                           │   │
│    │ TRACKING:                                                 │   │
│    │                                                           │   │
│    │ [📊 Code: 45 min today]  [📚 Pages: 12/20]               │   │
│    │                                                           │   │
│    └───────────────────────────────────────────────────────────┘   │
│              │                                                       │
│  💪 FITNESS  │                                                       │
│  ▼           │                                                       │
│    📘 Run 5K  │                                                       │
│    📘 Gym     │                                                       │
│              │                                                       │
│  🧠 LEARNING │                                                       │
│  ▼           │                                                       │
│    📘 Spanish │                                                       │
│    📘 Guitar  │                                                       │
│              │                                                       │
│ [+ Topic]    │                                                       │
│              │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

---

## Key Interactions

### 1. Creating Content

**From Left Sidebar:**
- Click `[+ Topic]` → Creates new root notebook
- Right-click topic → Rename, Change Icon, Color, Delete

**From Main Panel:**
- Click node → Opens detail view
- `[+ Add Subchapter]` → Creates child node
- `[Continue Journaling]` → Opens rich text editor

### 2. Navigation

- **Left sidebar:** Tree navigation (collapsible topics)
- **Breadcrumbs:** `Career > Software Engineering > Learn Rust`
- **Click breadcrumb** → Jump to that level
- **Search:** Full-text search across all notes and node titles

### 3. Tracking (Per Node)

Each node has tabs:

| Tab | Content |
|-----|---------|
| **Notes** | Rich text journaling, reflections |
| **Trackers** | Domain-specific metrics (Code time, Pages read, etc.) |
| **Bets** | Active challenges/wagers on this goal |
| **Actions** | Quick log: "Did 25 min Pomodoro", "Read 10 pages" |

### 4. Progress

- **Manual:** Slider 0-100% (like current system)
- **Automatic:** Based on subchapter completion
- **Tracker-based:** "Code 5 hrs/week" → progress tied to tracker completion

---

## Data Structure

### Database Schema

```typescript
// Unified notebook_nodes table (replaces goal_trees + notes)
CREATE TABLE notebook_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Hierarchy
  parent_id UUID REFERENCES notebook_nodes(id),
  path LTREE,  -- PostgreSQL ltree for efficient tree queries
  
  -- Content
  title TEXT NOT NULL,
  content TEXT,  -- Rich text (Markdown)
  content_type TEXT DEFAULT 'markdown',  -- 'markdown' | 'plain'
  
  -- Goal metadata
  type TEXT NOT NULL DEFAULT 'chapter',  -- 'topic' | 'chapter' | 'subchapter' | 'task'
  progress INTEGER DEFAULT 0,  -- 0-100
  status TEXT DEFAULT 'active',  -- 'active' | 'completed' | 'suspended'
  domain TEXT,
  
  -- Tracking
  trackers JSONB DEFAULT '[]',  -- [{type: 'code_time', target: 30, unit: 'min/day'}]
  tracker_entries JSONB DEFAULT '[]',  -- [{date: '2026-03-15', value: 45}]
  
  -- Metadata
  icon TEXT,  -- Emoji
  color TEXT,  -- Hex color
  weight DECIMAL DEFAULT 1.0,  -- For sorting
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT valid_parent CHECK (user_id IS NOT NULL)
);

-- Indexes for fast tree queries
CREATE INDEX idx_notebook_nodes_user_path ON notebook_nodes USING ltree (path);
CREATE INDEX idx_notebook_nodes_parent ON notebook_nodes (parent_id);
CREATE INDEX idx_notebook_nodes_type ON notebook_nodes (type);

-- Full-text search across all content
CREATE INDEX idx_notebook_nodes_search ON notebook_nodes USING gin (to_tsvector('english', title || ' ' || content));
```

### Frontend Types

```typescript
interface NotebookNode {
  id: string;
  parentId: string | null;
  path: string;  // e.g., "1.2.5" for Career > Engineering > Rust
  
  // Content
  title: string;
  content: string;  // Markdown
  contentType: 'markdown' | 'plain';
  
  // Structure
  type: 'topic' | 'chapter' | 'subchapter' | 'task';
  children: NotebookNode[];
  
  // Goal tracking
  progress: number;  // 0-100
  status: 'active' | 'completed' | 'suspended';
  domain: string;
  
  // Tracking
  trackers: TrackerConfig[];
  trackerEntries: TrackerEntry[];
  
  // Visual
  icon: string;
  color: string;
  weight: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TrackerConfig {
  type: string;  // 'code_time', 'pages', 'weight', etc.
  target: number;
  unit: string;  // 'min/day', 'pages/week', etc.
  current: number;
}

interface TrackerEntry {
  date: string;
  value: number;
  note?: string;
}
```

---

## Visual Design

### Tree Representation

The tree is shown **visually** in the left sidebar:

```
📈 CAREER (65%)
▼
├─ 📘 Software Engineering (70%)
│  ├─ ▶ Learn Rust (65%)
│  │  ├─ ⬜ Complete Book (✓)
│  │  ├─ ⬜ Build CLI Tool (65%)
│  │  └─ ⬜ Contribute to OSS (0%)
│  └─ 📘 System Design (50%)
│
└─ 📘 Side Business (30%)
   └─ ⬜ Launch MVP (30%)

💪 FITNESS (80%)
▼
├─ 📘 Run 5K (90%)
└─ 📘 Gym Routine (70%)
```

**Visual cues:**
- **Icons:** Emoji for each node (📘 chapter, ⬜ task, ✓ completed)
- **Colors:** Domain-based (Career=purple, Fitness=orange, etc.)
- **Progress bars:** Inline percentage
- **Indentation:** Shows hierarchy clearly
- **Collapsible:** Click topic to expand/collapse

---

### Node Detail View

When clicking a node, the right panel shows:

```
┌─────────────────────────────────────────────────────────────┐
│  Career / Software Engineering / Learn Rust          [⋮]   │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Progress: [━━━━━━━━━━━━━━━━━━━━━━━········] 65%           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 📝 NOTES  |  📊 TRACKERS  |  🎯 BETS  |  ⚡ ACTIONS  │ │
│  ──────────────────────────────────────────────────────── │
│  │                                                         │ │
│  │ 2026-03-15                                              │ │
│  │                                                         │ │
│  │ Started Chapter 3 on ownership. The borrow checker is  │ │
│  │ tricky but making sense now.                            │ │
│  │                                                         │ │
│  │ Key insights:                                           │ │
│  │ - Ownership rules are strict but logical               │ │
│  │ - Borrowing vs cloning depends on use case             │ │
│  │                                                         │ │
│  │ Tomorrow: Practice with lifetimes exercises            │ │
│  │                                                         │ │
│  │ [+ Add Entry]                                           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  SUBCHAPTERS (3):                                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ✓ Complete Rust Book (Ch 1-6)                   [✓]  │ │
│  │ ▶ Build CLI Tool                                [65%]│ │
│  │ ⬜ Contribute to Open Source                     [0%] │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  TRACKING TODAY:                                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [📊 Code: 45/60 min]  [📚 Pages: 12/20]              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### 1. Rich Text Notes

- **Markdown support** with live preview
- **Embeds:** Images, code blocks, links
- **Templates:** Pre-built note templates per domain
- **Backlinks:** Link between nodes (`[[Learn Rust]]`)

### 2. Progress Tracking

- **Manual:** Slider or percentage input
- **Auto from subchapters:** Average of children's progress
- **Auto from trackers:** "Code 5 hrs/week" → progress based on completion

### 3. Domain-Specific Trackers

| Domain | Default Trackers |
|--------|-----------------|
| Career | Code time, Tasks completed, Meetings |
| Fitness | Workout duration, Steps, Weight |
| Learning | Pages read, Practice time, Lessons completed |
| Creative | Time spent, Pieces created, Ideas captured |

### 4. Social Features

- **Share node:** Public link to specific chapter
- **Collaborate:** Shared notebooks (future feature)
- **Bets:** Challenge others on specific nodes
- **Matches:** Find users with similar topics

### 5. AI Integration (Axiom)

Axiom reads the notebook structure and provides:

- **Daily brief:** "How's 'Learn Rust' coming along?"
- **Suggestions:** "You've been writing about 'career' — want to explore a new approach?"
- **Trend detection:** "Your code time is down 20% this week — everything okay?"

---

## Migration Plan

### Phase 1: Data Structure (Week 1)

1. Create `notebook_nodes` table
2. Migrate existing `goal_trees.nodes` to `notebook_nodes`
   - Root goals → Topics
   - Sub-goals → Chapters
   - Leaf nodes → Subchapters
3. Keep `goal_trees` table for backward compatibility (read-only)

### Phase 2: Frontend UI (Week 2-3)

1. Build `NotebookPage` component (replaces `NotesPage` + `GoalTreePage`)
2. Create `NotebookTree` sidebar component
3. Build `NodeDetail` view with tabs (Notes, Trackers, Bets, Actions)
4. Implement rich text editor for note content

### Phase 3: Features (Week 4)

1. Implement full-text search
2. Add drag-and-drop reordering
3. Build sharing/public view for nodes
4. Integrate Axiom with new structure

### Phase 4: Deprecation (Week 5)

1. Redirect `/goals` → `/notebook`
2. Redirect `/notes` → `/notebook`
3. Remove old components (after 30-day deprecation period)

---

## API Changes

### New Endpoints

```
GET    /api/notebook              - Get user's full notebook tree
POST   /api/notebook/topic        - Create new root topic
POST   /api/notebook/:id/chapter  - Add subchapter to node
GET    /api/notebook/:id          - Get node with content + children
PATCH  /api/notebook/:id          - Update node (title, content, progress)
DELETE /api/notebook/:id          - Delete node (cascades to children)
POST   /api/notebook/:id/content  - Append note entry
GET    /api/notebook/search?q=    - Full-text search
```

### Backward Compatibility

Keep existing `/api/goals/*` endpoints for 30 days:
- Proxy to new `/api/notebook/*` endpoints
- Return same response format
- Log deprecation warnings

---

## Benefits

### For Users

1. **Unified experience:** No more switching between Goals and Notes tabs
2. **Natural structure:** Topics → Chapters → Subchapters mirrors how people think
3. **Rich context:** Notes and goals live together, not separated
4. **Better discovery:** Search across all content, not just titles

### For Development

1. **Simplified codebase:** One system instead of two
2. **Easier to extend:** Add new node types (templates, resources, etc.)
3. **Better performance:** Single query for tree + content
4. **Cleaner API:** Unified notebook endpoints

### For Axiom

1. **Richer context:** AI can read notes to understand goals better
2. **Better recommendations:** Suggest related topics based on content
3. **Trend detection:** Analyze note frequency and sentiment
4. **Personalized briefs:** Reference specific chapters and progress

---

## Open Questions

1. **Should notes be separate entries or inline content?**
   - Option A: Inline Markdown (like Notion)
   - Option B: Separate entries (like journal)
   - **Recommendation:** Hybrid — inline content with timestamped entries

2. **How to handle existing bets/completions?**
   - Migrate to new structure
   - Keep old system read-only
   - **Recommendation:** Migrate with mapping table

3. **Should collaboration be built from start?**
   - Option A: Single-user only (MVP)
   - Option B: Shared notebooks (future)
   - **Recommendation:** Design for collaboration, implement later

4. **Mobile experience?**
   - Desktop: Full tree + detail view
   - Mobile: Tree view → Detail view (separate screens)
   - **Recommendation:** Responsive design with bottom sheet for mobile

---

## Next Steps

1. **Review this proposal** — Get feedback on structure and UX
2. **Create wireframes** — Visual design for key screens
3. **Build data migration** — Script to convert goal_trees to notebook_nodes
4. **Implement MVP** — Basic notebook with topics/chapters/subchapters
5. **Test with users** — Validate that it feels more intuitive than current system

---

**See Also:**
- `docs/HOW_PRAXIS_WORKS.md` — Current system overview
- `docs/AXIOM_METRIC_BASED_SYSTEM.md` — How Axiom uses data
- `docs/WHAT_AXIOM_READS.md` — Data access guidelines
