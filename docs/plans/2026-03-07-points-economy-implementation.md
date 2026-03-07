# Points Economy Rework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat like/honor system with Reddit karma, weighted-decaying honor, per-node goal edit costs, event QR check-in, and a karma-aware reliability score.

**Architecture:** Backend Express controllers handle all PP mutations atomically with profile updates. Frontend vote/edit UIs call new or extended endpoints; PP balance is shown inline so users feel the economy. DB migration runs first as a prerequisite for all other tasks.

**Tech Stack:** Express + TypeScript (backend), React + MUI v7 (frontend), Supabase (DB + auth), `crypto` module (HMAC tokens for QR), `qrcode` npm package (QR rendering).

---

### Task 1: DB Migration

**Files:**
- Create: `docs/migrations/2026-03-07-economy-v2.sql`

**Step 1: Write the migration file**

```sql
-- 1. Post votes (replaces post_likes for karma)
CREATE TABLE IF NOT EXISTS post_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value       SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_votes_post ON post_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_votes_user ON post_votes(user_id);

-- 2. Karma score on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS karma_score INTEGER DEFAULT 0;

-- 3. Event attendees (QR check-in)
CREATE TABLE IF NOT EXISTS event_attendees (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- 4. Link chat_rooms to events
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- 5. honor_score as float
ALTER TABLE profiles ALTER COLUMN honor_score TYPE FLOAT USING COALESCE(honor_score, 0)::FLOAT;

-- 6. Onboarding grant: new profiles start with 200 PP
-- Handle in application code (profile creation). For existing 0-point users:
-- UPDATE profiles SET praxis_points = 200 WHERE praxis_points = 0 OR praxis_points IS NULL;

-- 7. honor_votes: add created_at if missing (needed for decay)
ALTER TABLE honor_votes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
```

**Step 2: Run it in Supabase SQL editor**

Go to Supabase dashboard → SQL Editor → paste and run. Verify no errors.

**Step 3: Commit**

```bash
git add docs/migrations/2026-03-07-economy-v2.sql
git commit -m "feat: economy v2 DB migration — post_votes, karma_score, event_attendees, honor float"
```

---

### Task 2: Post Votes Backend (karma endpoint)

**Files:**
- Modify: `src/controllers/postController.ts`
- Modify: `src/routes/postRoutes.ts`

**Step 1: Add `votePost` controller at the bottom of `postController.ts`**

```typescript
/**
 * POST /posts/:id/vote
 * Body: { value: 1 | -1 }
 * Upserts a vote. Flipping direction or removing (same value = toggle off).
 * Awards/deducts PP from post author in real time.
 */
export const votePost = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const voterId = req.user?.id;
  if (!voterId) throw new ForbiddenError('Authentication required.');

  const { id: postId } = req.params;
  const { value } = req.body as { value: 1 | -1 };
  if (value !== 1 && value !== -1) throw new BadRequestError('value must be 1 or -1.');

  // Fetch post author
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single();
  if (!post) throw new NotFoundError('Post not found.');

  const authorId = post.user_id;

  // Check existing vote
  const { data: existing } = await supabase
    .from('post_votes')
    .select('id, value')
    .eq('post_id', postId)
    .eq('user_id', voterId)
    .maybeSingle();

  let delta = 0; // net karma change for author
  let netVote = value; // final vote stored (null = removed)

  if (existing) {
    if (existing.value === value) {
      // Toggle off — remove vote
      await supabase.from('post_votes').delete().eq('id', existing.id);
      delta = value === 1 ? -3 : 1; // undo the previous award/penalty
      netVote = 0;
    } else {
      // Flip — update vote
      await supabase.from('post_votes').update({ value }).eq('id', existing.id);
      // e.g. was -1 (author lost 1), now +1 (author gains 3): net = +4
      delta = value === 1 ? 4 : -4;
    }
  } else {
    // New vote
    await supabase.from('post_votes').insert({ post_id: postId, user_id: voterId, value });
    delta = value === 1 ? 3 : -1;
  }

  // Update author karma_score + praxis_points (best-effort, non-fatal)
  if (delta !== 0 && authorId !== voterId) {
    const { data: authorProfile } = await supabase
      .from('profiles')
      .select('praxis_points, karma_score')
      .eq('id', authorId)
      .single();
    if (authorProfile) {
      await supabase.from('profiles').update({
        praxis_points: Math.max(0, (authorProfile.praxis_points ?? 0) + delta),
        karma_score: (authorProfile.karma_score ?? 0) + delta,
      }).eq('id', authorId);
    }
  }

  // Return new net score for the post
  const { data: votes } = await supabase
    .from('post_votes')
    .select('value')
    .eq('post_id', postId);
  const score = (votes ?? []).reduce((s: number, v: any) => s + v.value, 0);

  res.json({ score, userVote: netVote });
});
```

**Step 2: Add `getPostVote` to return current user's vote on a post**

