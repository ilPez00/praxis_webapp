# Praxis Strategic Pivot Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Praxis from a social matching app into an addictive daily goal journal + accountability buddy system with viral growth hooks.

**Architecture:** Extend `GoalNode` (JSONB in `goal_trees.nodes`) with journal entries and sparring state. All new DB tables go into `migrations/setup.sql` (idempotent). Frontend features are self-contained components dropped into existing pages. The embeddable widget is a standalone static HTML file served from a public endpoint.

**Tech Stack:** Express + TypeScript (backend), React + MUI v7 (frontend), Supabase (Postgres + RLS + Realtime), Gemini via `AICoachingService.runWithFallback()`, HTML5 Canvas (share snippet), vanilla JS (embeddable widget).

**Priority Order:** Chunk 0 (docs) → Chunk 1 (journal/habit) → Chunk 2 (sparring) → Chunk 3 (widget + share) → Chunk 4 (monetization + language).

---

## Chunk 0: Docs & Config Update

### Task 0: Update claude_steps.txt and manual_actions.txt

**Files:**
- Modify: `claude_steps.txt`
- Modify: `docs/manual_actions.txt`

- [ ] **Step 1: Append pivot summary to claude_steps.txt**

Add to the TOP of `claude_steps.txt`:

```
# Session: March 2026 — Strategic Pivot to Goal Journal + Accountability App

## STRATEGIC REPOSITION
Praxis is now: best daily goal journal + accountability buddy app.
Goal tree = emotional living journal (notes, mood, AI recaps, visual evolution).
Daily loop = as compulsive as Notes/Notion (morning brief, one-tap check-in, evening recap).
Matching → active sparring partner requests.
Social proof → public leaderboard, shareable snippets, embeddable streak widget.

## New Features (this session)
- NodeJournalEntry: per-node daily note + emoji mood (stored in node JSONB)
- Weekly AI narrative recap: POST /ai-coaching/weekly-recap (Gemini)
- SparringRequest: per-node toggle "Looking for sparring" + instant Spar? button
- Embeddable streak widget: GET /public/widget/:userId (plain HTML, iframe-able)
- Share snippet: canvas PNG export of 7-day streak + top goal
- Language selector in Settings (i18n via i18next, already installed)
- Monetization: Pro $9.99/mo (unlimited goals, AI summaries, sparring, themes);
  PP costs: goal_slot 200PP, premium_coaching 500PP
```

- [ ] **Step 2: Add SQL migrations to manual_actions.txt**

Append to `docs/manual_actions.txt` under a new section `## Session 2026-03-14 — Pivot Migrations`:

```sql
-- Run in Supabase SQL editor

-- Journal entries per goal node (stored as JSONB array in goal_trees.nodes[].journal)
-- No new table needed — journal entries extend the existing JSONB node structure.
-- But we add a dedicated table for querying/indexing journal entries across nodes:

CREATE TABLE IF NOT EXISTS public.node_journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_id       TEXT NOT NULL,
  note          TEXT,
  mood          TEXT,           -- emoji string: '😤', '🔥', '😐', '😩', etc.
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.node_journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own journal" ON public.node_journal_entries;
CREATE POLICY "Users manage own journal" ON public.node_journal_entries
  FOR ALL USING (auth.uid() = user_id);

-- Sparring requests
CREATE TABLE IF NOT EXISTS public.sparring_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_id       TEXT NOT NULL,
  node_name     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | expired
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(requester_id, target_id, node_id)
);
ALTER TABLE public.sparring_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sparring parties can read" ON public.sparring_requests;
CREATE POLICY "Sparring parties can read" ON public.sparring_requests
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_id);
DROP POLICY IF EXISTS "Requester can insert" ON public.sparring_requests;
CREATE POLICY "Requester can insert" ON public.sparring_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
DROP POLICY IF EXISTS "Target can update status" ON public.sparring_requests;
CREATE POLICY "Target can update status" ON public.sparring_requests
  FOR UPDATE USING (auth.uid() = target_id OR auth.uid() = requester_id);

-- Sparring partnerships (accepted requests become partnerships with joint streak)
CREATE TABLE IF NOT EXISTS public.sparring_partners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  node_id_a     TEXT NOT NULL,
  node_id_b     TEXT NOT NULL,
  joint_streak  INT NOT NULL DEFAULT 0,
  last_joint_checkin DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_a, user_b, node_id_a)
);
ALTER TABLE public.sparring_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Partners can read own rows" ON public.sparring_partners;
CREATE POLICY "Partners can read own rows" ON public.sparring_partners
  FOR ALL USING (auth.uid() = user_a OR auth.uid() = user_b);

-- profiles: add preferred_language (for i18n)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- profiles: add sparring_open_node_ids (JSONB array of node IDs where user wants sparring)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sparring_open_node_ids JSONB DEFAULT '[]';
```

- [ ] **Step 3: Commit docs update**
```bash
git add claude_steps.txt docs/manual_actions.txt
git commit -m "docs: log strategic pivot to journal+accountability app + SQL migrations"
```

---

## Chunk 1: Daily Journal & Habit Loop

This is the highest-priority chunk — it drives daily opens.

### Task 1: Backend — Journal entry endpoints

**Files:**
- Create: `src/controllers/journalController.ts`
- Create: `src/routes/journalRoutes.ts`
- Modify: `src/app.ts` (register route)

- [ ] **Step 1: Create journalController.ts**

