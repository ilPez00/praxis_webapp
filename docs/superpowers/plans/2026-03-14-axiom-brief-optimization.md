# Axiom Daily Brief Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Axiom daily brief token usage by ~85% and add three new agent-like suggestion sections (bets, sub-goals, progressions).

**Architecture:** Pre-compute match/event/place picks server-side instead of dumping raw JSON into the LLM prompt. Add bet suggestions, sub-goal suggestions, and progression recommendations to the brief. Compress snapshot format. Template mode (free tier) gets all features with zero LLM calls.

**Tech Stack:** Express + TypeScript backend, Supabase (PostgreSQL), Gemini/DeepSeek LLM, React + MUI v7 frontend.

**Spec:** `docs/superpowers/specs/2026-03-14-axiom-brief-optimization-design.md`

---

## Chunk 1: Backend — Snapshot Compression + Pre-computed Picks

### Task 1: Compress the snapshot format

**Files:**
- Modify: `src/services/AxiomScanService.ts:13-57` (buildSnapshot function)

- [ ] **Step 1: Update `buildSnapshot` to use compact key-value format**

Replace the current `buildSnapshot` function body (lines 13-57) with compressed output:

```ts
/** Build a compact text snapshot of a user's current state. */
async function buildSnapshot(userId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  const [goalTreeRes, trackersRes, postsRes, checkinRes] = await Promise.all([
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
    supabase.from('trackers').select('id').eq('user_id', userId),
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today),
    supabase
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('checked_in_at', today),
  ]);

  const nodes: any[] = goalTreeRes.data?.nodes ?? [];
  const rootGoals = nodes
    .filter((n: any) => !n.parentId)
    .map((n: any) => `${(n.name || n.title || 'Goal').slice(0, 25)} ${Math.round((n.progress ?? 0) * 100)}%`);

  const trackerIds = (trackersRes.data ?? []).map((t: any) => t.id);
  let loggedTrackers = 0;
  if (trackerIds.length > 0) {
    const { count } = await supabase
      .from('tracker_entries')
      .select('id', { count: 'exact', head: true })
      .in('tracker_id', trackerIds)
      .gte('logged_at', today);
    loggedTrackers = count ?? 0;
  }

  // Compact format: ~40 tokens vs ~120 in old format
  return `G:${rootGoals.length > 0 ? rootGoals.join(',') : '-'}|T:${loggedTrackers}/${trackerIds.length}|P:${postsRes.count ?? 0}|C:${checkinRes.count ?? 0}`;
}
```

Key changes: removed `name` from trackers select (unneeded), truncated goal names to 25 chars (was 40), single-line pipe-delimited output.

- [ ] **Step 2: Verify backend compiles**

Run: `cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No new errors in AxiomScanService.ts

- [ ] **Step 3: Commit**

```bash
git add src/services/AxiomScanService.ts
git commit -m "refactor: compress Axiom snapshot format (~60% token reduction)"
```

---

### Task 2: Add server-side scoring helpers for picks

**Files:**
- Modify: `src/services/AxiomScanService.ts` (add helper functions before the class)

- [ ] **Step 1: Add scoring functions above the `AxiomScanService` class**

Insert after `saveSnapshot` function (after line 83), before the class definition:

```ts
// ---------------------------------------------------------------------------
// Server-side pick scoring — replaces raw JSON dumps to LLM
// ---------------------------------------------------------------------------

interface PickedMatch { id: string; name: string }
interface PickedEvent { id: string; title: string; date: string }
interface PickedPlace { id: string; name: string }