```typescript
/**
 * GET /posts/:id/vote
 * Returns the requesting user's current vote (1, -1, or 0) and net score.
 */
export const getPostVote = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  const { id: postId } = req.params;

  const [voteRes, scoresRes] = await Promise.all([
    userId
      ? supabase.from('post_votes').select('value').eq('post_id', postId).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('post_votes').select('value').eq('post_id', postId),
  ]);

  const score = ((scoresRes as any).data ?? []).reduce((s: number, v: any) => s + v.value, 0);
  res.json({ score, userVote: (voteRes as any).data?.value ?? 0 });
});
```

**Step 3: Register routes in `src/routes/postRoutes.ts`**

Add these two lines (import the new exports first):

```typescript
import { /* existing */ votePost, getPostVote } from '../controllers/postController';
// ...
router.post('/:id/vote', authenticateToken, votePost);
router.get('/:id/vote', authenticateToken, getPostVote);
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit   # from project root
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add src/controllers/postController.ts src/routes/postRoutes.ts
git commit -m "feat: post vote endpoint with karma PP awards"
```

---

### Task 3: Post Voting UI (replace likes)

**Files:**
- Modify: `client/src/features/posts/PostFeed.tsx`

**Step 1: Read `PostFeed.tsx` to understand current like button location**

Find the section that renders the like button (currently a heart icon calling `handleLike` or `toggleLike`). Replace it with upvote/downvote.

**Step 2: Add state and fetch vote on mount**

In the post map/render, each post needs a `userVote` and `score` state. Use a `postVotes` state map:

```typescript
const [postVotes, setPostVotes] = useState<Record<string, { score: number; userVote: number }>>({});

// After posts load, fetch votes for each post (batched via parallel calls, max 20)
useEffect(() => {
  if (!posts.length) return;
  const { data: { session } } = await supabase.auth.getSession(); // inside async IIFE
  if (!session) return;
  const headers = { Authorization: `Bearer ${session.access_token}` };
  Promise.all(
    posts.slice(0, 20).map(p =>
      axios.get(`${API_URL}/posts/${p.id}/vote`, { headers })
        .then(r => [p.id, r.data] as [string, { score: number; userVote: number }])
        .catch(() => [p.id, { score: 0, userVote: 0 }] as [string, { score: number; userVote: number }])
    )
  ).then(results => {
    const map: Record<string, { score: number; userVote: number }> = {};
    results.forEach(([id, data]) => { map[id] = data; });
    setPostVotes(map);
  });
}, [posts]);
```

**Step 3: Replace the like button JSX with vote controls**

Replace the existing like `<IconButton>` with:

```tsx
{/* Vote controls */}
<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
  <IconButton
    size="small"
    onClick={() => handleVote(post.id, 1)}
    sx={{
      color: postVotes[post.id]?.userVote === 1 ? '#F97316' : 'text.disabled',
      p: 0.5,
    }}
  >
    <KeyboardArrowUpIcon fontSize="small" />
  </IconButton>
  <Typography
    variant="caption"
    sx={{
      fontWeight: 700, minWidth: 20, textAlign: 'center',
      color: (postVotes[post.id]?.score ?? 0) > 0
        ? '#F97316'
        : (postVotes[post.id]?.score ?? 0) < 0
        ? '#EF4444'
        : 'text.disabled',
    }}
  >
    {postVotes[post.id]?.score ?? 0}
  </Typography>
  <IconButton
    size="small"
    onClick={() => handleVote(post.id, -1)}
    sx={{
      color: postVotes[post.id]?.userVote === -1 ? '#EF4444' : 'text.disabled',
      p: 0.5,
    }}
  >
    <KeyboardArrowDownIcon fontSize="small" />
  </IconButton>
</Box>
```

**Step 4: Add `handleVote` function**

```typescript
const handleVote = async (postId: string, value: 1 | -1) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { toast.error('Sign in to vote'); return; }
  try {
    const res = await axios.post(
      `${API_URL}/posts/${postId}/vote`,
      { value },
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    setPostVotes(prev => ({ ...prev, [postId]: res.data }));
  } catch {
    toast.error('Vote failed');
  }
};
```

**Step 5: Add missing MUI icon imports**

```typescript
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
```

**Step 6: Dim low-score posts**

Wrap the post card in:
```tsx
sx={{ opacity: (postVotes[post.id]?.score ?? 0) < -5 ? 0.5 : 1, transition: 'opacity 0.3s' }}
```

**Step 7: Check TypeScript**

```bash
cd client && npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add client/src/features/posts/PostFeed.tsx
git commit -m "feat: reddit-style upvote/downvote replacing post likes"
```

---

### Task 4: Karma on Profile Page

**Files:**
- Modify: `client/src/features/profile/ProfilePage.tsx`

**Step 1: Find where `honor_score` is displayed on the profile**