```typescript
// src/controllers/journalController.ts
import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';

/**
 * POST /journal/entries
 * Body: { nodeId, note?, mood? }
 * Logs a journal entry for a goal node.
 */
export const addEntry = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { nodeId, note, mood } = req.body;
  if (!nodeId) throw new BadRequestError('nodeId is required.');

  const { data, error } = await supabase
    .from('node_journal_entries')
    .insert({ user_id: userId, node_id: nodeId, note: note ?? null, mood: mood ?? null })
    .select('id, node_id, note, mood, logged_at')
    .single();

  if (error) throw error;
  res.status(201).json(data);
});

/**
 * GET /journal/entries?nodeId=<id>&limit=<n>
 * Returns journal entries for a node, newest first.
 */
export const getEntries = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { nodeId, limit = '20' } = req.query as { nodeId?: string; limit?: string };
  if (!nodeId) throw new BadRequestError('nodeId query param required.');

  const { data, error } = await supabase
    .from('node_journal_entries')
    .select('id, node_id, note, mood, logged_at')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .order('logged_at', { ascending: false })
    .limit(Math.min(parseInt(limit, 10) || 20, 100));

  if (error) throw error;
  res.json(data ?? []);
});

/**
 * GET /journal/recent?limit=<n>
 * Returns the user's most recent entries across all nodes (for weekly narrative).
 */
export const getRecentEntries = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { limit = '50' } = req.query as { limit?: string };

  const { data, error } = await supabase
    .from('node_journal_entries')
    .select('id, node_id, note, mood, logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(Math.min(parseInt(limit, 10) || 50, 200));

  if (error) throw error;
  res.json(data ?? []);
});
```

- [ ] **Step 2: Create journalRoutes.ts**

```typescript
// src/routes/journalRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { addEntry, getEntries, getRecentEntries } from '../controllers/journalController';

const router = Router();
router.post('/entries', authenticateToken, addEntry);
router.get('/entries', authenticateToken, getEntries);
router.get('/recent', authenticateToken, getRecentEntries);
export default router;
```

- [ ] **Step 3: Register route in app.ts**

In `src/app.ts`, add after existing imports:
```typescript
import journalRoutes from './routes/journalRoutes';
```
And after the existing `app.use(...)` block, add:
```typescript
app.use('/api/journal', journalRoutes);
```

- [ ] **Step 4: Commit backend**
```bash
git add src/controllers/journalController.ts src/routes/journalRoutes.ts src/app.ts
git commit -m "feat: journal entry endpoints (add/get per node, recent across all)"
```

---

### Task 2: Backend — Weekly AI Narrative recap

**Files:**
- Modify: `src/controllers/aiCoachingController.ts` (add `getWeeklyNarrative` export if not present, or replace it)
- Modify: `src/routes/aiCoachingRoutes.ts` (verify route exists)

Check if `getWeeklyNarrative` already exists:
```bash
grep -n "getWeeklyNarrative" src/controllers/aiCoachingController.ts
```

- [ ] **Step 1: Add/update getWeeklyNarrative in aiCoachingController.ts**

If it doesn't exist, add at the bottom. If it exists, replace with this richer version that includes journal entries:

```typescript
// POST /ai-coaching/weekly-narrative
// Generates a narrative recap of the user's week using journal entries + check-ins.
export const getWeeklyNarrative = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  const [journalRes, checkinRes, goalRes] = await Promise.all([
    supabase.from('node_journal_entries')
      .select('node_id, note, mood, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: true }),
    supabase.from('checkins')
      .select('streak_day, mood, win_of_the_day, checked_in_at')
      .eq('user_id', userId)
      .gte('checked_in_at', since),
    supabase.from('goal_trees')
      .select('nodes')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const entries = journalRes.data ?? [];
  const checkins = checkinRes.data ?? [];
  const nodes: any[] = goalRes.data?.nodes ?? [];
  const nodeMap: Record<string, string> = {};
  nodes.forEach(n => { nodeMap[n.id] = n.name || n.title || 'Goal'; });

  const journalText = entries.length > 0
    ? entries.map(e => `[${e.logged_at.slice(0, 10)}] ${nodeMap[e.node_id] ?? e.node_id} ${e.mood ?? ''}: ${e.note ?? '(no note)'}`).join('\n')
    : 'No journal entries this week.';

  const checkinText = checkins.length > 0
    ? `${checkins.length}/7 days checked in. Wins: ${checkins.map(c => c.win_of_the_day).filter(Boolean).join(', ') || 'none logged'}.`
    : 'No check-ins this week.';

  const prompt = `You are Axiom. Write a short (3-4 sentences), personal, emotionally intelligent weekly narrative recap for the user.

Their week in data:
Check-ins: ${checkinText}
Journal entries:
${journalText}

Voice: direct, warm, like a sparring partner who has been watching. No bullet points. Reference specific goals and moods from their entries. End with one sharp challenge for next week.`;

  try {
    const narrative = await aiCoachingService['runWithFallback'](prompt);
    res.json({ narrative, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    const { message, code, detailed } = friendlyAiError(err);
    res.status(503).json({ message, code, detailed });
  }
});
```

- [ ] **Step 2: Ensure route exists in aiCoachingRoutes.ts**

In `src/routes/aiCoachingRoutes.ts`, verify:
```typescript
router.get('/weekly-narrative', authenticateToken, getWeeklyNarrative);
// (remove ...requirePro spread if it was there — narrative is free to all users now)
```

- [ ] **Step 3: Commit**
```bash
git add src/controllers/aiCoachingController.ts src/routes/aiCoachingRoutes.ts
git commit -m "feat: weekly AI narrative recap uses journal entries + check-in wins"
```

---

### Task 3: Frontend — NodeJournalDrawer component

**Files:**
- Create: `client/src/features/goals/components/NodeJournalDrawer.tsx`

This is a slide-up drawer attached to a goal node card. Tap a node → drawer shows journal history + "Add entry" form.

- [ ] **Step 1: Create NodeJournalDrawer.tsx**

