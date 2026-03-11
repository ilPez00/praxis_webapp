# Praxis — 90-Day Product Strategy
**Role:** Senior Product Strategist + Behavioral Psychologist + SaaS Growth Architect
**Date:** 2026-03-02
**Stack:** React/TS · Node/Express · Supabase · Stripe · Gemini

---

## Executive Summary

Praxis competes in the same psychological space as Instagram, Duolingo, and Strava — not in features, but in daily emotional relevance. The goal is not to build the most powerful productivity tool. The goal is to make users feel accountable, seen, and progressing — every single day. Revenue follows retention, not the other way around.

The 90-day plan has three phases:
1. **Month 1 — Hook the user** (engagement engine, streaks, check-ins)
2. **Month 2 — Monetize the loop** (Stripe tiers, feature gates, upsell triggers)
3. **Month 3 — Deepen the identity** (AI narrative, status system, analytics)

---

## PART 1 — ENGAGEMENT ENGINE

### The Hook Model Applied to Praxis

```
TRIGGER       → "Alex just checked in. You're 18 hours behind."
ACTION        → 1-click check-in (< 3 seconds)
VARIABLE REWARD → "Axiom: 'You've been more consistent than 78% this week.'"
INVESTMENT    → Streak grows. Partner bond strengthens. Progress data accumulates.
REPEAT        → Tomorrow's trigger fires because yesterday's data exists.
```

The key insight: **investment is the moat**. Once a user has a 30-day mutual streak, 90 days of check-in history, and an AI that knows their patterns — they cannot replicate that elsewhere. The data IS the product.

---

### 1.1 Social Streak System

#### Concept
Individual streaks (Duolingo) are fragile — they break when life happens and users quit. **Mutual streaks** introduce social stakes. If you break the streak, you break it for both people. That emotional weight is 5× more powerful.

#### Streak Rules
| State | Condition | UI |
|---|---|---|
| Active | Both users checked in within 24h of each other | 🔥 + count |
| At Risk | One user hasn't checked in, 18h elapsed | ⚠️ amber glow |
| Grace | One check-in missed, grace period active | 🕐 countdown |
| Broken | Grace expired | 💔 reset to 0 |
| Record | Current = personal best | ⭐ badge |

#### Grace Period Rules
- **Free tier:** 24h grace (1 forgiveness per 14 days)
- **Pro tier:** 48h grace (3 forgivenesses per 14 days)
- **Elite tier:** 72h grace (unlimited, with "streak shield" power-up)
- Grace is **not automatic** — user must tap "Use Grace Day" (makes it feel deliberate, not lazy)

#### Streak Decay Logic
- If streak broken: drops to 0 (no partial credit — loss aversion is the mechanic)
- Show "longest streak ever" alongside current streak (anchors aspiration)
- Partner receives notification when their streak is at risk due to **your** inactivity (creates mutual pressure)