Search for `honor` in the profile stats section.

**Step 2: Add karma display next to honor**

The profile already fetches the profile object which now includes `karma_score`. Find the stats chips (streak, reliability, honor) and add:

```tsx
{/* Karma */}
{(profile as any).karma_score !== undefined && (
  <Chip
    label={`${(profile as any).karma_score >= 0 ? '+' : ''}${(profile as any).karma_score} karma`}
    size="small"
    sx={{
      bgcolor: (profile as any).karma_score >= 0 ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)',
      color: (profile as any).karma_score >= 0 ? '#F97316' : '#EF4444',
      border: `1px solid ${(profile as any).karma_score >= 0 ? 'rgba(249,115,22,0.3)' : 'rgba(239,68,68,0.3)'}`,
      fontWeight: 700,
      fontSize: '0.72rem',
    }}
  />
)}
```

**Step 3: Commit**

```bash
git add client/src/features/profile/ProfilePage.tsx
git commit -m "feat: karma score displayed on profile page"
```

---

### Task 5: Honor Rework — Cost + Decay

**Files:**
- Modify: `src/controllers/honorController.ts`

**Step 1: Rewrite `giveHonor` with PP cost and float score**

Replace the existing `giveHonor` function body:

```typescript
export const giveHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const voterId = req.user?.id;
  if (!voterId) throw new ForbiddenError('Authentication required.');

  const { targetId } = req.params;
  if (targetId === voterId) throw new BadRequestError('You cannot honor yourself.');

  const HONOR_COST = 10;   // PP voter pays
  const VOTER_REWARD = 5;  // PP voter gets back
  const TARGET_REWARD = 20; // PP target receives

  // Check voter has enough PP
  const { data: voterProfile } = await supabase
    .from('profiles')
    .select('id, praxis_points')
    .eq('id', voterId)
    .single();
  if (!voterProfile) throw new NotFoundError('Your profile not found.');
  if ((voterProfile.praxis_points ?? 0) < HONOR_COST) {
    return res.status(402).json({
      error: 'INSUFFICIENT_POINTS',
      message: `Giving honor costs ${HONOR_COST} PP. You have ${voterProfile.praxis_points ?? 0} PP.`,
    });
  }

  // Check target exists
  const { data: target } = await supabase
    .from('profiles')
    .select('id, praxis_points')
    .eq('id', targetId)
    .single();
  if (!target) throw new NotFoundError('User not found.');

  // Insert vote (unique constraint rejects duplicates)
  const { error: voteError } = await supabase
    .from('honor_votes')
    .insert({ voter_id: voterId, target_id: targetId });

  if (voteError) {
    if (SCHEMA_MISSING(voteError.message)) {
      return res.status(503).json({ message: 'Honor system not yet enabled. Run DB migrations.' });
    }
    if (voteError.code === '23505') throw new BadRequestError('You have already honored this user.');
    throw new InternalServerError('Failed to give honor.');
  }

  // Deduct cost from voter, add back reward; award target
  await Promise.all([
    supabase.from('profiles').update({
      praxis_points: (voterProfile.praxis_points ?? 0) - HONOR_COST + VOTER_REWARD,
    }).eq('id', voterId),
    supabase.from('profiles').update({
      praxis_points: (target.praxis_points ?? 0) + TARGET_REWARD,
    }).eq('id', targetId),
  ]);

  // Recompute honor_score as weighted decayed float
  const newScore = await computeHonorScore(targetId);
  await supabase.from('profiles').update({ honor_score: newScore }).eq('id', targetId);

  pushNotification({
    userId: targetId,
    type: 'honor',
    title: 'Someone honoured you',
    body: `Your honor score is now ${newScore.toFixed(2)}.`,
    link: `/profile/${targetId}`,
    actorId: voterId,
  }).catch(() => {});

  res.json({ message: 'Honor given.', honor_score: newScore, net_cost: HONOR_COST - VOTER_REWARD });
});
```

**Step 2: Add `computeHonorScore` helper above the exports**

```typescript
/**
 * Weighted, decaying honor score.
 * Each vote contributes giver_reliability_score * age_weight.
 * Full weight for 0-60d, half weight 61-120d, zero after 120d.
 */
async function computeHonorScore(targetId: string): Promise<number> {
  const { data: votes } = await supabase
    .from('honor_votes')
    .select('voter_id, created_at')
    .eq('target_id', targetId);

  if (!votes || votes.length === 0) return 0;

  const voterIds = votes.map((v: any) => v.voter_id);
  const { data: voterProfiles } = await supabase
    .from('profiles')
    .select('id, reliability_score')
    .in('id', voterIds);

  const reliabilityMap: Record<string, number> = {};
  (voterProfiles ?? []).forEach((p: any) => {
    reliabilityMap[p.id] = p.reliability_score ?? 0.5;
  });

  const now = Date.now();
  let score = 0;
  for (const vote of votes) {
    const ageMs = now - new Date(vote.created_at).getTime();
    const ageDays = ageMs / 86400000;
    if (ageDays > 120) continue;
    const ageWeight = ageDays <= 60 ? 1.0 : 0.5;
    const reliability = reliabilityMap[vote.voter_id] ?? 0.5;
    score += reliability * ageWeight;
  }
  return Math.round(score * 100) / 100;
}
```