```tsx
// client/src/features/goals/components/NodeJournalDrawer.tsx
import React, { useState, useEffect } from 'react';
import {
  Drawer, Box, Typography, TextField, Button, Stack,
  Divider, Avatar, CircularProgress, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BookIcon from '@mui/icons-material/AutoStories';
import api from '../../../lib/api';
import toast from 'react-hot-toast';

const MOODS = ['🔥', '😤', '💪', '😐', '😩', '🧘', '🎯', '✅'];

interface Entry {
  id: string;
  note: string | null;
  mood: string | null;
  logged_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeName: string;
}

const NodeJournalDrawer: React.FC<Props> = ({ open, onClose, nodeId, nodeName }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !nodeId) return;
    setLoading(true);
    api.get('/journal/entries', { params: { nodeId } })
      .then(r => setEntries(Array.isArray(r.data) ? r.data : []))
      .catch(() => toast.error('Could not load journal.'))
      .finally(() => setLoading(false));
  }, [open, nodeId]);

  const handleSave = async () => {
    if (!note.trim() && !mood) return;
    setSaving(true);
    try {
      const res = await api.post('/journal/entries', { nodeId, note: note.trim() || null, mood: mood || null });
      setEntries(prev => [res.data, ...prev]);
      setNote('');
      setMood('');
      toast.success('Entry saved');
    } catch {
      toast.error('Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: '24px 24px 0 0', maxHeight: '80vh', bgcolor: '#0A0B14' } }}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BookIcon sx={{ color: '#F59E0B' }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{nodeName}</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Box>

        {/* Mood selector */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {MOODS.map(m => (
            <Box
              key={m}
              onClick={() => setMood(mood === m ? '' : m)}
              sx={{
                fontSize: '1.5rem', cursor: 'pointer', p: 0.5,
                borderRadius: '8px', border: '2px solid',
                borderColor: mood === m ? '#F59E0B' : 'transparent',
                transition: 'all 0.15s',
                '&:hover': { transform: 'scale(1.15)' },
              }}
            >
              {m}
            </Box>
          ))}
        </Box>

        {/* Note input */}
        <TextField
          fullWidth multiline minRows={2} maxRows={6}
          placeholder="What happened? What are you thinking? No filter needed."
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSave(); }}
          sx={{ mb: 1.5, '& .MuiInputBase-root': { borderRadius: '14px' } }}
        />
        <Button
          fullWidth variant="contained" disabled={saving || (!note.trim() && !mood)}
          onClick={handleSave}
          sx={{ borderRadius: '12px', fontWeight: 800, mb: 3, background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)' }}
        >
          {saving ? '...' : `Log Entry ${mood}`}
        </Button>

        <Divider sx={{ mb: 2, opacity: 0.1 }} />

        {/* History */}
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} /></Box>
        ) : entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No entries yet. Start your journal for this goal.
          </Typography>
        ) : (
          <Stack spacing={2} sx={{ overflowY: 'auto', maxHeight: '40vh', pr: 1 }}>
            {entries.map(entry => (
              <Box key={entry.id} sx={{ display: 'flex', gap: 1.5 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(245,158,11,0.15)', fontSize: '1rem', flexShrink: 0 }}>
                  {entry.mood ?? '📝'}
                </Avatar>
                <Box>
                  <Typography variant="caption" color="text.disabled">{formatDate(entry.logged_at)}</Typography>
                  {entry.note && (
                    <Typography variant="body2" sx={{ mt: 0.25, lineHeight: 1.5 }}>{entry.note}</Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
};

export default NodeJournalDrawer;
```

- [ ] **Step 2: Wire NodeJournalDrawer into GoalWidgets.tsx**

In `client/src/features/dashboard/components/GoalWidgets.tsx`:

1. Add import:
```tsx
import NodeJournalDrawer from '../../goals/components/NodeJournalDrawer';
```

2. Add state near top of component:
```tsx
const [journalNode, setJournalNode] = useState<{ id: string; name: string } | null>(null);
```

3. Add a "📓 Journal" button inside each goal card (alongside the existing progress button). Find the button row in each card and add:
```tsx
<Button
  size="small" variant="text"
  onClick={(e) => { e.stopPropagation(); setJournalNode({ id: node.id, name: node.name || node.title || '' }); }}
  sx={{ fontWeight: 700, color: '#F59E0B', fontSize: '0.7rem' }}
>
  📓 Journal
</Button>
```

4. At the bottom of the returned JSX (before closing fragment), add:
```tsx
<NodeJournalDrawer
  open={!!journalNode}
  onClose={() => setJournalNode(null)}
  nodeId={journalNode?.id ?? ''}
  nodeName={journalNode?.name ?? ''}
/>
```

- [ ] **Step 3: Commit**
```bash
git add client/src/features/goals/components/NodeJournalDrawer.tsx \
        client/src/features/dashboard/components/GoalWidgets.tsx
git commit -m "feat: per-node journal drawer with mood picker and entry history"
```

---

### Task 4: Frontend — Weekly Narrative Widget on Dashboard

**Files:**
- Create: `client/src/features/dashboard/components/WeeklyNarrativeWidget.tsx`
- Modify: `client/src/features/dashboard/DashboardPage.tsx` (add widget to right column)

- [ ] **Step 1: Create WeeklyNarrativeWidget.tsx**

```tsx
// client/src/features/dashboard/components/WeeklyNarrativeWidget.tsx
import React, { useState } from 'react';
import { Box, Typography, Button, CircularProgress, Collapse } from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import GlassCard from '../../../components/common/GlassCard';
import api from '../../../lib/api';
import toast from 'react-hot-toast';

interface Props { userId: string; }

const WeeklyNarrativeWidget: React.FC<Props> = ({ userId: _userId }) => {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNarrative = async () => {
    if (narrative) { setOpen(v => !v); return; }
    setLoading(true);
    try {
      const res = await api.post('/ai-coaching/weekly-narrative');
      setNarrative(res.data.narrative);
      setOpen(true);
    } catch {
      toast.error('Could not generate narrative. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoStoriesIcon sx={{ color: '#8B5CF6', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Weekly Narrative</Typography>
        </Box>
        <Button
          size="small" variant="text" onClick={fetchNarrative}
          disabled={loading}
          sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#8B5CF6' }}
        >
          {loading ? <CircularProgress size={14} /> : narrative ? (open ? 'Hide' : 'Show') : 'Generate'}
        </Button>
      </Box>
      <Collapse in={open && !!narrative}>
        <Typography
          variant="body2"
          sx={{ mt: 2, lineHeight: 1.7, color: 'text.secondary', fontStyle: 'italic', borderLeft: '2px solid #8B5CF6', pl: 2 }}
        >
          {narrative}
        </Typography>
      </Collapse>
      {!narrative && !loading && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
          Axiom reads your week and writes a personal recap.
        </Typography>
      )}
    </GlassCard>
  );
};

export default WeeklyNarrativeWidget;
```