/** Score and pick the best event by city match + soonest date. */
function pickBestEvent(events: any[], userCity: string): PickedEvent | null {
  if (!events || events.length === 0) return null;
  const scored = events.map((e: any) => {
    let score = 0;
    if (e.city && userCity && e.city.toLowerCase() === userCity.toLowerCase()) score += 3;
    // Soonest date gets highest bonus (2 for today, decaying)
    const daysAway = Math.max(0, Math.floor((new Date(e.event_date).getTime() - Date.now()) / 86400000));
    score += Math.max(0, 2 - daysAway * 0.1);
    return { ...e, score };
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  const best = scored[0];
  return { id: best.id, title: best.title, date: best.event_date?.slice(0, 10) ?? '' };
}

/** Score and pick the best place by city match + tag overlap with user domains. */
function pickBestPlace(places: any[], userCity: string, userDomains: string[]): PickedPlace | null {
  if (!places || places.length === 0) return null;
  const domainLower = userDomains.map(d => d.toLowerCase());
  const scored = places.map((p: any) => {
    let score = 0;
    if (p.city && userCity && p.city.toLowerCase() === userCity.toLowerCase()) score += 3;
    // Freeform tags: case-insensitive substring match against domain names
    const tags: string[] = Array.isArray(p.tags) ? p.tags : [];
    for (const tag of tags) {
      const tl = (tag || '').toLowerCase();
      for (const d of domainLower) {
        if (tl.includes(d) || d.includes(tl)) { score += 1; break; }
      }
    }
    return { ...p, score };
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  return { id: scored[0].id, name: scored[0].name };
}

/** Extract root goal domain names from nodes array. */
function extractUserDomains(nodes: any[]): string[] {
  return nodes
    .filter((n: any) => !n.parentId && n.domain)
    .map((n: any) => String(n.domain))
    .filter(Boolean);
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/services/AxiomScanService.ts
git commit -m "feat: add server-side scoring helpers for Axiom picks"
```

---

### Task 3: Add domain sub-goal templates and bet/progression helpers

**Files:**
- Modify: `src/services/AxiomScanService.ts` (add below the scoring helpers)

- [ ] **Step 1: Add domain templates and suggestion builders**

Insert after the `extractUserDomains` function:

```ts
// ---------------------------------------------------------------------------
// Domain sub-goal templates (free tier — zero LLM tokens)
// ---------------------------------------------------------------------------

const DOMAIN_SUBGOAL_TEMPLATES: Record<string, Array<{ title: string; description: string }>> = {
  'Career': [
    { title: 'Identify a key skill gap', description: 'Research what skill would most accelerate your progress' },
    { title: 'Schedule a mentor check-in', description: 'Find someone ahead of you and ask one question' },
    { title: 'Build a portfolio piece', description: 'Create tangible proof of your ability' },
  ],
  'Investing / Financial Growth': [
    { title: 'Review your allocation', description: 'Check if your current split matches your risk profile' },
    { title: 'Research one new asset', description: 'Spend 30 min learning about an unfamiliar instrument' },
    { title: 'Set an automation', description: 'Automate one recurring investment or savings transfer' },
  ],
  'Fitness': [
    { title: 'Set a measurable weekly target', description: 'Define a specific number you can track (reps, km, kg)' },
    { title: 'Find an accountability partner', description: 'Train with someone at your level or slightly above' },
    { title: 'Track daily with a habit log', description: 'Log every session, even short ones, to build consistency' },
  ],
  'Academics': [
    { title: 'Create a study schedule', description: 'Block specific hours for focused study this week' },
    { title: 'Find a study partner', description: 'Learning with others improves retention by 50%' },
    { title: 'Set a practice exam date', description: 'Testing yourself is the most effective way to learn' },
  ],
  'Mental Health': [
    { title: 'Start a daily reflection habit', description: '5 minutes of journaling before bed compounds fast' },
    { title: 'Identify one stress trigger', description: 'Name the pattern so you can interrupt it' },
    { title: 'Schedule one recovery activity', description: 'Block time for something that genuinely recharges you' },
  ],
  'Philosophical Development': [
    { title: 'Read one challenging text', description: 'Pick something that stretches your current worldview' },
    { title: 'Write down your core values', description: 'Clarity of values drives better daily decisions' },
    { title: 'Have a deep conversation', description: 'Find someone who disagrees with you and listen' },
  ],
  'Culture / Hobbies / Creative Pursuits': [
    { title: 'Dedicate a weekly creative block', description: 'Protect 2h/week for creation, not consumption' },
    { title: 'Share your work', description: 'Post or show one piece to get feedback and accountability' },
    { title: 'Learn one new technique', description: 'Deliberate practice on a specific skill, not just repetition' },
  ],
  'Intimacy / Romantic Exploration': [
    { title: 'Plan an intentional date', description: 'Something that creates a shared experience, not just dinner' },
    { title: 'Practice vulnerability', description: 'Share one thing you normally keep to yourself' },
    { title: 'Ask a meaningful question', description: 'Go deeper than surface-level conversation' },
  ],
  'Friendship / Social Engagement': [
    { title: 'Reach out to someone first', description: 'Send one message to someone you have not talked to recently' },
    { title: 'Organize a small gathering', description: 'Even 2-3 people creates stronger bonds than large groups' },
    { title: 'Be the initiator this week', description: 'Make plans instead of waiting to be invited' },
  ],
  'Personal Goals': [
    { title: 'Break it into milestones', description: 'Define 3 checkpoints between here and completion' },
    { title: 'Set a deadline', description: 'Goals without deadlines are just wishes' },
    { title: 'Tell someone about it', description: 'Public commitment increases follow-through significantly' },
  ],
};

/** Get template sub-goals for a domain. Falls back to Personal Goals templates. */
function getTemplateSubgoals(domain: string): Array<{ title: string; description: string }> {
  return DOMAIN_SUBGOAL_TEMPLATES[domain] ?? DOMAIN_SUBGOAL_TEMPLATES['Personal Goals'];
}

interface SuggestedBet {
  goalNodeId: string;
  goalName: string;
  currentProgress: number; // 0-100
  suggestedStake: number;
  reason: string;
}

interface SuggestedSubgoals {
  targetGoalId: string;
  targetGoalName: string;
  suggestions: Array<{ title: string; description: string }>;
}

interface SuggestedProgression {
  completedGoalName: string;
  completedGoalDomain: string;
  suggestion: string;
}

/** Build bet suggestions from goal nodes. Returns up to 2. */
function buildBetSuggestions(
  nodes: any[],
  activeBetGoalIds: Set<string>,
  activeBetCount: number,
  userBalance: number,
): SuggestedBet[] {
  // Guard: skip if balance too low or already at bet cap
  if (userBalance < 10 || activeBetCount >= 3) return [];

  const stake = Math.min(50, Math.floor(userBalance * 0.1));
  if (stake < 1) return [];

  const candidates = nodes
    .filter((n: any) => !n.parentId && (n.progress ?? 0) < 0.3 && !activeBetGoalIds.has(n.id))
    .slice(0, 2);

  return candidates.map((n: any) => {
    const name = n.name || n.title || 'Goal';
    const pct = Math.round((n.progress ?? 0) * 100);
    return {
      goalNodeId: n.id,
      goalName: name,
      currentProgress: pct,
      suggestedStake: stake,
      reason: `You're at ${pct}% on ${name}. A stake creates real accountability.`,
    };
  });
}

/** Find earliest root goal that could use sub-goals. Returns null if none qualify. */
function buildSubgoalSuggestion(nodes: any[], useLLM: boolean): SuggestedSubgoals | null {
  const earliestRoot = nodes.find((n: any) => !n.parentId);
  if (!earliestRoot) return null;

  // Count existing children
  const childCount = nodes.filter((n: any) => n.parentId === earliestRoot.id).length;
  if (childCount >= 3) return null;

  const goalName = earliestRoot.name || earliestRoot.title || 'Goal';
  const domain = earliestRoot.domain || 'Personal Goals';

  // Template mode: use domain templates (LLM mode fills in later via post-assembly)
  const suggestions = useLLM ? [] : getTemplateSubgoals(domain).slice(0, 3 - childCount);

  return {
    targetGoalId: earliestRoot.id,
    targetGoalName: goalName,
    suggestions,
  };
}

/** Find oldest completed root goal and suggest progression. */
function buildProgressionSuggestion(nodes: any[]): SuggestedProgression | null {
  const completedRoot = nodes.find(
    (n: any) => !n.parentId && ((n.progress ?? 0) >= 1.0 || n.status === 'completed'),
  );
  if (!completedRoot) return null;

  const goalName = completedRoot.name || completedRoot.title || 'Goal';
  const domain = completedRoot.domain || 'Personal Goals';

  return {
    completedGoalName: goalName,
    completedGoalDomain: domain,
    suggestion: `You mastered "${goalName}". Next level: raise the bar, explore an adjacent skill, or mentor someone in this domain.`,
  };
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/services/AxiomScanService.ts
git commit -m "feat: add domain sub-goal templates + bet/progression builders"
```

---

### Task 4: Rewrite `generateDailyBrief` with optimized pipeline

**Files:**
- Modify: `src/services/AxiomScanService.ts:169-278` (the `generateDailyBrief` method)

- [ ] **Step 1: Replace the `generateDailyBrief` method**

Replace the entire method body (from line 169 `public static async generateDailyBrief` through line 278 `}`) with:

```ts
  /**
   * Generate daily brief for a user.
   * @param useLLM - If true, use real LLM. If false, use template-based response.
   */
  public static async generateDailyBrief(userId: string, userName: string, userCity: string, useLLM: boolean = false) {
    const today = new Date().toISOString().slice(0, 10);

    // --- Phase 1: Gather all data in parallel ---
    const [
      todaySnapshot, yesterdaySnapshot,
      goalTreeRes, matchRes, eventsRes, placesRes,
      activeBetsRes, profileRes,
    ] = await Promise.all([
      buildSnapshot(userId),
      loadYesterdaySnapshot(userId),
      supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 1 }),
      supabase.from('events').select('id, title, event_date, city').gte('event_date', today).limit(10),
      supabase.from('places').select('id, name, city, tags').limit(10),
      supabase.from('bets').select('goal_node_id').eq('user_id', userId).eq('status', 'active'),
      supabase.from('profiles').select('praxis_points').eq('id', userId).single(),
    ]);

    const nodes: any[] = goalTreeRes.data?.nodes ?? [];
    const userDomains = extractUserDomains(nodes);
    const userBalance: number = profileRes.data?.praxis_points ?? 0;

    // --- Phase 2: Pre-compute picks (zero tokens to LLM) ---
    const topMatch: PickedMatch | null = matchRes.data?.[0]
      ? { id: matchRes.data[0].id, name: matchRes.data[0].name }
      : null;
    const topEvent = pickBestEvent(eventsRes.data ?? [], userCity);
    const topPlace = pickBestPlace(placesRes.data ?? [], userCity, userDomains);

    // --- Phase 3: Build new suggestion sections ---
    const activeBetGoalIds = new Set<string>(
      (activeBetsRes.data ?? []).map((b: any) => b.goal_node_id).filter(Boolean),
    );
    const activeBetCount = activeBetGoalIds.size;

    const suggestedBets = buildBetSuggestions(nodes, activeBetGoalIds, activeBetCount, userBalance);
    const suggestedSubgoals = buildSubgoalSuggestion(nodes, useLLM);
    const suggestedProgression = buildProgressionSuggestion(nodes);

    // --- Phase 4: Build diff context (compressed) ---
    let diffContext: string;
    if (yesterdaySnapshot) {
      diffContext = `Y:${yesterdaySnapshot}|N:${todaySnapshot}`;
    } else {
      diffContext = todaySnapshot;
    }

    // --- Phase 5: Generate brief ---
    let recommendations: any;

    if (!useLLM) {
      // Template-based brief (Minimal AI Mode / free tier)
      recommendations = {
        message: `Good morning, ${userName}. Today's focus: build momentum in your key goals.`,
        match: topMatch ? { id: topMatch.id, name: topMatch.name, reason: 'Aligned goals in your active domains' } : null,
        event: topEvent ? { id: topEvent.id, title: topEvent.title, reason: 'Coming up soon — worth checking out' } : null,
        place: topPlace ? { id: topPlace.id, name: topPlace.name, reason: 'Potential spot for focus or reflection' } : null,
        challenge: { type: 'bet' as const, target: 'Complete one key action today', terms: 'Log it in your tracker' },
        resources: [],
        routine: [
          { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
          { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
        ],
        suggestedBets: suggestedBets.length > 0 ? suggestedBets : undefined,
        suggestedSubgoals: suggestedSubgoals,
        suggestedProgression: suggestedProgression,
      };
    } else {
      // Premium LLM-generated brief — compact prompt (~350 tokens input)
      const matchLine = topMatch ? topMatch.name : 'none';
      const eventLine = topEvent ? `${topEvent.title} (${topEvent.date})` : 'none';
      const placeLine = topPlace ? topPlace.name : 'none';

      const betTargets = suggestedBets.length > 0
        ? suggestedBets.map(b => `${b.goalName} ${b.currentProgress}%`).join(', ')
        : 'none';

      const earliestGoal = suggestedSubgoals
        ? `${suggestedSubgoals.targetGoalName} (${nodes.find((n: any) => n.id === suggestedSubgoals.targetGoalId)?.domain || 'General'}, ${Math.round((nodes.find((n: any) => n.id === suggestedSubgoals.targetGoalId)?.progress ?? 0) * 100)}%, ${nodes.filter((n: any) => n.parentId === suggestedSubgoals.targetGoalId).length} sub-goals)`
        : 'none';

      const completedGoal = suggestedProgression
        ? `${suggestedProgression.completedGoalName} (${suggestedProgression.completedGoalDomain})`
        : 'none';

      const prompt = `Axiom brief for ${userName} (${userCity}).
State: ${todaySnapshot}
Delta: ${diffContext}
Match: ${matchLine} | Event: ${eventLine} | Place: ${placeLine}
Bet targets: ${betTargets}
Earliest goal: ${earliestGoal}
Completed goal: ${completedGoal}

Any field marked "none" = return "" for that reason. JSON only:
{"message":"1-2 sentence motivating morning message","matchReason":"","eventReason":"","placeReason":"","betReasons":["why stake on each bet target"],"subgoals":[{"title":"concrete sub-goal","desc":"why"}],"progression":"what to do next after completed goal","routine":[{"time":"Morning/Afternoon/Evening","task":"action","why":"alignment"}]}`;

      try {
        const responseText = await aiCoachingService['runWithFallback'](prompt);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const llmOutput = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

        // Post-LLM assembly: merge pre-computed data with LLM-generated reasons
        recommendations = {
          message: llmOutput.message || `Focus on showing up today, ${userName}.`,
          match: topMatch ? { id: topMatch.id, name: topMatch.name, reason: llmOutput.matchReason || '' } : null,
          event: topEvent ? { id: topEvent.id, title: topEvent.title, reason: llmOutput.eventReason || '' } : null,
          place: topPlace ? { id: topPlace.id, name: topPlace.name, reason: llmOutput.placeReason || '' } : null,
          challenge: { type: 'bet' as const, target: 'Complete one key action today', terms: 'Log it in your tracker' },
          resources: [],
          routine: Array.isArray(llmOutput.routine) ? llmOutput.routine : [
            { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
            { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
          ],
          // Merge LLM reasons into pre-computed bet suggestions
          suggestedBets: suggestedBets.length > 0
            ? suggestedBets.map((bet, i) => ({
                ...bet,
                reason: (Array.isArray(llmOutput.betReasons) && llmOutput.betReasons[i]) || bet.reason,
              }))
            : undefined,
          // Merge LLM sub-goals into pre-computed structure
          suggestedSubgoals: suggestedSubgoals
            ? {
                ...suggestedSubgoals,
                suggestions: Array.isArray(llmOutput.subgoals) && llmOutput.subgoals.length > 0
                  ? llmOutput.subgoals.slice(0, 3).map((s: any) => ({ title: s.title || '', description: s.desc || s.description || '' }))
                  : getTemplateSubgoals(nodes.find((n: any) => n.id === suggestedSubgoals.targetGoalId)?.domain || 'Personal Goals'),
              }
            : null,
          // Merge LLM progression
          suggestedProgression: suggestedProgression
            ? {
                ...suggestedProgression,
                suggestion: llmOutput.progression || suggestedProgression.suggestion,
              }
            : null,
        };
      } catch (err: any) {
        logger.warn(`[AxiomScan] LLM failed for ${userName}, falling back to template: ${err.message}`);
        // Fallback to template on LLM failure
        recommendations = {
          message: `Good morning, ${userName}. Today's focus: build momentum in your key goals.`,
          match: topMatch ? { id: topMatch.id, name: topMatch.name, reason: 'Aligned goals in your active domains' } : null,
          event: topEvent ? { id: topEvent.id, title: topEvent.title, reason: 'Coming up soon — worth checking out' } : null,
          place: topPlace ? { id: topPlace.id, name: topPlace.name, reason: 'Potential spot for focus or reflection' } : null,
          challenge: { type: 'bet' as const, target: 'Complete one key action today', terms: 'Log it in your tracker' },
          resources: [],
          routine: [
            { time: 'Morning', task: 'Review your top goal', alignment: 'Sets intention' },
            { time: 'Evening', task: 'Quick check-in', alignment: 'Tracks progress' },
          ],
          suggestedBets: suggestedBets.length > 0 ? suggestedBets : undefined,
          suggestedSubgoals: suggestedSubgoals,
          suggestedProgression: suggestedProgression,
        };
      }
    }

    // Insert a new row per day (history preserved)
    await supabase.from('axiom_daily_briefs').upsert({
      user_id: userId,
      date: today,
      brief: recommendations,
      generated_at: new Date().toISOString(),
    });

    // Save today's snapshot for tomorrow's diff
    await saveSnapshot(userId, todaySnapshot);
  }
```

Note: The old `coaching_briefs` mirror write is removed — the new brief format uses `message` instead of `motivation`/`strategy`, so the mirror condition was always false.

- [ ] **Step 2: Verify backend compiles**

Run: `cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/services/AxiomScanService.ts
git commit -m "feat: rewrite generateDailyBrief with optimized pipeline + 3 new sections"
```

---

## Chunk 2: Backend — Fix useLLM gating (both cron + on-demand)

### Task 5a: Fix `runGlobalScan` to gate useLLM on premium status

**Files:**
- Modify: `src/services/AxiomScanService.ts:151-153`

- [ ] **Step 1: Fix the useLLM flag in runGlobalScan**

Replace line 153 (inside `runGlobalScan`):

Old:
```ts
          await this.generateDailyBrief(user.id, user.name, user.city || 'Unknown', !user.minimal_ai_mode);
```

New:
```ts
          const useLLM = (user.is_premium || user.is_admin) && !user.minimal_ai_mode;
          await this.generateDailyBrief(user.id, user.name, user.city || 'Unknown', useLLM);
```

This prevents the cron job from burning LLM tokens on free users who haven't toggled `minimal_ai_mode`. Currently `!user.minimal_ai_mode` evaluates to `true` for any user who hasn't explicitly turned on minimal mode, regardless of subscription tier.

- [ ] **Step 2: Commit**

```bash
git add src/services/AxiomScanService.ts
git commit -m "fix: gate useLLM on premium status in runGlobalScan cron"
```

---

### Task 5b: Fix `generateAxiomBrief` to pass `useLLM` flag

**Files:**
- Modify: `src/controllers/aiCoachingController.ts:502-538`

- [ ] **Step 1: Update `generateAxiomBrief` to fetch and pass `minimal_ai_mode`**

Replace lines 517-528 (the profile fetch and generation call):

```ts
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, city, minimal_ai_mode, is_premium, is_admin')
    .eq('id', userId)
    .single();

  const useLLM = (profile?.is_premium || profile?.is_admin) && !profile?.minimal_ai_mode;

  await AxiomScanService.generateDailyBrief(
    userId,
    profile?.name ?? 'User',
    profile?.city ?? 'Unknown',
    useLLM,
  );
```

This replaces the old version that only fetched `name, city` and never passed `useLLM`.

- [ ] **Step 2: Verify backend compiles**

Run: `cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/controllers/aiCoachingController.ts
git commit -m "fix: pass useLLM flag in on-demand Axiom brief generation"
```

---

## Chunk 3: Frontend — UI for 3 new brief sections

### Task 6: Update `DailyProtocol` interface and add UI sections

**Files:**
- Modify: `client/src/features/dashboard/components/AxiomMorningBrief.tsx`

- [ ] **Step 1: Add new fields to the `DailyProtocol` interface**

After the existing `routine` field (line 52), add:

```ts
  suggestedBets?: Array<{
    goalNodeId: string;
    goalName: string;
    currentProgress: number;
    suggestedStake: number;
    reason: string;
  }>;
  suggestedSubgoals?: {
    targetGoalId: string;
    targetGoalName: string;
    suggestions: Array<{ title: string; description: string }>;
  } | null;
  suggestedProgression?: {
    completedGoalName: string;
    completedGoalDomain: string;
    suggestion: string;
  } | null;
```

- [ ] **Step 2: Add the CasinoIcon and TrendingUpIcon imports**

Add to the existing icon imports (after line 30):

```ts
import CasinoIcon from '@mui/icons-material/Casino';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
```

- [ ] **Step 3: Add Suggested Bets UI section**

After the challenge section closing `</Box>` (around line 453), before the closing `</Box>` of the main card's `p: { xs: 3, sm: 4 }` wrapper, add:

```tsx
          {/* Suggested Bets */}
          {data?.suggestedBets && data.suggestedBets.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="overline" sx={{ color: '#F59E0B', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.1em', px: 0.5 }}>
                AXIOM SUGGESTS: STAKE YOUR GOALS
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {data.suggestedBets.map((bet, idx) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                    <Box
                      sx={{
                        p: 2.5, borderRadius: '20px',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(249,115,22,0.03))',
                        border: '1px solid rgba(245,158,11,0.15)',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{bet.goalName}</Typography>
                        <Chip
                          icon={<CasinoIcon sx={{ fontSize: '14px !important' }} />}
                          label={`${bet.suggestedStake} PP`}
                          size="small"
                          sx={{ height: 22, fontSize: '0.65rem', fontWeight: 800, bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)' }}
                        />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={bet.currentProgress}
                        sx={{ height: 6, borderRadius: 3, mb: 1, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#F59E0B' } }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, lineHeight: 1.4 }}>
                        {bet.reason}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate(`/betting?goal=${bet.goalNodeId}&stake=${bet.suggestedStake}&name=${encodeURIComponent(bet.goalName)}`)}
                        sx={{
                          borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800,
                          borderColor: '#F59E0B', color: '#F59E0B',
                          '&:hover': { bgcolor: 'rgba(245,158,11,0.08)', borderColor: '#F59E0B' },
                        }}
                      >
                        Place Bet
                      </Button>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Sub-goal Suggestions */}
          {data?.suggestedSubgoals && data.suggestedSubgoals.suggestions.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="overline" sx={{ color: '#8B5CF6', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.1em', px: 0.5 }}>
                GROW: {data.suggestedSubgoals.targetGoalName.toUpperCase()}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                {data.suggestedSubgoals.suggestions.map((sg, idx) => (
                  <Chip
                    key={idx}
                    icon={<AddCircleOutlineIcon sx={{ fontSize: '16px !important', color: '#8B5CF6 !important' }} />}
                    label={sg.title}
                    variant="outlined"
                    onClick={() => navigate(`/goals?addSubgoal=${data.suggestedSubgoals!.targetGoalId}&title=${encodeURIComponent(sg.title)}&desc=${encodeURIComponent(sg.description)}`)}
                    sx={{
                      borderColor: 'rgba(139,92,246,0.3)', color: 'text.primary',
                      fontSize: '0.75rem', fontWeight: 600, height: 36,
                      bgcolor: 'rgba(139,92,246,0.05)',
                      '&:hover': { bgcolor: 'rgba(139,92,246,0.12)', borderColor: '#8B5CF6' },
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Next Level — Progression */}
          {data?.suggestedProgression && (
            <Box
              sx={{
                mt: 4, p: 2.5, borderRadius: '20px',
                background: 'linear-gradient(90deg, rgba(16,185,129,0.08), transparent)',
                border: '1px solid rgba(16,185,129,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexDirection: { xs: 'column', sm: 'row' }, gap: 2,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <TrendingUpIcon sx={{ color: '#10B981', fontSize: 20 }} />
                  <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 900, letterSpacing: '0.05em' }}>
                    NEXT LEVEL
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5 }}>
                  {data.suggestedProgression.suggestion}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/goals')}
                sx={{
                  borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800, px: 3,
                  borderColor: '#10B981', color: '#10B981', flexShrink: 0,
                  '&:hover': { bgcolor: 'rgba(16,185,129,0.08)', borderColor: '#10B981' },
                }}
              >
                Create Goal
              </Button>
            </Box>
          )}
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add client/src/features/dashboard/components/AxiomMorningBrief.tsx
git commit -m "feat: add Suggested Bets, Sub-goals, and Next Level sections to Axiom brief UI"
```

---

## Chunk 4: Final verification

### Task 7: Full compile check + manual test plan

- [ ] **Step 1: Full backend compile**

Run: `cd /home/gio/Praxis/praxis_webapp && npx tsc --noEmit --skipLibCheck 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 2: Full frontend compile**

Run: `cd /home/gio/Praxis/praxis_webapp/client && npx tsc --noEmit --skipLibCheck 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 3: Manual test checklist**

To verify after deployment:
1. Dashboard loads → Axiom brief appears with existing fields (match, event, place, routine)
2. If user has low-progress goals (<30%) and balance >= 10 PP → "STAKE YOUR GOALS" section appears with bet cards
3. If user has an earliest root goal with < 3 sub-goals → "GROW:" section appears with sub-goal chips
4. If user has a completed root goal → "NEXT LEVEL" section appears with progression suggestion
5. Clicking "Place Bet" navigates to `/betting` with query params pre-filled
6. Clicking sub-goal chips navigates to `/goals` with query params
7. Template mode (free tier): all sections use static text, no LLM call
8. Premium mode: LLM generates personalized reasons, sub-goals, and progression text

- [ ] **Step 4: Final commit with all changes**

If any fixes were needed during verification:
```bash
git add -A
git commit -m "fix: address compile issues from Axiom brief optimization"
```