#### Database Schema
```sql
-- Mutual streaks between two users
CREATE TABLE public.mutual_streaks (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak    INT DEFAULT 0,
  longest_streak    INT DEFAULT 0,
  last_mutual_date  DATE,
  grace_used_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

-- Individual check-in log
CREATE TABLE public.checkins (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id      UUID REFERENCES public.goal_trees(id) ON DELETE SET NULL,
  partner_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type         TEXT CHECK (type IN ('full', 'micro', 'nudge')),
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

#### Backend Endpoints
```
POST   /api/checkins                  — log a check-in (full or micro)
GET    /api/streaks/:userId           — get all mutual streaks for user
GET    /api/streaks/:userId/:partnerId — get specific mutual streak
POST   /api/streaks/:streakId/grace   — activate grace day
GET    /api/checkins/:userId/today    — check if user has checked in today
```

#### Frontend Components
- `<StreakCard>` — shows flame emoji, count, partner name, "at risk" warning
- `<GraceDayButton>` — one-tap grace activation with confirmation
- `<CheckInButton>` — 1-click, animates on tap (streak +1 feeling), handles micro vs full
- `<StreakHistory>` — calendar heatmap of mutual activity

---

### 1.2 Reliability Score

#### Algorithm
```
reliability_score = (
  (check_in_rate × 0.40) +        // % of days with a check-in (rolling 30d)
  (response_rate × 0.25) +         // % of partner messages replied to within 24h
  (goal_completion_rate × 0.25) +  // % of stated goals marked done
  (streak_consistency × 0.10)      // streak / (streak + breaks) ratio
) × 100
```

Score range: 0–100. Percentile is computed relative to all active users in the DB.

#### Anti-Gaming Safeguards
- Minimum 14 days of activity before score is displayed (prevents gaming with fresh accounts)
- Score updates once daily at midnight UTC (not real-time — prevents obsessive refresh)
- Micro-actions count as 0.3× the weight of full check-ins (can't farm with taps)
- Response rate only counts if partner has messaged you (can't inflate by messaging yourself)

#### Database Fields (add to `profiles`)
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reliability_score    FLOAT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reliability_percentile INT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_tier          TEXT DEFAULT 'Newcomer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_days          INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_checkins       INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_checkin_at      TIMESTAMPTZ;
```

#### Status Tiers
| Tier | Requirement | Badge Color |
|---|---|---|
| Newcomer | < 14 days | Gray |
| Committed | 14d active, score ≥ 40 | Blue |
| Disciplined | 30d active, score ≥ 60 | Purple |
| Elite | 60d active, score ≥ 75, top 25% | Gold |
| Relentless | 90d active, score ≥ 90, top 10% | Gradient flame |

Tier is displayed on profile, next to name in DMs, and on the match card. Status is aspirational — users self-identify with it.

#### Backend Endpoints
```
GET  /api/reliability/:userId          — score + percentile + tier
POST /api/reliability/recalculate      — cron job trigger (runs nightly)
```

---

### 1.3 AI Weekly Narrative

#### Concept
Every Monday morning, Axiom generates a personalized behavioral summary using Gemini. This is NOT a generic "you did X check-ins" email. It reads like a coach who has been watching you all week and has an opinion.

#### Examples
> *"This week you showed up 6 out of 7 days. The one miss was Wednesday — your pattern shows midweek dips. Let's talk about why Thursday always bounces back stronger."*

> *"You and Alex have maintained your streak for 23 days. That kind of social accountability is statistically associated with 3× higher goal completion. Don't break the chain."*

> *"You've moved from Committed to Disciplined this week. 67% of Disciplined users reach Elite within 45 days. You're on track."*

#### Generation Input (context injected into Gemini prompt)
- Last 7 days of check-ins (types, notes, times)
- Mutual streak status and trend
- Reliability score delta (this week vs last week)
- Goals with completion status
- Partner activity summary (anonymized)

#### Database Schema
```sql
CREATE TABLE public.weekly_narratives (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  content      TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  opened_at    TIMESTAMPTZ,
  UNIQUE(user_id, week_start)
);
```

#### Backend Endpoints
```
GET  /api/narratives/:userId/latest    — fetch latest narrative
POST /api/narratives/generate          — cron: generate for all active users (Sunday 11pm UTC)
POST /api/narratives/:userId/mark-read — record open (for open rate KPI)
```

#### Pro Gate
Weekly narrative is **Pro+ only**. Free users see a blurred preview with "Upgrade to unlock your weekly coaching brief."

---

### 1.4 Micro-Engagement Actions

The friction cost of each action must be < 3 seconds. Every extra tap kills conversion.

| Action | Gesture | Streak impact |
|---|---|---|
| Full check-in | Tap + optional note | Full count |
| Micro check-in | Single tap, no note | 0.3× weight |
| Partner nudge | Tap "poke" on partner card | 0 (but triggers partner notification) |
| React to update | Emoji reaction | 0 (social, not streak) |
| Grace day | Confirm dialog | Preserves streak |