- [ ] **Step 2: Add to DashboardPage.tsx right column**

In `client/src/features/dashboard/DashboardPage.tsx`:

1. Import: `import WeeklyNarrativeWidget from './components/WeeklyNarrativeWidget';`

2. In the right column `<Stack>`, add after `BalanceWidget` (or between ReferralWidget and PostFeed):
```tsx
{currentUserId && <WeeklyNarrativeWidget userId={currentUserId} />}
```

- [ ] **Step 3: Commit**
```bash
git add client/src/features/dashboard/components/WeeklyNarrativeWidget.tsx \
        client/src/features/dashboard/DashboardPage.tsx
git commit -m "feat: weekly AI narrative widget on dashboard (on-demand, collapse/expand)"
```

---

## Chunk 2: Sparring Partner System

### Task 5: Backend — Sparring endpoints

**Files:**
- Create: `src/controllers/sparringController.ts`
- Create: `src/routes/sparringRoutes.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create sparringController.ts**

```typescript
// src/controllers/sparringController.ts
import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';

/**
 * POST /sparring/request
 * Body: { targetId, nodeId, nodeName }
 * Sends a sparring request from the auth user to targetId on a specific goal node.
 */
export const sendRequest = catchAsync(async (req: Request, res: Response) => {
  const requesterId = req.user?.id;
  if (!requesterId) throw new UnauthorizedError('Not authenticated.');
  const { targetId, nodeId, nodeName } = req.body;
  if (!targetId || !nodeId) throw new BadRequestError('targetId and nodeId required.');

  const { data, error } = await supabase
    .from('sparring_requests')
    .upsert({
      requester_id: requesterId,
      target_id: targetId,
      node_id: nodeId,
      node_name: nodeName ?? null,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'requester_id,target_id,node_id' })
    .select('id, status')
    .single();

  if (error) throw error;

  // Fire notification to target
  await supabase.from('notifications').insert({
    user_id: targetId,
    type: 'sparring_request',
    title: 'Spar? 🥊',
    body: `Someone wants to spar on "${nodeName ?? 'a goal'}". Check it out.`,
    metadata: { request_id: data.id, node_id: nodeId },
  }).catch(() => {}); // non-fatal

  res.status(201).json(data);
});

/**
 * POST /sparring/respond
 * Body: { requestId, accept: boolean, myNodeId }
 * Accepts or rejects a sparring request. On accept, creates a sparring_partners row.
 */
export const respondRequest = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { requestId, accept, myNodeId } = req.body;
  if (!requestId || accept === undefined) throw new BadRequestError('requestId and accept required.');

  const { data: req_, error: fetchErr } = await supabase
    .from('sparring_requests')
    .select('id, requester_id, target_id, node_id, node_name, status')
    .eq('id', requestId)
    .eq('target_id', userId)
    .single();

  if (fetchErr || !req_) return res.status(404).json({ error: 'Request not found.' });
  if (req_.status !== 'pending') return res.status(409).json({ error: 'Already responded.' });

  const newStatus = accept ? 'accepted' : 'rejected';
  await supabase.from('sparring_requests').update({ status: newStatus }).eq('id', requestId);

  if (accept) {
    await supabase.from('sparring_partners').upsert({
      user_a: req_.requester_id,
      user_b: req_.target_id,
      node_id_a: req_.node_id,
      node_id_b: myNodeId ?? req_.node_id,
      joint_streak: 0,
    }, { onConflict: 'user_a,user_b,node_id_a' });

    // Notify requester
    await supabase.from('notifications').insert({
      user_id: req_.requester_id,
      type: 'sparring_accepted',
      title: 'Sparring accepted! 🥊',
      body: `Your spar request on "${req_.node_name ?? 'a goal'}" was accepted.`,
      metadata: { request_id: requestId },
    }).catch(() => {});
  }

  res.json({ status: newStatus });
});

/**
 * GET /sparring/requests
 * Returns incoming pending sparring requests for the auth user.
 */
export const getIncoming = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('sparring_requests')
    .select('id, requester_id, node_id, node_name, created_at, expires_at')
    .eq('target_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Enrich with requester name
  const ids = (data ?? []).map(r => r.requester_id);
  let profiles: Record<string, { name: string; avatar_url: string | null }> = {};
  if (ids.length > 0) {
    const { data: pData } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', ids);
    for (const p of pData ?? []) profiles[p.id] = { name: p.name, avatar_url: p.avatar_url };
  }

  res.json((data ?? []).map(r => ({ ...r, requester: profiles[r.requester_id] ?? null })));
});

/**
 * GET /sparring/partners
 * Returns active sparring partners for the auth user with joint streak info.
 */
export const getPartners = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('sparring_partners')
    .select('id, user_a, user_b, node_id_a, node_id_b, joint_streak, last_joint_checkin, created_at')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('joint_streak', { ascending: false });

  if (error) throw error;
  res.json(data ?? []);
});

/**
 * POST /sparring/toggle-open
 * Body: { nodeId, open: boolean }
 * Sets whether the user is open to sparring on a node (updates profiles.sparring_open_node_ids).
 */
export const toggleOpen = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');
  const { nodeId, open } = req.body;
  if (!nodeId || open === undefined) throw new BadRequestError('nodeId and open required.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('sparring_open_node_ids')
    .eq('id', userId)
    .single();

  const current: string[] = Array.isArray(profile?.sparring_open_node_ids) ? profile.sparring_open_node_ids : [];
  const updated = open
    ? Array.from(new Set([...current, nodeId]))
    : current.filter(id => id !== nodeId);

  await supabase.from('profiles').update({ sparring_open_node_ids: updated }).eq('id', userId);
  res.json({ sparring_open_node_ids: updated });
});
```

- [ ] **Step 2: Create sparringRoutes.ts**

```typescript
// src/routes/sparringRoutes.ts
import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { sendRequest, respondRequest, getIncoming, getPartners, toggleOpen } from '../controllers/sparringController';

