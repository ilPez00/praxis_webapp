# Red Priority Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the three highest-impact issues from the Session 53 CEO/product audit.

**Architecture:** Three independent changes — a backend N+1 query fix (matchingController), a UI rebrand (betting→commitments across 3 files), and a new gating component (GettingStartedPage injected into DashboardPage).

**Tech Stack:** Express/TypeScript backend, React + MUI v7 frontend, Supabase JS client.

---

### Task 1: Matches N+1 → Server-Side Enrichment

**Files:**
- Modify: `src/controllers/matchingController.ts`
- Modify: `client/src/features/matches/MatchesPage.tsx`

**Context:**
The matching controller has two paths (pgvector fast-path and O(n²) slow-path). Both currently return only `{ userId, score }`. The frontend then fires 2 HTTP requests per match to get profile + goal data. We batch-enrich at the controller level instead.

Goal nodes live as JSONB inside `goal_trees.nodes`, not a separate table.

**Step 1: Enrich both paths in matchingController.ts**

At the end of the fast path (after building `results`) and at the end of the slow path (after `filtered.map(...)`), add a shared enrichment helper that:
1. Collects all matched userIds
2. Batch-fetches profiles in one query: `.from('profiles').select('id, name, avatar_url, bio, current_streak, last_activity_date').in('id', userIds)`
3. Batch-fetches goal trees: `.from('goal_trees').select('userId, nodes').in('userId', userIds)`
4. Joins in-memory and returns enriched objects

Enriched shape per match:
```typescript
{
  userId: string;
  score: number;
  name: string;
  avatarUrl?: string;
  bio?: string;
  currentStreak?: number;
  lastCheckinDate?: string | null;
  domains: string[];
  sharedGoals: string[];      // top 3 node names by progress desc
  overallProgress?: number;   // 0-100
}
```

Add a helper function `enrichMatches` at the bottom of the file:
```typescript
async function enrichMatches(
  rawMatches: { userId: string; score: number }[],
): Promise<object[]> {
  if (rawMatches.length === 0) return [];
  const userIds = rawMatches.map(m => m.userId);

  const [{ data: profiles }, { data: trees }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, avatar_url, bio, current_streak, last_activity_date')
      .in('id', userIds),
    supabase
      .from('goal_trees')
      .select('userId, nodes')
      .in('userId', userIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const treeMap = new Map((trees ?? []).map((t: any) => [t.userId, t.nodes ?? []]));

  return rawMatches.map(m => {
    const p = profileMap.get(m.userId) as any;
    const nodes: any[] = treeMap.get(m.userId) ?? [];
    const domains: string[] = [...new Set<string>(nodes.map((n: any) => n.domain).filter(Boolean))];
    const sharedGoals: string[] = nodes
      .filter((n: any) => n.name && typeof n.progress === 'number')
      .sort((a: any, b: any) => b.progress - a.progress)
      .slice(0, 3)
      .map((n: any) => n.name);
    const progNodes = nodes.filter((n: any) => typeof n.progress === 'number');
    const overallProgress = progNodes.length
      ? Math.round(progNodes.reduce((s: number, n: any) => s + n.progress, 0) / progNodes.length * 100)
      : undefined;

    return {
      userId: m.userId,
      score: m.score,
      name: p?.name ?? `User ${m.userId.slice(0, 6)}`,
      avatarUrl: p?.avatar_url ?? undefined,
      bio: p?.bio ?? undefined,
      currentStreak: p?.current_streak ?? 0,
      lastCheckinDate: p?.last_activity_date ?? null,
      domains,
      sharedGoals,
      overallProgress,
    };
  });
}
```

Replace the fast-path `return res.json(...)` line with:
```typescript
const enriched = await enrichMatches(results.map((r: any) => ({ userId: r.userId, score: r.score })));
return res.json(enriched);
```

Replace the slow-path `res.json(filtered.map(...))` line with:
```typescript
const enriched = await enrichMatches(filtered.map(m => ({ userId: m.user, score: m.score })));
res.json(enriched);
```

**Step 2: Simplify MatchesPage.tsx — remove the per-match Promise.all loop**

The `fetchMatches` function currently (lines ~364–416) maps over raw matches and fires per-user requests. Replace the entire inner body with:

