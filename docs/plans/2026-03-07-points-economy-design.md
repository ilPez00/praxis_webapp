# Points Economy Rework — Design Document

**Date:** 2026-03-07
**Status:** Approved

---

## Goal

Rework the Praxis Points (PP) economy so that PP acts as a **gate + incentive hybrid** (unlock actions, reward real behaviour) that circulates daily. Replace the flat like system with Reddit-style post karma. Make Honor a weighted, decaying reputation signal. Introduce Event QR check-in. Gate goal tree edits and service postings behind PP costs. Rework Reliability to include karma.

---

## Section 1 — Points Economy (earn / spend)

### Earning PP

| Action | PP |
|---|---|
| Daily check-in (base) | +20 |
| Check-in streak bonus ×2 at 7d / ×3 at 30d | multiplier on base |
| Goal node peer-verified complete | +100 × node_weight |
| Event QR check-in | +50 |
| Post receives upvote | +3 (credited to author) |
| Post receives downvote | −1 (debited from author) |
| Give honor | +5 (to giver) |
| Referral claimed | +100 (both parties, existing) |

### Spending / Gating PP

| Action | Cost |
|---|---|
| Edit a goal node (name/desc/domain/dates) | −25 PP |
| Create a new goal node | −25 PP |
| Post a service listing | −30 PP |
| Boost visibility (24h) | −150 PP |
| AI coaching session | −500 PP |
| Super match | −300 PP |
| Extra goal slot | −200 PP |

### Onboarding Grant

New users start with **200 PP** (written at profile creation). This covers 8 node edits or 6 service posts before they need to earn more.

---

## Section 2 — Reddit-style Post Karma

### Voting

- Each post has upvote (▲) / downvote (▼) controls.
- Net score = upvotes − downvotes, displayed between buttons.
- One vote per user per post; clicking the active direction removes it; clicking the opposite flips it.
- Posts with net score < −5 are rendered at 50% opacity (not hidden).

### PP flow on vote

- Author receives **+3 PP** per upvote and **−1 PP** per downvote, applied in real time.
- Voter receives no PP for voting (prevents vote farming).

### Karma score

- Each user has a `karma_score` column on `profiles` = sum of all their posts' net scores.
- Updated incrementally on every vote (fire-and-forget `+3` / `−1` / flip adjustments).
- Displayed on profile alongside honor score.

### DB changes

- New table: `post_votes (id, post_id, user_id, value SMALLINT CHECK (value IN (1,-1)), created_at)`
- Drop / ignore: `post_likes` table (legacy).
- Add column: `profiles.karma_score INTEGER DEFAULT 0`.

---

## Section 3 — Honor System Rework

### Giving honor

- Costs **10 PP** to give (deducted immediately); giver receives **+5 PP** back (net −5 for giver).
- Honored user receives **+20 PP** on receipt.
- Revoke: giver recovers 10 PP; recipient loses 20 PP.
- Still one-per-user-per-target.

### Honor score — weighted + decaying float

- `honor_score` is a FLOAT computed on-demand (profile fetch or explicit recompute).
- Each honor vote contributes `giver.reliability_score` (0.0–1.0) to the recipient's score.
- Age weighting:
  - 0–60 days: full weight (×1.0)
  - 61–120 days: half weight (×0.5)
  - >120 days: zero weight (excluded from sum)
- Formula: `honor_score = SUM(giver_reliability * age_weight) for active votes`
- Stored back to `profiles.honor_score FLOAT` after compute.

### Posts are honorable

- Any post can receive upvotes/downvotes (§2). Honor votes remain user-to-user only.
- Feed ranking uses `honor_score + log(1 + max(karma_score, 0))` as combined rep signal.

---

## Section 4 — Event QR Check-in + Auto-Group

### Event creation

- On `POST /events`, backend atomically:
  1. Inserts the event row.
  2. Creates a linked `chat_rooms` row (`type: 'event'`, `event_id FK`).