const router = Router();
router.post('/request', authenticateToken, sendRequest);
router.post('/respond', authenticateToken, respondRequest);
router.get('/requests', authenticateToken, getIncoming);
router.get('/partners', authenticateToken, getPartners);
router.post('/toggle-open', authenticateToken, toggleOpen);
export default router;
```

- [ ] **Step 3: Register in app.ts**

```typescript
import sparringRoutes from './routes/sparringRoutes';
// ...
app.use('/api/sparring', sparringRoutes);
```

- [ ] **Step 4: Commit**
```bash
git add src/controllers/sparringController.ts src/routes/sparringRoutes.ts src/app.ts
git commit -m "feat: sparring partner system — request/accept/toggle endpoints"
```

---

### Task 6: Frontend — Sparring UI on GoalWidgets + MatchesPage

**Files:**
- Create: `client/src/features/goals/components/SparringBadge.tsx`
- Modify: `client/src/features/dashboard/components/GoalWidgets.tsx`
- Modify: `client/src/features/matches/MatchesPage.tsx`

- [ ] **Step 1: Create SparringBadge.tsx**

This badge sits on a goal card and lets users toggle "Open to spar" status.

```tsx
// client/src/features/goals/components/SparringBadge.tsx
import React, { useState } from 'react';
import { Chip, Tooltip } from '@mui/material';
import SportsKabaddiIcon from '@mui/icons-material/SportsKabaddi';
import api from '../../../lib/api';
import toast from 'react-hot-toast';

interface Props {
  nodeId: string;
  initialOpen?: boolean;
}

const SparringBadge: React.FC<Props> = ({ nodeId, initialOpen = false }) => {
  const [open, setOpen] = useState(initialOpen);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await api.post('/sparring/toggle-open', { nodeId, open: !open });
      setOpen(v => !v);
      toast.success(open ? 'Closed sparring for this goal' : 'You\'re open to spar on this goal 🥊');
    } catch {
      toast.error('Failed to update sparring status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip title={open ? 'Open to spar — click to close' : 'Open to sparring on this goal'}>
      <Chip
        icon={<SportsKabaddiIcon sx={{ fontSize: '14px !important' }} />}
        label={open ? 'Sparring' : 'Spar?'}
        size="small"
        onClick={toggle}
        disabled={loading}
        sx={{
          height: 22,
          fontSize: '0.65rem',
          fontWeight: 700,
          cursor: 'pointer',
          bgcolor: open ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
          color: open ? '#EF4444' : 'text.secondary',
          border: '1px solid',
          borderColor: open ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)',
          '&:hover': { bgcolor: open ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)' },
        }}
      />
    </Tooltip>
  );
};

export default SparringBadge;
```

- [ ] **Step 2: Add SparringBadge to GoalWidgets**

In `GoalWidgets.tsx`, import `SparringBadge` and add it to each node card's chip row:
```tsx
import SparringBadge from '../../goals/components/SparringBadge';
// ...inside each node card's chip/button row:
<SparringBadge nodeId={node.id} />
```

- [ ] **Step 3: Add "Spar?" instant button to MatchesPage**

In `client/src/features/matches/MatchesPage.tsx`:

1. Add a "Spar?" button on each match card that opens a small dialog:
   - Shows the user's own goal nodes (as a select)
   - Sends `POST /sparring/request` with `{ targetId, nodeId, nodeName }`

Find where match cards are rendered and add after the existing action buttons:
```tsx
// State (add near top of component):
const [sparModal, setSparModal] = useState<{ userId: string; name: string } | null>(null);
const [sparNodeId, setSparNodeId] = useState('');

// Button on each match card:
<Button
  size="small" variant="outlined"
  onClick={() => setSparModal({ userId: match.userId, name: matchProfile?.name ?? 'User' })}
  sx={{ borderRadius: '10px', fontWeight: 700, borderColor: '#EF4444', color: '#EF4444',
        '&:hover': { bgcolor: 'rgba(239,68,68,0.06)' } }}
  startIcon={<SportsKabaddiIcon />}
>
  Spar?
</Button>

// Dialog (add before closing return):
<Dialog open={!!sparModal} onClose={() => setSparModal(null)} maxWidth="xs" fullWidth>
  <DialogTitle sx={{ fontWeight: 800 }}>Spar with {sparModal?.name}?</DialogTitle>
  <DialogContent>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Choose which goal you want accountability on:
    </Typography>
    <Select fullWidth value={sparNodeId} onChange={e => setSparNodeId(e.target.value)} displayEmpty>
      <MenuItem value="" disabled>Select a goal</MenuItem>
      {allNodes.filter(n => !n.parentId).map(n => (
        <MenuItem key={n.id} value={n.id}>{n.name || n.title}</MenuItem>
      ))}
    </Select>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setSparModal(null)}>Cancel</Button>
    <Button
      variant="contained" disabled={!sparNodeId}
      onClick={async () => {
        const node = allNodes.find(n => n.id === sparNodeId);
        await api.post('/sparring/request', {
          targetId: sparModal!.userId,
          nodeId: sparNodeId,
          nodeName: node?.name || node?.title || '',
        });
        toast.success('Spar request sent! 🥊');
        setSparModal(null);
      }}
      sx={{ bgcolor: '#EF4444' }}
    >
      Send Request
    </Button>
  </DialogActions>
</Dialog>
```

- [ ] **Step 4: Commit**
```bash
git add client/src/features/goals/components/SparringBadge.tsx \
        client/src/features/dashboard/components/GoalWidgets.tsx \
        client/src/features/matches/MatchesPage.tsx
git commit -m "feat: sparring UI — toggle badge on goal cards, Spar? button on match cards"
```

---

## Chunk 3: Embeddable Widget + Share Snippet

### Task 7: Backend — Public widget endpoint

**Files:**
- Create: `src/controllers/publicWidgetController.ts`
- Create: `src/routes/publicWidgetRoutes.ts`
- Modify: `src/app.ts`

The public widget endpoint returns an HTML page — no auth required, only public profile data.

- [ ] **Step 1: Create publicWidgetController.ts**

```typescript
// src/controllers/publicWidgetController.ts
import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync } from '../utils/appErrors';