Micro check-ins exist for "I did something today but can't write about it." They keep the streak alive during high-stress periods. Without them, users quit rather than break their streak.

---

### 1.5 Notification Architecture

#### Priority Matrix
| Trigger | Channel | Timing | Tone |
|---|---|---|---|
| Partner checked in | Push | Immediate | Informational |
| Streak at risk (18h) | Push + in-app | 18h after last checkin | Urgent |
| Streak broken | Push | On event | Compassionate |
| New match | Push | Immediate | Exciting |
| Weekly narrative ready | Push + Email | Monday 7am user local | Curious |
| Inactive 48h | Email | 48h after last action | Gentle |
| Inactive 7d | Email | 7d | Re-engagement |
| Reliability milestone | Push + in-app | On calculation | Celebratory |
| Partner unresponsive 48h | In-app only | 48h | Neutral |

#### Notification Database Schema
```sql
CREATE TABLE public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,  -- 'streak_risk', 'partner_checkin', 'narrative_ready', etc.
  payload    JSONB DEFAULT '{}',
  sent_at    TIMESTAMPTZ DEFAULT now(),
  read_at    TIMESTAMPTZ,
  channel    TEXT CHECK (channel IN ('push', 'email', 'in_app'))
);
```

#### Implementation Notes
- Use **Supabase Edge Functions** for scheduled cron triggers
- Push: FCM for Android (already in roadmap), Web Push API for browser
- Email: Resend (simple API, generous free tier) or Sendgrid
- All notifications respect a **quiet hours** setting (user-defined, default 10pm–8am)

---

## PART 2 — MONETIZATION ENGINE

### 2.1 Pricing Structure

```
FREE — $0/month
├── 3 active goals maximum
├── 5 AI matches per month
├── 3 Axiom sessions per month
├── Basic check-in logging
├── Individual streak tracking
└── 24h streak grace period (1× per 14 days)

PRO — $9.99/month (or $79.99/year → 33% savings)
├── Unlimited active goals
├── Unlimited AI matches
├── Unlimited Axiom sessions
├── Weekly AI narrative (Monday delivery)
├── Reliability score + percentile display
├── Mutual streak system with partner
├── 48h grace period (3× per 14 days)
├── Advanced progress analytics
└── Priority email support

ELITE — $24.99/month (or $199.99/year → 33% savings)
├── Everything in Pro
├── Priority match algorithm (matched first in queue)
├── Private accountability rooms (up to 5 members)
├── Streak Shield (72h grace, unlimited uses)
├── Advanced AI coaching (daily check-ins with Axiom)
├── Downloadable progress reports (PDF/CSV)
├── Reliability score API access (for journaling apps etc.)
└── Early access to new features
```

**Positioning logic:**
- Free → Pro: the moment users feel the product working (streaks, matches)
- Pro → Elite: when they want to protect what they've built (streak shields, priority)

---

### 2.2 Stripe Configuration

#### Products to Create in Stripe Dashboard
```
Product: Praxis Pro
  Price 1: $9.99/month  → recurring, monthly  (price_pro_monthly)
  Price 2: $79.99/year  → recurring, yearly   (price_pro_yearly)

Product: Praxis Elite
  Price 1: $24.99/month → recurring, monthly  (price_elite_monthly)
  Price 2: $199.99/year → recurring, yearly   (price_elite_yearly)
```

#### Webhook Events to Handle
```
checkout.session.completed        → activate subscription in DB
customer.subscription.updated     → update tier (upgrades/downgrades)
customer.subscription.deleted     → downgrade to free, preserve data
invoice.payment_failed            → send dunning email, grace 7d
invoice.payment_succeeded         → confirm active status
customer.subscription.trial_ending → remind before trial ends
```