```typescript
const matchRes = await axios.get(url);
const enrichedMatches: MatchProfile[] = (matchRes.data ?? []).map((m: any) => ({
  userId: m.userId,
  score: m.score,
  name: m.name,
  avatarUrl: m.avatarUrl,
  bio: m.bio,
  domains: m.domains ?? [],
  sharedGoals: m.sharedGoals ?? [],
  overallProgress: m.overallProgress,
  currentStreak: m.currentStreak ?? 0,
  lastCheckinDate: m.lastCheckinDate ?? null,
}));
setRealMatches(enrichedMatches);
```

Remove the per-profile Supabase fetch and per-goals axios fetch. Remove the `progressPace` field from the mapping (it was computed client-side from stale logic — can be re-added later server-side).

**Step 3: Verify TypeScript compiles**

```bash
cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit
```

Expected: 0 errors.

---

### Task 2: Betting → Commitments Rebrand

**Files:**
- Modify: `client/src/config/routes.tsx`
- Modify: `client/src/components/common/Navbar.tsx`
- Modify: `client/src/features/betting/BettingPage.tsx`

**Step 1: routes.tsx — rename route path**

Change line 86:
```typescript
// Before
{ path: '/betting', element: BettingPage, private: true },
// After
{ path: '/commitments', element: BettingPage, private: true },
```

**Step 2: Navbar.tsx — update 2 locations**

Desktop dropdown MenuItem (around line 534):
```tsx
// Before
<MenuItem onClick={() => handleNav('/betting')} sx={{ gap: 1.5, py: 1.25 }}>
  <CasinoIcon fontSize="small" sx={{ color: 'text.secondary' }} />
  <Typography variant="body2">Goal Staking</Typography>
</MenuItem>
// After
<MenuItem onClick={() => handleNav('/commitments')} sx={{ gap: 1.5, py: 1.25 }}>
  <VerifiedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
  <Typography variant="body2">Commitments</Typography>
</MenuItem>
```

Mobile drawer ListItem (around line 675):
```tsx
// Before
{ label: 'Goal Staking', to: '/betting', icon: <CasinoIcon /> },
// After
{ label: 'Commitments', to: '/commitments', icon: <VerifiedIcon /> },
```

Also add `VerifiedIcon` to the imports and remove `CasinoIcon` if no longer used elsewhere.

**Step 3: BettingPage.tsx — rename labels and copy**

Exact string replacements:
- `"Goal Staking"` (h4 heading) → `"Commitments"`
- `"Put your Praxis Points on the line. Complete the goal → 2× reward. Fail → forfeit."` → `"Put your Praxis Points behind a goal. Fulfill it → 2× reward. Miss it → forfeit."`
- `"Place Bet"` (Button) → `"New Commitment"`
- `"Active Bets"` (stat label) → `"Active Pledges"`
- `"Active Bets ({activeBets.length})"` (section heading) → `"Active Pledges ({activeBets.length})"`
- `"No active bets. Stake some PP on a goal to get started."` → `"No active pledges. Commit some PP to a goal to get started."`
- `"need at least {MIN_STAKE} PP to place a bet."` → `"You need at least {MIN_STAKE} PP to make a pledge. Keep checking in!"`
- STATUS_META label `'Won'` → `'Fulfilled'`
- STATUS_META label `'Lost'` → `'Missed'`
- Dialog title `"Place a Bet"` → `"Make a Commitment"`
- `label="Goal to bet on"` → `label="Goal to commit to"`
- `helperText="You can only bet on incomplete goals"` → `helperText="Only incomplete goals are eligible"`
- Button text: `{creating ? 'Placing…' : \`Stake ${stake} PP\`}` → `{creating ? 'Committing…' : \`Pledge ${stake} PP\`}`
- Toast: `\`Bet placed! ${stake} PP staked on "${node.name}"\`` → `\`Commitment made! ${stake} PP pledged on "${node.name}"\``
- Auto-post content: update `"🎯 I just staked"` → `"🎯 I just pledged"` and `"Hold me accountable!"` stays fine
- Cancel toast: `'Bet cancelled. 90% of stake refunded (10% house fee).'` → `'Pledge cancelled. 90% of stake refunded (10% house fee).'`
- Share text: `"I just staked"` → `"I just pledged"` and `"I accepted a Praxis challenge"` → `"I made a Praxis commitment"`
- `"PP staked"` chip label → `"PP pledged"`

**Step 4: Verify TypeScript**

```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit
```

---

### Task 3: GettingStartedPage — Onboarding Gate

**Files:**
- Create: `client/src/features/onboarding/GettingStartedPage.tsx`
- Modify: `client/src/features/dashboard/DashboardPage.tsx`