/**
 * GET /public/widget/:userId
 * Returns a self-contained HTML iframe widget showing streak + top goal progress.
 * No auth. Uses only public profile fields.
 */
export const getWidget = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const [profileRes, goalRes] = await Promise.all([
    supabase.from('profiles')
      .select('name, current_streak, praxis_points')
      .eq('id', userId)
      .single(),
    supabase.from('goal_trees')
      .select('nodes')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  if (!profile) {
    return res.status(404).send('<p>User not found.</p>');
  }

  const nodes: any[] = goalRes.data?.nodes ?? [];
  const topGoal = nodes
    .filter(n => !n.parentId && !n.parent_id)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];

  const streak = profile.current_streak ?? 0;
  const name = (profile.name ?? 'Praxis User').split(' ')[0];
  const goalName = topGoal?.name || topGoal?.title || '';
  const goalPct = topGoal ? Math.round((topGoal.progress ?? 0) * 100) : 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Praxis — ${name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #0A0B14 0%, #111827 100%);
    color: #fff;
    width: 320px;
    height: 120px;
    display: flex;
    align-items: center;
    padding: 16px;
    gap: 16px;
    border-radius: 16px;
    overflow: hidden;
  }
  .streak {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .flame { font-size: 2rem; line-height: 1; }
  .streak-num { font-size: 1.4rem; font-weight: 900; color: #F97316; }
  .streak-label { font-size: 0.6rem; color: #6B7280; letter-spacing: 0.05em; text-transform: uppercase; }
  .divider { width: 1px; height: 60px; background: rgba(255,255,255,0.08); flex-shrink: 0; }
  .content { flex: 1; min-width: 0; }
  .name { font-size: 0.75rem; color: #9CA3AF; font-weight: 600; margin-bottom: 4px; }
  .goal-name { font-size: 0.9rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; }
  .bar-bg { background: rgba(255,255,255,0.06); border-radius: 99px; height: 6px; }
  .bar-fill { background: linear-gradient(90deg, #F59E0B, #8B5CF6); border-radius: 99px; height: 6px; transition: width 0.6s ease; }
  .bar-label { font-size: 0.65rem; color: #6B7280; margin-top: 4px; display: flex; justify-content: space-between; }
  .branding { font-size: 0.55rem; color: #374151; position: absolute; bottom: 6px; right: 10px; letter-spacing: 0.05em; }
</style>
</head>
<body>
  <div class="streak">
    <div class="flame">🔥</div>
    <div class="streak-num">${streak}</div>
    <div class="streak-label">day streak</div>
  </div>
  <div class="divider"></div>
  <div class="content">
    <div class="name">${name} on Praxis</div>
    ${goalName ? `
    <div class="goal-name">${goalName}</div>
    <div class="bar-bg"><div class="bar-fill" style="width:${goalPct}%"></div></div>
    <div class="bar-label"><span>Progress</span><span>${goalPct}%</span></div>
    ` : '<div class="goal-name">Building in public 💪</div>'}
  </div>
  <div class="branding">PRAXIS</div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(html);
});

/**
 * GET /public/widget/:userId/data
 * JSON version for custom embedding.
 */
export const getWidgetData = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const [profileRes, goalRes] = await Promise.all([
    supabase.from('profiles').select('name, current_streak, praxis_points').eq('id', userId).single(),
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
  ]);
  if (!profileRes.data) return res.status(404).json({ error: 'User not found' });
  const nodes: any[] = goalRes.data?.nodes ?? [];
  const topGoal = nodes.filter(n => !n.parentId && !n.parent_id).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    name: profileRes.data.name,
    streak: profileRes.data.current_streak ?? 0,
    points: profileRes.data.praxis_points ?? 0,
    topGoal: topGoal ? { name: topGoal.name || topGoal.title, progress: Math.round((topGoal.progress ?? 0) * 100) } : null,
  });
});
```

- [ ] **Step 2: Create publicWidgetRoutes.ts**

```typescript
// src/routes/publicWidgetRoutes.ts
import { Router } from 'express';
import { getWidget, getWidgetData } from '../controllers/publicWidgetController';

const router = Router();
// No auth middleware — these are intentionally public
router.get('/:userId', getWidget);
router.get('/:userId/data', getWidgetData);
export default router;
```

- [ ] **Step 3: Register in app.ts**

```typescript
import publicWidgetRoutes from './routes/publicWidgetRoutes';
// ...
app.use('/public/widget', publicWidgetRoutes);
```

- [ ] **Step 4: Commit backend**
```bash
git add src/controllers/publicWidgetController.ts src/routes/publicWidgetRoutes.ts src/app.ts
git commit -m "feat: public widget endpoint GET /public/widget/:userId (HTML + JSON)"
```

---

### Task 8: Frontend — Widget embed UI in Profile/Settings

**Files:**
- Create: `client/src/features/profile/components/EmbedWidget.tsx`
- Modify: `client/src/features/profile/ProfilePage.tsx` (add embed section)

- [ ] **Step 1: Create EmbedWidget.tsx**

```tsx
// client/src/features/profile/components/EmbedWidget.tsx
import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Tabs, Tab, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import GlassCard from '../../../components/common/GlassCard';
import toast from 'react-hot-toast';

const API_BASE = 'https://web-production-646a4.up.railway.app';

interface Props { userId: string; }

const EmbedWidget: React.FC<Props> = ({ userId }) => {
  const [tab, setTab] = useState(0);
  const widgetUrl = `${API_BASE}/public/widget/${userId}`;
  const iframeCode = `<iframe src="${widgetUrl}" width="320" height="120" frameborder="0" style="border-radius:16px;overflow:hidden;" loading="lazy"></iframe>`;
  const markdownBadge = `[![Praxis Streak](${widgetUrl})](https://praxis-app.vercel.app)`;
  const twitterText = `I'm building my goals in public on Praxis — ${widgetUrl}`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  return (
    <GlassCard sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>Embed Your Streak Widget</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Show your streak live on Twitter, LinkedIn, Discord, GitHub, or any website.
      </Typography>

      {/* Live preview */}
      <Box sx={{ mb: 3, borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', maxWidth: 320 }}>
        <iframe src={widgetUrl} width="320" height="120" frameBorder="0" title="Praxis streak widget" />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, '& .MuiTab-root': { fontSize: '0.75rem', fontWeight: 700, minWidth: 80 } }}>
        <Tab label="iFrame" />
        <Tab label="Markdown" />
        <Tab label="Twitter" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <TextField fullWidth multiline value={iframeCode} InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.7rem' } }} sx={{ mb: 1 }} />
          <Button fullWidth variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copy(iframeCode)} sx={{ borderRadius: '10px', fontWeight: 700 }}>
            Copy iFrame
          </Button>
        </Box>
      )}
      {tab === 1 && (
        <Box>
          <TextField fullWidth value={markdownBadge} InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.7rem' } }} sx={{ mb: 1 }} />
          <Button fullWidth variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copy(markdownBadge)} sx={{ borderRadius: '10px', fontWeight: 700 }}>
            Copy Markdown (GitHub README)
          </Button>
        </Box>
      )}
      {tab === 2 && (
        <Box>
          <TextField fullWidth multiline value={twitterText} InputProps={{ readOnly: true }} sx={{ mb: 1 }} />
          <Button fullWidth variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => copy(twitterText)} sx={{ borderRadius: '10px', fontWeight: 700 }}>
            Copy for Twitter/X
          </Button>
        </Box>
      )}
    </GlassCard>
  );
};

