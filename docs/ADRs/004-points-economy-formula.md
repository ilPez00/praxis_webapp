# ADR 004 — Points economy formula

## Context

Praxis Points (PP) are the in-app currency that fuels the marketplace, commitment stakes, goal-slot purchases, and leaderboard ranking. Early versions awarded a flat 10 PP per check-in, which led to two problems: (a) long-streak users didn't feel rewarded for consistency, (b) completing an entire goal felt identical to a single check-in.

## Decision

Three award paths, all pure local math — no LLM, no external service. All three are in `src/controllers/`:

### 1. Daily check-in (`checkinController.ts`)

```
base = 5 PP
streak bonus = +10 at streak >= 7, +20 at streak >= 30
daily total = 10–25 PP
```

Streak resets on a missed day. Computed fresh on each `POST /checkins`.

> Historical note: `MEMORY.md` session 36 recorded higher numbers (+20 base, up to 70 PP/day). The comment in `checkinController.ts:89` is the source of truth — base 5, totaling 10–25. Memory is stale; code is canonical.

### 2. Goal-node completion (`goalController.ts`)

```
award = round(20 × weight)
```

Where `weight` is the node's normalized importance 0–1 in the goal tree. A root-level goal (weight 1.0) pays 20 PP on completion; a leaf chapter (weight ~0.1) pays 2 PP. Triggered once per node, when `status` transitions to `completed`.

### 3. Purchasing PP (`stripeController.ts`)

Three tiers via Stripe one-off checkout:
| SKU | PP | Price |
|-----|-----|-------|
| `pp_500` | 500 | $4.99 |
| `pp_1100` | 1,100 | $9.99 |
| `pp_3000` | 3,000 | $24.99 |
Credited via Stripe webhook with idempotency guard (checks `marketplace_transactions.stripe_session_id` before crediting).

## Consequences

- ✅ Formulas are deterministic and testable. No AI drift.
- ✅ Weight-scaled completion awards make the tree topology meaningful — users feel bigger wins for bigger goals.
- ✅ Streak multipliers nudge consistency without exploding the economy.
- ❌ Numbers are hand-tuned with no telemetry loop. If Stripe PP purchases become the primary spend path, the earn/spend ratio should be reviewed against actual play data.
- ❌ The purchase tiers are hardcoded in `PP_TIERS`. Adjusting them needs a code deploy — no admin UI.

## When this gets revisited

When the `/points/spend` catalogue grows beyond ~10 items, or when premium subscribers want a different earn rate. At that point introduce a config-driven rewards table in the DB and read formulas from there.