#### DB Schema (subscription state)
```sql
-- Extend user_subscriptions table (already exists)
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS tier         TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'elite')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end   BOOLEAN DEFAULT false;
```

---

### 2.3 Feature Gating Middleware

Single source of truth. One middleware function, used on every gated route:

```typescript
// src/middleware/requireTier.ts
export function requireTier(minTier: 'pro' | 'elite') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    const sub = await getSubscription(userId); // cached in Redis or Supabase
    const tierRank = { free: 0, pro: 1, elite: 2 };
    if (tierRank[sub.tier] >= tierRank[minTier]) return next();
    return res.status(403).json({
      error: 'upgrade_required',
      requiredTier: minTier,
      currentTier: sub.tier,
      upgradeUrl: '/pricing',
    });
  };
}

// Usage on routes:
router.get('/narratives/:userId/latest', requireTier('pro'), narrativeController.getLatest);
router.post('/rooms', requireTier('elite'), roomController.create);
```

Frontend catches `error: 'upgrade_required'` and renders the upgrade modal inline. No separate upgrade page needed — the upsell happens exactly at the moment of desire.

---

### 2.4 Psychological Upsell Triggers

These are the 6 moments when a user is most likely to convert:

| Trigger | Message | CTA |
|---|---|---|
| Hit match limit (5/month) | "You've met your 5 match limit. 3 users matched your profile today." | "Unlock unlimited matches" |
| Streak broken | "Streak broken. Elite members get Streak Shield — 72h protection." | "Protect future streaks" |
| Reliability score computed | "You're in the top 23% of users. Unlock your percentile badge." | "Show your rank" |
| Attempt to view analytics | Blurred graph + "See your full progress breakdown" | "Unlock analytics" |
| Weekly narrative blurred | "Your Axiom brief is ready." + preview blurred | "Unlock weekly coaching" |
| After 30-day streak | "You've built a 30-day streak. Protect it with Elite." | "Add Streak Shield" |

**Implementation:** Each trigger component accepts an `onUpgradeClick` prop that opens the upgrade modal. The modal knows which feature triggered it and shows relevant copy, not generic pricing.

---

## PART 3 — ADDICTION WITHOUT TOXICITY

### The Risk Model

Every engagement mechanic has a dark version:
- Streaks → anxiety, shame, avoidance when broken
- Reliability scores → comparison toxicity, impostor syndrome
- Partner dynamics → ghosting, social debt, power imbalances
- AI coach → over-reliance, parasocial dependency

Praxis must engineer **healthy compulsion** — the same pull as exercise, not the same pull as doom-scrolling.

---

### 3.1 Grace Periods and Framing

- **Streak loss is framed as a fresh start, not a failure.** Broken streak UI: "Day 1 of your next streak." Not "Streak lost." Same energy as Atomic Habits' "never miss twice."
- Grace day UX: "Life happens. Take your grace day." Not "You're about to lose your streak."
- After 3 consecutive broken streaks: system sends a **support check-in** ("How are you doing? Sometimes stepping back is the right move.") — not a re-engagement nudge.

### 3.2 Reliability Score Guardrails
- Score is hidden until 14 days of data (prevents anxiety in new users)
- Percentile compares you to **yourself over time** first ("Up 8% from last month") before comparing to others
- Leaderboards are **opt-in only** — off by default, never surfaced automatically
- Score cannot decrease more than 10 points in a single week (smoothing prevents panic spirals)

### 3.3 Partner Dynamics
- If a partner hasn't responded in 7 days: system gently surfaces "Re-match" option. No blame assigned.
- Partners cannot see each other's raw reliability score — only the tier (Disciplined, Elite, etc.)
- No "read receipts" for check-ins (eliminates the "seen but didn't respond" anxiety)
- **Rematch cooldown:** 14 days before you can re-pair with the same person (prevents re-pair loops)

