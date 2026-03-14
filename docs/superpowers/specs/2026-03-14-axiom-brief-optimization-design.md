# Axiom Daily Brief Optimization + Agent Suggestions

**Date:** 2026-03-14
**Status:** Reviewed

## Data Model Notes

- **Progress scale**: DB stores progress as `0.0–1.0`. All output/display values must be multiplied by 100. Filter thresholds use the raw scale (e.g., `< 0.3` means < 30%).
- **Goal node naming**: Nodes may have `name` or `title`. Always use `n.name || n.title || 'Goal'` fallback pattern.
- **"Earliest" goal heuristic**: Use array index order (nodes are appended to JSONB array chronologically). No `created_at` field exists on nodes.

## Problem

The daily brief pipeline is token-wasteful and the brief content lacks actionable suggestions. Specifically:

1. **Token bloat**: Raw `JSON.stringify()` dumps of matches (5 users), events (10), and places (10) are sent directly in the LLM prompt — easily 2-3K input tokens of noise.
2. **LLM does work that code should do**: The prompt asks Gemini to "choose the best fit" from lists. This is a scoring/ranking problem, not a language problem.
3. **Missing agent-like suggestions**: Axiom doesn't suggest bets, sub-goals, or next-step progressions — the three most actionable things a coach should recommend.

## Solution

Three layers: pre-compute picks server-side, add 3 new brief sections, optimize the full pipeline.

---

## Layer 1: Pre-compute Picks Server-Side

### Current flow (wasteful)
```
DB → raw JSON arrays → LLM prompt (2K+ tokens) → LLM picks best → structured output
```

### New flow (optimized)
```
DB → server-side scoring → single best pick per category → LLM writes reason string only (~50 tokens each)
```

### Scoring logic (in `AxiomScanService.ts`)

**Match pick**: Use existing `match_users_by_goals` RPC (already scores by goal overlap). Take `[0]` — the top match. The RPC returns `{id, name, ...}`. Domains are not included in the RPC result — fetch the matched user's root goal domains separately from `goal_trees` if needed, or just send `{id, name}` without domains (the LLM doesn't need them to write a reason).

**Event pick**: Score by: (a) same city as user (+3), (b) soonest date (+2). No domain column exists on `events` — skip domain overlap. Take top 1. Send only `{id, title, date}`.

**Place pick**: Score by: (a) same city (+3), (b) freeform `tags` column — do case-insensitive substring match against user's goal domain names (e.g., tag "fitness center" matches domain "FITNESS"). +1 per match. Take top 1. Send only `{id, name}`.

### Token savings
- Before: ~2000 tokens of raw JSON arrays
- After: ~60 tokens of pre-picked summaries
- **Savings: ~1900 tokens per brief (95% reduction in context data)**

---

## Layer 2: Three New Brief Sections

### 2a. Suggested Bets (`suggestedBets`)

**Strategy**: Aggressive — suggest bets on the user's lowest-progress goals (< 30%) to push accountability.

**Data fetch** (server-side, in `AxiomScanService.generateDailyBrief`):
```sql
-- Goals with lowest progress, no active bet on them
SELECT nodes FROM goal_trees WHERE user_id = $1
-- Filter in code: root goals with progress < 0.3, not already in active bets
SELECT goal_node_id FROM bets WHERE user_id = $1 AND status = 'active'
```

**Output shape** (added to brief JSON):
```ts
suggestedBets: Array<{
  goalNodeId: string;
  goalName: string;
  currentProgress: number;  // 0-100
  suggestedStake: number;   // PP amount
  reason: string;           // template or LLM-generated
}>
```

**Stake calculation**: `Math.min(50, Math.floor(userBalance * 0.1))` — conservative 10% of balance, capped at 50 PP. **Skip bet suggestions entirely if balance < 10 PP or user already has 3 active bets** (the betting controller cap).

**Template reason** (free tier): `"You're at {progress}% on {goalName}. A stake creates real accountability."` (progress is converted to 0-100 scale for display).

**LLM reason** (premium): Generated as part of the brief prompt (~20 extra tokens).

**Limit**: Max 2 suggested bets per brief.

### 2b. Suggested Sub-goals (`suggestedSubgoals`)

**Target**: The earliest-created root goal (first in the JSONB `nodes` array, since nodes are appended chronologically).

**Logic**:
1. Find earliest root node (first node where `!parentId`)
2. Count existing children — if already has 3+ sub-goals, skip
3. Suggest 2-3 sub-goals

**Template sub-goals** (free tier, by domain):
```ts
const DOMAIN_SUBGOAL_TEMPLATES: Record<string, string[]> = {
  FITNESS: ['Set a measurable weekly target', 'Find an accountability partner', 'Track daily with a habit log'],
  CAREER: ['Identify one skill gap to close this month', 'Schedule a mentor conversation', 'Build a portfolio piece'],
  ACADEMICS: ['Create a study schedule', 'Find study group or partner', 'Set a practice exam date'],
  // ... one set per domain
}
```

**LLM sub-goals** (premium/Axiom Boost only): Included in the brief prompt — asks for 2-3 concrete sub-goals based on the goal's `name`, `description`, and `completionMetric`. ~80 extra tokens.

**Output shape**:
```ts
suggestedSubgoals: {
  targetGoalId: string;
  targetGoalName: string;
  suggestions: Array<{ title: string; description: string }>;
} | null
```

### 2c. Suggested Progression (`suggestedProgression`)