export default EmbedWidget;
```

- [ ] **Step 2: Add EmbedWidget to own profile page**

In `ProfilePage.tsx`, when `isOwnProfile` is true, add after the profile stats section:
```tsx
import EmbedWidget from './components/EmbedWidget';
// ...
{isOwnProfile && userId && <EmbedWidget userId={userId} />}
```

- [ ] **Step 3: Commit**
```bash
git add client/src/features/profile/components/EmbedWidget.tsx \
        client/src/features/profile/ProfilePage.tsx
git commit -m "feat: embeddable streak widget — iframe/markdown/twitter copy on profile page"
```

---

### Task 9: Frontend — Shareable Progress Snippet

**Files:**
- Create: `client/src/features/dashboard/components/ShareSnippetButton.tsx`
- Modify: `client/src/features/dashboard/components/AxiomMorningBrief.tsx`

- [ ] **Step 1: Create ShareSnippetButton.tsx**

Uses HTML5 Canvas to generate a 400×200 px PNG snippet showing streak + top goal + Praxis branding.

```tsx
// client/src/features/dashboard/components/ShareSnippetButton.tsx
import React, { useRef } from 'react';
import { Button, Tooltip } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import toast from 'react-hot-toast';

interface Props {
  userName: string;
  streak: number;
  topGoalName?: string;
  topGoalPct?: number;
}

const ShareSnippetButton: React.FC<Props> = ({ userName, streak, topGoalName, topGoalPct = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generate = (): Promise<Blob | null> => new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 800, 400);
    bg.addColorStop(0, '#0A0B14');
    bg.addColorStop(1, '#111827');
    ctx.fillStyle = bg;
    ctx.roundRect(0, 0, 800, 400, 24);
    ctx.fill();

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 400); ctx.stroke(); }
    for (let y = 0; y < 400; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }

    // Flame + streak
    ctx.font = '80px serif';
    ctx.fillText('🔥', 60, 160);
    ctx.font = 'bold 96px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#F97316';
    ctx.fillText(`${streak}`, 160, 175);
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#6B7280';
    ctx.fillText('day streak', 160, 215);

    // Name
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(`${userName} on Praxis`, 60, 290);

    // Goal progress bar
    if (topGoalName) {
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(topGoalName.length > 40 ? topGoalName.slice(0, 40) + '…' : topGoalName, 60, 340);
      // Bar bg
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.roundRect(60, 355, 460, 8, 4); ctx.fill();
      // Bar fill
      const grad = ctx.createLinearGradient(60, 0, 520, 0);
      grad.addColorStop(0, '#F59E0B');
      grad.addColorStop(1, '#8B5CF6');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(60, 355, 460 * (topGoalPct / 100), 8, 4); ctx.fill();
      ctx.font = '18px -apple-system, sans-serif';
      ctx.fillStyle = '#6B7280';
      ctx.fillText(`${topGoalPct}%`, 530, 365);
    }

    // Branding
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'right';
    ctx.fillText('praxis-app.vercel.app', 740, 385);

    canvas.toBlob(resolve, 'image/png');
  });

  const handleShare = async () => {
    try {
      const blob = await generate();
      if (!blob) throw new Error('Canvas generation failed');
      const file = new File([blob], 'praxis-streak.png', { type: 'image/png' });
      const text = `${streak} day streak on Praxis 🔥 Join me → https://praxis-app.vercel.app`;

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'My Praxis Streak', text, files: [file] });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'praxis-streak.png'; a.click();
        URL.revokeObjectURL(url);
        toast.success('Image downloaded! Post it anywhere.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') toast.error('Could not generate share image.');
    }
  };

  if (streak < 3) return null; // Only show if streak is meaningful

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <Tooltip title="Share your streak as an image">
        <Button
          size="small"
          variant="outlined"
          startIcon={<ShareIcon sx={{ fontSize: '14px !important' }} />}
          onClick={handleShare}
          sx={{
            borderRadius: '10px', fontWeight: 700, fontSize: '0.7rem',
            borderColor: 'rgba(249,115,22,0.4)', color: '#F97316',
            '&:hover': { bgcolor: 'rgba(249,115,22,0.06)' },
          }}
        >
          Share Streak
        </Button>
      </Tooltip>
    </>
  );
};