### 3.4 Healthy Engagement Thresholds
- If a user logs > 5 check-ins in a single day: gentle message — "You're locked in today. Don't forget: rest is part of the system."
- If a user uses the app > 4h total in one day: soft notification — "You've been building hard. Take a breath."
- Axiom won't send messages between 10pm–7am local time, even if triggered
- Weekly narrative always includes one sentence of acknowledgment for difficulty, not just wins

### 3.5 Anti-Burnout Architecture
- **Streak freeze mode:** Users can pause streaks for up to 7 days (vacation, illness) — Pro+. Requires a reason (not enforced, just friction to prevent abuse).
- **Accountability density:** System monitors if a user has too many active partners (> 3 active mutual streaks) and surfaces a "Focus mode" suggestion.
- **Goal overload warning:** If a user has > 7 active goals, the system flags it — "Elite performers usually focus on 3–5 key areas."

---

## PART 4 — METRICS & SUCCESS MODEL

### Primary KPIs

| KPI | Good | Great | When to Panic |
|---|---|---|---|
| DAU/MAU ratio | > 30% | > 45% | < 15% |
| Weekly streak retention | > 55% | > 70% | < 35% |
| Match longevity (avg pair duration) | > 14 days | > 30 days | < 7 days |
| Pro conversion rate | > 4% | > 8% | < 2% |
| Monthly churn rate | < 7% | < 4% | > 12% |

### Secondary KPIs

| KPI | Target | Measurement |
|---|---|---|
| Avg check-ins per active user per week | ≥ 4 | checkins table, rolling 7d |
| AI narrative open rate | > 45% | opened_at set within 24h |
| Upgrade trigger conversion | > 12% | modal shown → subscription created |
| Grace day usage rate | 20–40% | too high = anxiety; too low = feature unused |
| Streak length at Pro conversion | track median | reveals when value is felt |

### Pivot Signals

- **DAU/MAU < 20% at week 6:** Core loop is broken. The check-in action has too much friction or insufficient reward. Reduce to 1-tap micro-action only, remove all form fields.
- **Match longevity < 7 days:** Matching algorithm is producing poor pairs. Add a compatibility quiz pre-match. Allow re-match with no cooldown.
- **Pro conversion < 2% at day 60:** Value prop unclear. Add a 7-day free Pro trial after first streak milestone (7 days). Reduce free tier limit to 2 goals (increase pressure).
- **Streak retention < 35%:** Grace periods too short or notification timing wrong. A/B test 36h vs 18h "at risk" notification window.
- **Churn > 12%:** Users leaving after trying Pro. Re-examine what Pro delivers in week 1. Narrative must land in first week, not week 4.

---

## PART 5 — 90-DAY ROLLOUT PLAN

### Month 1 — Hook the User (Days 1–30)

**Goal: make the core loop functional and emotionally engaging.**

#### Week 1–2: Foundation
- [ ] DB migration: `mutual_streaks`, `checkins`, `notifications` tables
- [ ] Add reliability fields to `profiles`
- [ ] `POST /api/checkins` endpoint — full and micro types
- [ ] `GET /api/streaks/:userId` endpoint
- [ ] `<CheckInButton>` component — 1-tap, animations
- [ ] `<StreakCard>` on dashboard — shows partner + count

**MVP cutoff:** If behind, ship 1-tap check-in + individual streak. Mutual streak is polish.

#### Week 3–4: Engagement Layer
- [ ] Reliability score calculation (nightly cron or Supabase Edge Function)
- [ ] Status tier display on profile + match cards
- [ ] Grace day mechanism (DB + UI)
- [ ] Streak-at-risk notification trigger (push + in-app)
- [ ] Streak broken notification (compassionate tone)
- [ ] Partner activity notification ("Alex just checked in")

**KPIs to watch at end of Month 1:** DAU/MAU > 20%, avg check-ins/user/week > 3

---

### Month 2 — Monetize the Loop (Days 31–60)