**Context:**
No SQL migration needed. Gate: if the user has completed onboarding (`user.onboarding_completed === true`) but has no goal tree (`rootGoals.length === 0`), show the 3-step getting started page instead of the full dashboard. Once they build a goal tree, they auto-graduate.

**Step 1: Create GettingStartedPage.tsx**

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChatIcon from '@mui/icons-material/Chat';
import GlassCard from '../../components/common/GlassCard';

interface Step {
  num: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  to: string;
  color: string;
}

const GettingStartedPage: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();

  const steps: Step[] = [
    {
      num: 1,
      icon: <TrackChangesIcon sx={{ fontSize: 32 }} />,
      title: 'Build your goal tree',
      description: 'Map out what you\'re working toward. The more specific, the better your matches.',
      cta: 'Set up goals →',
      to: '/goal-selection',
      color: '#F59E0B',
    },
    {
      num: 2,
      icon: <AutoAwesomeIcon sx={{ fontSize: 32 }} />,
      title: 'See who you match with',
      description: 'Our algorithm finds people aligned with your specific ambitions and progress pace.',
      cta: 'View matches →',
      to: '/matches',
      color: '#8B5CF6',
    },
    {
      num: 3,
      icon: <ChatIcon sx={{ fontSize: 32 }} />,
      title: 'Start a conversation',
      description: 'Message your top match. Real accountability starts with one conversation.',
      cta: 'Open chat →',
      to: '/communication',
      color: '#10B981',
    },
  ];

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="md" sx={{ pt: 8, pb: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: '-0.03em', mb: 1.5 }}>
            Welcome to{' '}
            <Box component="span" sx={{
              background: 'linear-gradient(135deg, #F59E0B, #8B5CF6)',
              backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Praxis
            </Box>
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 480, mx: 'auto', lineHeight: 1.6 }}>
            Three steps to find people who share your ambitions and hold you accountable.
          </Typography>
        </Box>

        <Stack spacing={3}>
          {steps.map((step) => (
            <GlassCard
              key={step.num}
              sx={{
                p: 3.5,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                border: `1px solid ${step.color}22`,
                borderRadius: '20px',
                flexDirection: { xs: 'column', sm: 'row' },
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              <Box sx={{
                width: 64, height: 64, borderRadius: '16px', flexShrink: 0,
                bgcolor: `${step.color}15`, color: step.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${step.color}30`,
              }}>
                {step.icon}
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="caption" sx={{ color: step.color, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Step {step.num}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>{step.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{step.description}</Typography>
              </Box>
              <Button
                variant={step.num === 1 ? 'contained' : 'outlined'}
                onClick={() => navigate(step.to)}
                sx={{
                  borderRadius: '12px', fontWeight: 700, px: 3, py: 1.25, whiteSpace: 'nowrap', flexShrink: 0,
                  ...(step.num === 1
                    ? { background: `linear-gradient(135deg, ${step.color}, ${step.color}CC)`, boxShadow: `0 4px 16px ${step.color}44` }
                    : { borderColor: `${step.color}55`, color: step.color, '&:hover': { borderColor: step.color, bgcolor: `${step.color}0D` } }),
                }}
              >
                {step.cta}
              </Button>
            </GlassCard>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default GettingStartedPage;
```

**Step 2: Gate in DashboardPage.tsx**

After the loading/error guards (around line 170), add — using data already fetched:

```tsx
// Gate: user has finished onboarding but hasn't built a goal tree yet
if (user?.onboarding_completed && !hasGoals && currentUserId) {
  return <GettingStartedPage userId={currentUserId} />;
}
```

Add import at the top:
```tsx
import GettingStartedPage from '../onboarding/GettingStartedPage';
```

The `hasGoals` variable is already computed on line 173 (`const hasGoals = rootGoals.length > 0`), so this gate reads naturally after the existing data fetching.

**Step 3: Verify TypeScript**

```bash
cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit
```

---

### Final: Commit

```bash
cd /home/gio/Praxis/praxis_webapp
git add src/controllers/matchingController.ts \
        client/src/features/matches/MatchesPage.tsx \
        client/src/config/routes.tsx \
        client/src/components/common/Navbar.tsx \
        client/src/features/betting/BettingPage.tsx \
        client/src/features/onboarding/GettingStartedPage.tsx \
        client/src/features/dashboard/DashboardPage.tsx \
        docs/plans/2026-03-07-red-priority-audit.md
git commit -m "feat: session 53 red-priority audit — N+1 fix, commitments rebrand, onboarding gate"
```