export default ShareSnippetButton;
```

- [ ] **Step 2: Add ShareSnippetButton to AxiomMorningBrief**

In `AxiomMorningBrief.tsx`, import and add the button in the header area next to the Check In button:

```tsx
import ShareSnippetButton from './ShareSnippetButton';
// ...
// In the top header Stack (where Check In button is):
<ShareSnippetButton
  userName={userName}
  streak={localStreak ?? streak}
  topGoalName={data?.match?.name} // or pass a real goal name prop
  topGoalPct={avgProgress}
/>
```

- [ ] **Step 3: Commit**
```bash
git add client/src/features/dashboard/components/ShareSnippetButton.tsx \
        client/src/features/dashboard/components/AxiomMorningBrief.tsx
git commit -m "feat: share streak snippet — canvas PNG export, native share or download"
```

---

## Chunk 4: Monetization Gates + Language Setting

### Task 10: Language selector in Settings

**Files:**
- Modify: `client/src/features/settings/SettingsPage.tsx`
- Modify: `client/src/lib/i18n.ts` or wherever i18n is configured

- [ ] **Step 1: Find i18n config**
```bash
find client/src -name "i18n*" | head -5
grep -r "i18next" client/src --include="*.ts" -l | head -5
```

- [ ] **Step 2: Add language selector to SettingsPage**

In `SettingsPage.tsx`, find the existing `Section` for notifications or account and add a new "Language" section:

```tsx
import { useTranslation } from 'react-i18next';
import LanguageIcon from '@mui/icons-material/Language';
// ...
const { i18n } = useTranslation();
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
];

// In JSX (new Section):
<Section icon={<LanguageIcon color="primary" />} title="Language">
  <FormControl fullWidth>
    <InputLabel>App Language</InputLabel>
    <Select
      value={i18n.language?.slice(0, 2) ?? 'en'}
      label="App Language"
      onChange={async (e) => {
        await i18n.changeLanguage(e.target.value);
        // Persist to DB
        await api.patch('/users/me', { preferred_language: e.target.value }).catch(() => {});
        toast.success('Language updated');
      }}
    >
      {LANGUAGES.map(l => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
    </Select>
  </FormControl>
</Section>
```

- [ ] **Step 3: Patch preferred_language on login (load from profile)**

In `client/src/hooks/useUser.ts`, after fetching the profile, add:
```typescript
import i18n from '../lib/i18n'; // or wherever i18n is
// After profile fetch:
if (profile?.preferred_language && profile.preferred_language !== i18n.language) {
  i18n.changeLanguage(profile.preferred_language);
}
```

- [ ] **Step 4: Commit**
```bash
git add client/src/features/settings/SettingsPage.tsx client/src/hooks/useUser.ts
git commit -m "feat: language selector in settings, persists to profile.preferred_language"
```

---

### Task 11: Update Monetization Gates

**Files:**
- Modify: `src/controllers/pointsController.ts` (update PP catalogue)
- Modify: `client/src/features/marketplace/MarketplacePage.tsx` (update Pro plan copy)
- Modify: `src/controllers/stripeController.ts` (verify Pro price is $9.99)

- [ ] **Step 1: Update PP catalogue in pointsController.ts**

Find `CATALOGUE` or the object defining PP items and update:
```typescript
const CATALOGUE = {
  boost_visibility:   { cost: 150, description: 'Boost your profile for 24h' },
  goal_slot:          { cost: 200, description: 'Unlock an extra root goal slot' }, // was 200, no change
  coaching_session:   { cost: 500, description: 'Premium AI coaching deep-dive' }, // was 500, no change
  super_match:        { cost: 300, description: 'Priority matching for 48h' },
  custom_icon:        { cost: 100, description: 'Custom goal node icon' },
  skip_grading:       { cost: 80,  description: 'Skip peer grading round' },
  bet_stake:          { cost: 50,  description: 'Place a goal bet stake' },
  suspend_goal:       { cost: 50,  description: 'Suspend a goal node' },
  premium_coaching:   { cost: 500, description: 'Premium 1:1 AI coaching session' }, // add if missing
};
```

- [ ] **Step 2: Update Pro plan copy in MarketplacePage.tsx**

Find the Pro card and update description/price copy:
```tsx
// Pro plan card copy:
title: "Pro"
price: "$9.99/mo"
features: [
  "Unlimited goal nodes",
  "Daily AI summaries + weekly narrative",
  "Unlimited sparring partners",
  "Custom goal themes",
  "Priority matching",
  "Streak shield",
]
```

- [ ] **Step 3: Commit**
```bash
git add src/controllers/pointsController.ts \
        client/src/features/marketplace/MarketplacePage.tsx
git commit -m "chore: update PP catalogue and Pro plan copy ($9.99/mo, aligned with pivot)"
```

---

### Task 12: Final commit — push everything

- [ ] **Step 1: Run a build check**
```bash
cd client && npm run build 2>&1 | tail -20
```
Expected: no errors. If TypeScript errors, fix them before pushing.

- [ ] **Step 2: Push**
```bash
git push
```

- [ ] **Step 3: Update MEMORY.md** with pivot summary and new features.

---

## Summary of New DB Tables

| Table | Purpose |
|---|---|
| `node_journal_entries` | Per-node mood + text entries |
| `sparring_requests` | Pending/accepted/rejected spar requests |
| `sparring_partners` | Active spar partnerships + joint streak |

## Summary of New API Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/journal/entries` | ✅ | Add journal entry |
| `GET /api/journal/entries?nodeId=` | ✅ | Get entries for a node |
| `GET /api/journal/recent` | ✅ | All recent entries (for weekly narrative) |
| `POST /api/ai-coaching/weekly-narrative` | ✅ | Generate weekly recap |
| `POST /api/sparring/request` | ✅ | Send spar request |
| `POST /api/sparring/respond` | ✅ | Accept/reject request |
| `GET /api/sparring/requests` | ✅ | Incoming requests |
| `GET /api/sparring/partners` | ✅ | Active partners |
| `POST /api/sparring/toggle-open` | ✅ | Toggle open-to-spar on a node |
| `GET /public/widget/:userId` | ❌ | HTML iframe widget |
| `GET /public/widget/:userId/data` | ❌ | JSON widget data |