**Step 3: Update `revokeHonor` to refund PP correctly**

```typescript
export const revokeHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const voterId = req.user?.id;
  if (!voterId) throw new ForbiddenError('Authentication required.');
  const { targetId } = req.params;

  const { error, count } = await supabase
    .from('honor_votes')
    .delete({ count: 'exact' })
    .eq('voter_id', voterId)
    .eq('target_id', targetId);

  if (error) throw new InternalServerError('Failed to revoke honor.');
  if ((count ?? 0) === 0) throw new NotFoundError('No honor vote found to revoke.');

  // Refund voter 10 PP (the original cost, not the reward)
  // Deduct 20 PP from target
  const HONOR_COST = 10;
  const TARGET_REWARD = 20;
  const [voterRes, targetRes] = await Promise.all([
    supabase.from('profiles').select('praxis_points').eq('id', voterId).single(),
    supabase.from('profiles').select('praxis_points').eq('id', targetId).single(),
  ]);
  await Promise.all([
    supabase.from('profiles').update({
      praxis_points: (voterRes.data?.praxis_points ?? 0) + HONOR_COST,
    }).eq('id', voterId),
    supabase.from('profiles').update({
      praxis_points: Math.max(0, (targetRes.data?.praxis_points ?? 0) - TARGET_REWARD),
    }).eq('id', targetId),
  ]);

  const newScore = await computeHonorScore(targetId);
  await supabase.from('profiles').update({ honor_score: newScore }).eq('id', targetId);

  res.json({ message: 'Honor revoked.', honor_score: newScore });
});
```

**Step 4: Update `getHonor` to recompute on read (keeps score fresh)**

```typescript
export const getHonor = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const requesterId = req.user?.id;
  const { userId } = req.params;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('honor_score')
    .eq('id', userId)
    .single();
  if (error || !profile) throw new NotFoundError('User not found.');

  // Recompute and persist (lazy refresh)
  const freshScore = await computeHonorScore(userId);
  if (Math.abs(freshScore - (profile.honor_score ?? 0)) > 0.01) {
    supabase.from('profiles').update({ honor_score: freshScore }).eq('id', userId).then(() => {});
  }

  let hasHonored = false;
  if (requesterId && requesterId !== userId) {
    const { data: vote } = await supabase
      .from('honor_votes').select('voter_id')
      .eq('voter_id', requesterId).eq('target_id', userId).maybeSingle();
    hasHonored = !!vote;
  }

  res.json({ honor_score: freshScore, has_honored: hasHonored });
});
```

**Step 5: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/controllers/honorController.ts
git commit -m "feat: honor rework — PP cost/reward, weighted decay, float score"
```

---

### Task 6: Reliability Formula — Add Karma Component

**Files:**
- Modify: `src/controllers/checkinController.ts`

**Step 1: Find the reliability computation block (around line 100–137)**

Replace the formula section:

```typescript
  // K = Karma signal: tanh(karma_score / 50), bounded (-1, 1)
  const { data: karmaRow } = await supabase
    .from('profiles')
    .select('karma_score')
    .eq('id', userId)
    .single();
  const karmaScore: number = karmaRow?.karma_score ?? 0;
  const K = Math.tanh(karmaScore / 50);

  const C = Math.min(((recentCount ?? 0) + 1) / 30, 1);
  const V = verificationRate;
  const S = Math.min(streakUpdate.current_streak, 30) / 30;
  // Updated formula: R = 0.50*C + 0.25*V + 0.10*S + 0.15*K  (K can be negative)
  const reliabilityScore = Math.max(0, Math.min(1, 0.50 * C + 0.25 * V + 0.10 * S + 0.15 * K));
```

**Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/controllers/checkinController.ts
git commit -m "feat: reliability adds 0.15*K karma component via tanh"
```

---

### Task 7: Per-Node Goal Edit Endpoints

**Files:**
- Modify: `src/controllers/goalController.ts`
- Modify: `src/routes/goalRoutes.ts`

**Step 1: Add `createNode` controller at bottom of `goalController.ts`**