**Target**: The oldest completed goal (first node in array where `progress >= 1.0` or `status === 'completed'`). Progress is stored 0.0-1.0, so check `>= 1.0` or `=== 'completed'`.

**Logic**:
1. Find first completed root node
2. Suggest "what's next" — a harder version or adjacent domain goal

**Template progression** (free tier):
```ts
// Pattern: "You completed X. Consider: [harder version], [adjacent skill], [teach it]"
`You mastered "${goalName}". Next level: raise the bar, explore an adjacent skill, or mentor someone in this domain.`
```

**LLM progression** (premium): ~30 extra tokens in prompt.

**Output shape**:
```ts
suggestedProgression: {
  completedGoalName: string;
  completedGoalDomain: string;
  suggestion: string;  // "what's next" recommendation
} | null
```

---

## Layer 3: Pipeline Optimization

### 3a. Compressed Snapshot Format

**Current** (verbose):
```
Goals: Learn Spanish 45%, Run Marathon 20%
Trackers logged today: 2/5
Posts today: 1
Check-ins today: 1
```

**New** (compact key-value):
```
G:Learn Spanish 45%,Run Marathon 20%|T:2/5|P:1|C:1
```

Saves ~40 tokens per snapshot, and snapshots appear twice in the prompt (yesterday + today).

### 3b. Optimized LLM Prompt

**Current prompt**: ~800 tokens input, asks LLM to do scoring + writing.

**New prompt**: ~350 tokens input, LLM only writes natural language. Structure:

```
Axiom brief for {userName} ({city}).
State: {compactSnapshot}
Delta: {compactDiff}
Match: {name} | Event: {title} ({date}) | Place: {name}
Bet targets: {goalName1} {progress1}%, {goalName2} {progress2}%
Earliest goal: {name} ({domain}, {progress}%, {childCount} sub-goals)
Completed goal: {name} ({domain})

(Any field above may be "none" — if so, return empty string for that reason field.)

JSON only:
{"message":"...","matchReason":"...","eventReason":"...","placeReason":"...","betReasons":["..."],"subgoals":[{"title":"...","desc":"..."}],"progression":"...","routine":[{"time":"...","task":"...","why":"..."}]}
```

The LLM now only generates ~300 tokens of natural language (reasons, message, routine). All IDs, names, and structured data are pre-filled server-side.

### 3c. Post-LLM Assembly

Server-side code assembles the final brief JSON by merging:
- Pre-computed picks (match/event/place with IDs)
- LLM-generated reasons and message
- Pre-computed bet/subgoal/progression data with LLM reasons (or template reasons)

### 3d. Model Selection

Keep the existing cascade but it should work much better now:
- `gemini-2.0-flash-lite` handles ~350-token prompts reliably
- The simpler prompt structure (fill-in-the-blanks JSON) reduces parse failures
- DeepSeek remains first priority when configured

### 3e. Template Mode Enhancements

Template mode (free tier / `minimal_ai_mode=true`) gets all 3 new sections with zero LLM calls:
- Bet suggestions with formulaic reasons
- Domain-based sub-goal templates
- Generic progression templates

---

## Layer 4: UI Updates (`AxiomMorningBrief.tsx`)

### New `DailyProtocol` interface additions
```ts
interface DailyProtocol {
  // ... existing fields ...
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
}
```

### New UI sections (added after the existing Quick Targets Grid)

1. **Suggested Bets** — amber/orange cards with goal name, progress bar, stake amount, "Place Bet" button (navigates to `/betting` with pre-filled params)

2. **Sub-goal Suggestions** — purple cards under "GROW: {goalName}" header, each suggestion as a chip/pill the user can tap to add to their goal tree (calls existing goal tree API)

3. **Next Level** — green card with completed goal name + progression suggestion + "Create Goal" CTA

All sections gracefully hidden when data is `null` or empty array.

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/AxiomScanService.ts` | Pre-compute picks, compressed snapshots, fetch bets/goals for suggestions, new prompt |
| `src/services/AICoachingService.ts` | No changes (runWithFallback stays the same) |
| `src/controllers/aiCoachingController.ts` | Fix `generateAxiomBrief` to pass `useLLM` flag (currently hardcoded to template mode) |
| `client/src/features/dashboard/components/AxiomMorningBrief.tsx` | Add 3 new UI sections, update DailyProtocol interface |

---

## Token Budget (per brief)

| Component | Before | After |
|-----------|--------|-------|
| Snapshot context | ~120 tokens | ~40 tokens |
| Match/event/place data | ~2000 tokens | ~60 tokens |
| Prompt instructions | ~200 tokens | ~150 tokens |
| New sections (bets/subgoals/progression) | 0 | ~50 tokens |
| **Total input** | **~2320** | **~300** |
| **Total output** | **~500** | **~300** |
| **Grand total** | **~2820** | **~600** |

**~78% token reduction per brief** (conservative estimate — actual "Before" is likely 4000+ tokens due to raw JSON dumps, making real savings closer to 85-90%). Output tokens for premium path may be ~400-500 rather than 300 due to the new fields.

---

## No New DB Tables

All data comes from existing tables: `goal_trees`, `bets`, `profiles`, `events`, `places`, `match_users_by_goals` RPC. No migrations needed.

## No New Endpoints

The daily brief format just gains 3 new optional fields. The existing `GET /ai-coaching/daily-brief` and `POST /ai-coaching/generate-axiom-brief` endpoints return the enriched brief unchanged.