- Event detail page shows "Join Group" → navigates to the linked group chat/board.

### QR check-in flow

- Organizer sees "Check-in QR" button on their event (only shown if `event.creator_id === currentUser.id`).
- Backend `GET /events/:id/checkin-token` returns a signed token: `HMAC-SHA256(event_id + expiry, APP_SECRET)` valid for 24h after event start.
- Frontend renders a full-screen QR code encoding the URL: `<app-origin>/events/:id/checkin?token=<token>`.
- Attendee scans → app opens → `POST /events/:id/checkin` with token in body.
- Server: verifies HMAC + expiry, checks `event_attendees` for duplicate, inserts row, awards +50 PP.
- Returns `{ success, alreadyCheckedIn, newBalance }`.

### DB changes

- New table: `event_attendees (id, event_id, user_id, checked_in_at)`
- `chat_rooms`: add `event_id UUID REFERENCES events(id) NULLABLE`.

---

## Section 5 — Goal Tree Per-Node Edit Gating

### New endpoints

| Method | Path | Cost | Description |
|---|---|---|---|
| POST | `/goals/:userId/node` | −25 PP | Create a single new node |
| PATCH | `/goals/:userId/node/:nodeId` | −25 PP | Edit node fields (name/desc/domain/dates/metric) |
| DELETE | `/goals/:userId/node/:nodeId` | free | Remove a node |
| PATCH | `/goals/:userId/node/:nodeId/progress` | free | Progress update (existing, keep free) |

### Bulk endpoint restriction

- `PUT /goals/:userId` (full tree save) is **only permitted when `goal_tree_edit_count === 0`** (first-time creation / onboarding). Returns 403 afterwards.
- `goal_tree_edit_count` is incremented on each per-node create/edit.

### Frontend changes

- GoalTreePage: remove bulk "Save" button after onboarding.
- Each node edit popover: "Save (−25 PP)" button with current balance shown.
- Insufficient balance: toast error "Not enough PP — earn more by checking in or completing goals."

---

## Section 6 — Reliability Score Rework

### Updated formula

```
R = 0.50*C + 0.25*V + 0.10*S + 0.15*K
```

| Component | Description |
|---|---|
| C | Check-in consistency: checkins last 30d / 30 |
| V | Verified completion rate: approved / total completion_requests last 90d |
| S | Streak stability: min(streak, 30) / 30 |
| K | Karma signal: tanh(karma_score / 50), bounded (−1, 1) |

- `tanh` bounds K between −1 and 1. Negative karma reduces reliability. A karma of 50 gives K ≈ 0.76.
- Recomputed on every check-in (existing trigger), reads `karma_score` from profile.
- Max reliability boost from karma: +0.15; max penalty: −0.15.

---

## DB Migration Summary

```sql
-- Post votes (replaces post_likes)
CREATE TABLE IF NOT EXISTS post_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Karma score on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS karma_score INTEGER DEFAULT 0;

-- Event attendees
CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Link chat_rooms to events
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- Onboarding grant (run for existing users with 0 points)
-- UPDATE profiles SET praxis_points = 200 WHERE praxis_points = 0 AND onboarding_completed = true;
-- For new users: set praxis_points = 200 at profile creation.

-- honor_score as float
ALTER TABLE profiles ALTER COLUMN honor_score TYPE FLOAT USING honor_score::FLOAT;
```

---

## Implementation Order

1. DB migration (SQL above)
2. `post_votes` table + karma increment/decrement on vote (backend + frontend vote UI)
3. Honor: cost to give, decay compute, `honor_score` as float
4. Reliability formula update (add K component)
5. Per-node goal edit endpoints + PP gating
6. Bulk PUT restriction post-onboarding
7. Services posting cost (−30 PP gate)
8. Event QR check-in flow (token generation + scan endpoint)
9. Event → auto-group creation on event create
10. Onboarding grant (+200 PP at profile creation)
11. Feed ranking: update combined rep signal