```typescript
/**
 * POST /goals/:userId/node
 * Create a single new goal node. Costs 25 PP.
 */
export const createNode = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (req.user?.id !== userId) throw new ForbiddenError('Cannot edit another user\'s goals.');

  const NODE_EDIT_COST = 25;
  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points, goal_tree_edit_count')
    .eq('id', userId)
    .single();
  if (!profile) throw new NotFoundError('Profile not found.');

  if ((profile.praxis_points ?? 0) < NODE_EDIT_COST) {
    return res.status(402).json({
      error: 'INSUFFICIENT_POINTS',
      message: `Creating a node costs ${NODE_EDIT_COST} PP. You have ${profile.praxis_points ?? 0} PP.`,
      needed: NODE_EDIT_COST,
      have: profile.praxis_points ?? 0,
    });
  }

  const { id, name, domain, parentId, weight, customDetails, targetDate, completionMetric } = req.body;
  if (!id || !name) throw new BadRequestError('id and name are required.');

  const newNode: GoalNode = {
    id,
    name,
    domain: domain || 'Career',
    parentId: parentId || null,
    progress: 0,
    weight: weight ?? 1,
    customDetails: customDetails || '',
    targetDate: targetDate || null,
    completionMetric: completionMetric || '',
    children: [],
  };

  // Load existing tree and append node
  const { data: tree } = await supabase
    .from('goal_trees')
    .select('nodes, rootNodes')
    .eq('userId', userId)
    .single();

  const nodes: GoalNode[] = Array.isArray(tree?.nodes) ? tree.nodes : [];
  const rootNodes: GoalNode[] = Array.isArray(tree?.rootNodes) ? tree.rootNodes : [];
  nodes.push(newNode);
  if (!parentId) rootNodes.push(newNode);

  await supabase.from('goal_trees').upsert({ userId, nodes, rootNodes }, { onConflict: 'userId' });

  // Deduct PP + increment edit count
  await supabase.from('profiles').update({
    praxis_points: (profile.praxis_points ?? 0) - NODE_EDIT_COST,
    goal_tree_edit_count: (profile.goal_tree_edit_count ?? 0) + 1,
  }).eq('id', userId);

  res.status(201).json({ node: newNode, newBalance: (profile.praxis_points ?? 0) - NODE_EDIT_COST });
});
```

**Step 2: Add `editNode` controller**

```typescript
/**
 * PATCH /goals/:userId/node/:nodeId
 * Edit a node's metadata (name/desc/domain/dates). Costs 25 PP.
 * Progress updates use the existing /progress endpoint (free).
 */
export const editNode = catchAsync(async (req: Request, res: Response) => {
  const { userId, nodeId } = req.params;
  if (req.user?.id !== userId) throw new ForbiddenError('Cannot edit another user\'s goals.');

  const NODE_EDIT_COST = 25;
  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points, goal_tree_edit_count')
    .eq('id', userId)
    .single();
  if (!profile) throw new NotFoundError('Profile not found.');

  if ((profile.praxis_points ?? 0) < NODE_EDIT_COST) {
    return res.status(402).json({
      error: 'INSUFFICIENT_POINTS',
      message: `Editing a node costs ${NODE_EDIT_COST} PP. You have ${profile.praxis_points ?? 0} PP.`,
      needed: NODE_EDIT_COST,
      have: profile.praxis_points ?? 0,
    });
  }

  const { name, domain, customDetails, targetDate, completionMetric, weight } = req.body;

  const { data: tree } = await supabase
    .from('goal_trees')
    .select('nodes, rootNodes')
    .eq('userId', userId)
    .single();

  if (!tree) throw new NotFoundError('Goal tree not found.');
  const nodes: GoalNode[] = Array.isArray(tree.nodes) ? tree.nodes : [];
  const rootNodes: GoalNode[] = Array.isArray(tree.rootNodes) ? tree.rootNodes : [];

  let found = false;
  const updatedNodes = nodes.map((n: GoalNode) => {
    if (n.id !== nodeId) return n;
    found = true;
    return {
      ...n,
      ...(name !== undefined && { name }),
      ...(domain !== undefined && { domain }),
      ...(customDetails !== undefined && { customDetails }),
      ...(targetDate !== undefined && { targetDate }),
      ...(completionMetric !== undefined && { completionMetric }),
      ...(weight !== undefined && { weight }),
    };
  });
  if (!found) throw new NotFoundError('Goal node not found.');
  const updatedRootNodes = rootNodes.map((n: GoalNode) =>
    n.id !== nodeId ? n : updatedNodes.find(u => u.id === nodeId) ?? n
  );

  await supabase.from('goal_trees')
    .update({ nodes: updatedNodes, rootNodes: updatedRootNodes })
    .eq('userId', userId);

  await supabase.from('profiles').update({
    praxis_points: (profile.praxis_points ?? 0) - NODE_EDIT_COST,
    goal_tree_edit_count: (profile.goal_tree_edit_count ?? 0) + 1,
  }).eq('id', userId);

  const updatedNode = updatedNodes.find(n => n.id === nodeId);
  res.json({ node: updatedNode, newBalance: (profile.praxis_points ?? 0) - NODE_EDIT_COST });
});
```

**Step 3: Add `deleteNode` controller (free)**