**Goal: gate the features users now want, trigger upgrades at peak desire.**

#### Week 5–6: Stripe Tier Enforcement
- [ ] Extend `user_subscriptions` table with tier + Stripe IDs
- [ ] `requireTier('pro')` middleware — deployed on all Pro routes
- [ ] Handle all 5 Stripe webhook events
- [ ] Free tier limits enforced: 3 goals (backend check), 5 matches/month (counter in DB)
- [ ] Upgrade modal component — context-aware copy per trigger
- [ ] Pricing page with annual toggle

#### Week 7–8: Upsell Triggers
- [ ] Match limit trigger → upgrade modal
- [ ] Streak broken → Elite streak shield pitch
- [ ] Reliability score display → Pro gate (blurred for Free)
- [ ] Weekly narrative blurred preview for Free users
- [ ] Dunning email for failed payments (7-day grace)
- [ ] Annual plan nudge in subscription settings ("Save 33%")

**KPIs at end of Month 2:** Pro conversion > 3%, churn < 8%

---

### Month 3 — Deepen the Identity (Days 61–90)

**Goal: make leaving feel like losing part of yourself.**

#### Week 9–10: AI Narrative Layer
- [ ] Weekly narrative generation (Gemini, Sunday 11pm UTC cron)
- [ ] `weekly_narratives` table + endpoints
- [ ] Narrative delivery: push + email (Monday 7am)
- [ ] In-app narrative card on dashboard (expandable)
- [ ] Blurred preview for Free users

#### Week 11–12: Status System + Analytics + Optimization
- [ ] Status tier badges on profile, DM view, match cards
- [ ] Progress analytics page (Pro): streak graphs, check-in heatmap, reliability trend
- [ ] Opt-in global reliability leaderboard (Elite)
- [ ] A/B test: notification timing (18h vs 24h for streak risk)
- [ ] A/B test: upgrade modal copy variants
- [ ] Review all KPIs. Identify top churn reason. Fix it.

**KPIs at end of Month 3:** DAU/MAU > 35%, Pro conversion > 5%, streak retention > 60%, churn < 6%

---

### Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Streak anxiety drives users away | Medium | High | Grace days, compassionate copy, opt-out of streak tracking |
| Gemini API costs spike with narrative generation | Low | Medium | Cache narratives, generate only for active users (check-in in last 7d) |
| Partner ghosting kills mutual streaks | High | High | Auto-suggest rematch at 7d inactivity, never assign blame |
| Free tier too generous → low conversion | Medium | High | Monitor. If conversion < 2% at day 60, reduce to 2 goals |
| Reliability score comparison toxicity | Low | Medium | Keep it opt-in for leaderboards, emphasize personal trend first |
| Stripe webhook failures | Low | High | Idempotency keys, retry logic, manual recovery endpoint |

---

## Engineering Priority Stack (ranked)

1. `POST /api/checkins` + streak logic (nothing works without this)
2. Streak-at-risk notification (the most powerful retention mechanic)
3. `requireTier()` middleware (gates everything)
4. Stripe webhook handler (revenue depends on it)
5. Reliability score cron (nightly, can be delayed to Week 4)
6. Weekly narrative generation (Month 2–3 feature)
7. Status tier badges (Month 3 polish)
8. Analytics dashboard (Month 3 polish)

---

## Fast MVP vs Polished Version

| Feature | MVP (ship in Week 2) | Polished (Month 3) |
|---|---|---|
| Check-in | 1-tap button, no note | Note field, goal selector, mood tag |
| Streak | Individual only | Mutual + social framing |
| Notifications | In-app banner | Push + email + quiet hours |
| Reliability | Raw score only | Percentile + trend + tier badge |
| Narrative | Plain text email | Beautiful in-app card with Axiom avatar |
| Upgrade | Basic pricing page | Context-aware modal at trigger moment |

**Rule:** Ship MVP on schedule. Polish never blocks launch.