```typescript
/**
 * DELETE /goals/:userId/node/:nodeId
 * Remove a node from the tree. Free.
 */
export const deleteNode = catchAsync(async (req: Request, res: Response) => {
  const { userId, nodeId } = req.params;
  if (req.user?.id !== userId) throw new ForbiddenError('Cannot edit another user\'s goals.');

  const { data: tree } = await supabase
    .from('goal_trees').select('nodes, rootNodes').eq('userId', userId).single();
  if (!tree) throw new NotFoundError('Goal tree not found.');

  const nodes: GoalNode[] = (Array.isArray(tree.nodes) ? tree.nodes : [])
    .filter((n: GoalNode) => n.id !== nodeId);
  const rootNodes: GoalNode[] = (Array.isArray(tree.rootNodes) ? tree.rootNodes : [])
    .filter((n: GoalNode) => n.id !== nodeId);

  await supabase.from('goal_trees').update({ nodes, rootNodes }).eq('userId', userId);
  res.json({ success: true });
});
```

**Step 4: Register routes in `src/routes/goalRoutes.ts`**

```typescript
import { getGoalTree, createOrUpdateGoalTree, updateNodeProgress, createNode, editNode, deleteNode } from '../controllers/goalController';

router.post('/:userId/node', authenticateToken, createNode);
router.patch('/:userId/node/:nodeId', authenticateToken, editNode);
router.delete('/:userId/node/:nodeId', authenticateToken, deleteNode);
```

**Step 5: Restrict bulk PUT to first-time only**

In `createOrUpdateGoalTree` (around line 155), find the edit-count check and modify:

```typescript
  // Block bulk save after onboarding — use per-node endpoints instead
  if ((editCount ?? 0) > 0) {
    throw new ForbiddenError(
      'Use per-node edit endpoints after initial tree creation. ' +
      'PATCH /goals/:userId/node/:nodeId to edit a node (costs 25 PP).'
    );
  }
```

**Step 6: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/controllers/goalController.ts src/routes/goalRoutes.ts
git commit -m "feat: per-node goal create/edit/delete endpoints with 25PP cost gate"
```

---

### Task 8: Services Posting Cost Gate

**Files:**
- Modify: `src/controllers/servicesController.ts`

**Step 1: Find `createService` (line ~65) and add PP check at the top**

After the userId check, insert:

```typescript
  const SERVICE_POST_COST = 30;
  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single();

  if (!profile || (profile.praxis_points ?? 0) < SERVICE_POST_COST) {
    return res.status(402).json({
      error: 'INSUFFICIENT_POINTS',
      message: `Posting a service costs ${SERVICE_POST_COST} PP. You have ${profile?.praxis_points ?? 0} PP.`,
      needed: SERVICE_POST_COST,
      have: profile?.praxis_points ?? 0,
    });
  }
```

After a successful insert, add PP deduction:

```typescript
  // Deduct PP
  await supabase.from('profiles').update({
    praxis_points: (profile.praxis_points ?? 0) - SERVICE_POST_COST,
  }).eq('id', userId);
```

**Step 2: Update frontend `ServicesPage.tsx` to show cost warning**

In the create dialog, add a note below the submit button:

```tsx
<Typography variant="caption" sx={{ color: 'text.disabled', mt: 1, display: 'block' }}>
  Posting costs 30 PP from your balance.
</Typography>
```

Handle 402 response in the create handler:

```typescript
} catch (err: any) {
  if (err.response?.data?.error === 'INSUFFICIENT_POINTS') {
    toast.error(`Not enough PP — need 30, you have ${err.response.data.have}. Earn more by checking in or completing goals.`);
  } else {
    toast.error('Failed to post service.');
  }
}
```

**Step 3: TypeScript check + commit**

```bash
cd client && npx tsc --noEmit && cd ..
npx tsc --noEmit
git add src/controllers/servicesController.ts client/src/features/services/ServicesPage.tsx
git commit -m "feat: service posting costs 30 PP with insufficient-balance feedback"
```

---

### Task 9: Event QR Check-in Backend

**Files:**
- Modify: `src/controllers/eventsController.ts`
- Modify: `src/routes/eventsRoutes.ts`

**Step 1: Add `getCheckinToken` controller**

```typescript
import crypto from 'crypto';

const APP_SECRET = process.env.APP_SECRET || 'praxis-dev-secret-change-in-prod';

function signToken(eventId: string, expiryMs: number): string {
  const payload = `${eventId}:${expiryMs}`;
  const sig = crypto.createHmac('sha256', APP_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyToken(token: string): { eventId: string; valid: boolean } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const [eventId, expiryStr, sig] = decoded.split(':');
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() > expiry) return { eventId, valid: false };
    const expected = crypto.createHmac('sha256', APP_SECRET)
      .update(`${eventId}:${expiryStr}`).digest('hex');
    return { eventId, valid: crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) };
  } catch {
    return { eventId: '', valid: false };
  }
}

/**
 * GET /events/:id/checkin-token
 * Returns a signed token for the organizer to generate a QR code.
 * Token valid for 24h after event start.
 */
export const getCheckinToken = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { id: eventId } = req.params;
  const { data: event } = await supabase
    .from('events').select('creator_id, event_date, event_time').eq('id', eventId).single();
  if (!event) throw new NotFoundError('Event not found.');
  if (event.creator_id !== userId) throw new ForbiddenError('Only the event organizer can generate check-in codes.');

  const eventStart = new Date(`${event.event_date}T${event.event_time || '00:00'}:00`);
  const expiry = eventStart.getTime() + 24 * 3600 * 1000;
  const token = signToken(eventId, expiry);

  const checkinUrl = `${process.env.FRONTEND_URL || 'https://praxis-app.vercel.app'}/events/${eventId}/checkin?token=${token}`;
  res.json({ token, checkinUrl, expiresAt: new Date(expiry).toISOString() });
});

/**
 * POST /events/:id/checkin
 * Body: { token }
 * Verifies HMAC token, marks attendance, awards +50 PP.
 */
export const checkinEvent = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new ForbiddenError('Authentication required.');

  const { id: eventId } = req.params;
  const { token } = req.body as { token?: string };
  if (!token) throw new BadRequestError('token is required.');

  const { valid } = verifyToken(token);
  if (!valid) throw new BadRequestError('Invalid or expired check-in token.');

  // Check duplicate
  const { data: existing } = await supabase
    .from('event_attendees')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return res.json({ alreadyCheckedIn: true, message: 'Already checked in to this event.' });
  }

  // Record attendance
  await supabase.from('event_attendees').insert({ event_id: eventId, user_id: userId });

  // Award +50 PP
  const { data: profile } = await supabase.from('profiles').select('praxis_points').eq('id', userId).single();
  const newBalance = (profile?.praxis_points ?? 0) + 50;
  await supabase.from('profiles').update({ praxis_points: newBalance }).eq('id', userId);

  res.json({ alreadyCheckedIn: false, pointsAwarded: 50, newBalance });
});
```

**Step 2: Register routes in `src/routes/eventsRoutes.ts`**

```typescript
import { getEvents, createEvent, deleteEvent, rsvpEvent, removeRsvp, getCheckinToken, checkinEvent } from '../controllers/eventsController';

router.get('/:id/checkin-token', authenticateToken, getCheckinToken);
router.post('/:id/checkin', authenticateToken, checkinEvent);
```

**Step 3: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/controllers/eventsController.ts src/routes/eventsRoutes.ts
git commit -m "feat: event QR check-in — HMAC token + 50PP award"
```

---

### Task 10: Event → Auto-Group on Create

**Files:**
- Modify: `src/controllers/eventsController.ts`

**Step 1: Add group creation at end of `createEvent` (after the event insert succeeds)**

After `res.status(201).json(event)` — replace the res call with:

```typescript
  // Auto-create linked group room for the event
  supabase.from('chat_rooms').insert({
    name: event.title,
    description: event.description ?? `Group for the event: ${event.title}`,
    created_by: userId,
    type: 'event',
    event_id: event.id,
  }).then(({ error: roomErr }) => {
    if (roomErr) logger.warn(`Could not auto-create group for event ${event.id}: ${roomErr.message}`);
  });

  res.status(201).json(event);
```

**Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/controllers/eventsController.ts
git commit -m "feat: event creation auto-creates linked group room"
```

---

### Task 11: Event QR Check-in Frontend

**Files:**
- Modify: `client/src/features/events/EventsPage.tsx`

**Step 1: Install qrcode.react**

```bash
cd client && npm install qrcode.react && cd ..
```

**Step 2: Add QR code display for organizer**

In the event detail/card section (where the creator sees their event), add:

```tsx
import { QRCodeSVG } from 'qrcode.react';

// State
const [checkinUrl, setCheckinUrl] = useState<Record<string, string>>({});
const [showQR, setShowQR] = useState<Record<string, boolean>>({});

// Fetch token when organizer clicks "Check-in QR"
const handleShowQR = async (eventId: string) => {
  if (checkinUrl[eventId]) { setShowQR(prev => ({ ...prev, [eventId]: !prev[eventId] })); return; }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await axios.get(`${API_URL}/events/${eventId}/checkin-token`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setCheckinUrl(prev => ({ ...prev, [eventId]: res.data.checkinUrl }));
    setShowQR(prev => ({ ...prev, [eventId]: true }));
  } catch {
    toast.error('Could not generate check-in code.');
  }
};
```

In the event card, show the button only for the creator:

```tsx
{event.creator_id === user?.id && (
  <Button size="small" variant="outlined" onClick={() => handleShowQR(event.id)}
    sx={{ borderRadius: '10px', borderColor: 'rgba(139,92,246,0.4)', color: '#8B5CF6', fontWeight: 700 }}>
    Check-in QR
  </Button>
)}
{showQR[event.id] && checkinUrl[event.id] && (
  <Box sx={{ mt: 2, p: 2, bgcolor: '#fff', borderRadius: '12px', display: 'inline-block' }}>
    <QRCodeSVG value={checkinUrl[event.id]} size={200} />
  </Box>
)}
```

**Step 3: Handle `/events/:id/checkin?token=...` route**

In the app router (`client/src/App.tsx` or `routes.tsx`), the `/events/:id/checkin` path should render a page that:
1. Reads `token` from query params
2. Calls `POST /events/:id/checkin` with the token
3. Shows success (+50 PP) or error

Add a small inline component or handle it within `EventsPage` by checking `useSearchParams`.

```tsx
// At top of EventsPage or in a separate EventCheckinPage component:
const [searchParams] = useSearchParams();
const checkinToken = searchParams.get('token');
const { id: eventId } = useParams<{ id?: string }>();

useEffect(() => {
  if (!checkinToken || !eventId || !user) return;
  const doCheckin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await axios.post(`${API_URL}/events/${eventId}/checkin`,
        { token: checkinToken },
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (res.data.alreadyCheckedIn) {
        toast('Already checked in!', { icon: '✅' });
      } else {
        toast.success(`Checked in! +${res.data.pointsAwarded} PP`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Check-in failed.');
    }
  };
  doCheckin();
}, [checkinToken, eventId, user]);
```

**Step 4: TypeScript check + commit**

```bash
cd client && npx tsc --noEmit
git add client/src/features/events/EventsPage.tsx
git commit -m "feat: event QR code display for organizer + auto check-in on scan"
```

---

### Task 12: Onboarding Grant (200 PP)

**Files:**
- Modify: `src/controllers/userController.ts` or wherever profile is first created

**Step 1: Find profile creation**

Search for `supabase.from('profiles').insert` in the codebase:

```bash
grep -rn "profiles.*insert\|insert.*profiles" src/ --include="*.ts"
```

**Step 2: Add 200 PP to initial profile insert**

In the profile creation insert payload, add:

```typescript
praxis_points: 200, // Onboarding grant — covers first 8 node edits
```

**Step 3: Update `OnboardingPage.tsx` to inform the user**

After onboarding completes, show a toast:

```typescript
toast.success('Welcome! You\'ve been granted 200 PP to get started.', { duration: 5000, icon: '⚡' });
```

**Step 4: Commit**

```bash
git add src/ client/src/features/onboarding/OnboardingPage.tsx
git commit -m "feat: 200PP onboarding grant for all new users"
```

---

### Task 13: Feed Ranking — Combined Rep Signal

**Files:**
- Modify: `src/controllers/postController.ts`

**Step 1: Find the feed scoring section (~line 120–135)**

Replace the honor/reliability lines:

```typescript
    // Combined rep: honor_score (weighted-decayed float) + log(1 + max(karma, 0))
    const honorVal = authorProfile?.honor_score ?? 0;
    const karmaVal = authorProfile?.karma_score ?? 0;
    const combinedRep = honorVal + Math.log(1 + Math.max(karmaVal, 0));
    const maxRep = Math.max(1, maxHonor + Math.log(1 + Math.max(karmaVal, 0)));
    const rep = Math.min(combinedRep / maxRep, 1);

    const reliability = (authorProfile?.reliability_score ?? 0) / maxReliability;
    const rawScore = goalOverlap * 0.30 + proximity * 0.25 + rep * 0.20 + reliability * 0.15 + recency * 0.10;
```

Also update the profile select to include `karma_score`:

```typescript
supabase.from('profiles')
  .select('id, honor_score, reliability_score, karma_score, latitude, longitude')
  .in('id', authorIds)
```

**Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/controllers/postController.ts
git commit -m "feat: feed ranking uses honor+karma combined rep signal"
```

---

## Completion Checklist

- [ ] Task 1: DB migration run in Supabase
- [ ] Task 2: `POST /posts/:id/vote` + `GET /posts/:id/vote`
- [ ] Task 3: Vote UI in PostFeed (upvote/downvote, score display, dim at <-5)
- [ ] Task 4: Karma on ProfilePage
- [ ] Task 5: Honor rework (cost, decay, float score, revoke refund)
- [ ] Task 6: Reliability formula adds K component
- [ ] Task 7: Per-node `createNode` / `editNode` / `deleteNode` + bulk PUT blocked
- [ ] Task 8: Services post cost gate (30 PP)
- [ ] Task 9: Event QR check-in backend (HMAC token + attendance + 50PP)
- [ ] Task 10: Event auto-group on create
- [ ] Task 11: EventsPage QR display + scan handler
- [ ] Task 12: 200 PP onboarding grant
- [ ] Task 13: Feed ranking with combined rep
