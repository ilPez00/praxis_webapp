# Narrative C — Boilerplate Sale

**Audience:** indie devs, wantrepreneurs, freelancers looking to flip SaaS starters
**Goal:** sell Praxis codebase as a habit-tracker SaaS starter at $149–249 on Gumroad / CodeCanyon / Lemon Squeezy
**Tone:** transactional, feature-dense, stack-forward, reassure about code quality

---

## Gumroad product listing

### Product title

**Praxis Starter — Complete Habit-Tracker SaaS Boilerplate (React + Express + Supabase)**

### Price

$149 (intro pricing, first 30 sales)
$249 (regular)
$499 (commercial multi-site license)

### Hero description (top of the listing)

> Ship your habit-tracker SaaS in a weekend instead of six months.
>
> Praxis Starter is the complete codebase behind a daily goal journal + accountability buddy PWA — 79,000 lines of TypeScript, 36 feature modules, Stripe-ready, production-deployed, branding-free.

### What's included

✅ **Full source code** — React 18 + MUI v7 frontend (53k LOC), Express + TypeScript backend (26k LOC). MIT-licensed dependencies, clean git history, zero obfuscation.

✅ **Complete feature set** out of the box:

- Daily check-ins with streak tracking
- Goal tree with domain-colored visualization (SVG)
- Peer-verified goal completion via in-app DMs
- Accountability buddy matching (rule-based, no LLM calls)
- Real-time chat rooms with media upload
- WebRTC video calls (Supabase Broadcast signaling — zero third-party)
- Group/board system (Reddit-style posts + chat hybrid)
- Stripe subscriptions (Pro tier) + points economy (PP in-app currency)
- Referral system with bonus rewards
- Gamification: XP, levels, daily quests, leaderboards
- i18n layer (IT/EN, extensible)
- PWA + Electron desktop widget + Android WebView widget stub
- Admin panel with 5 tabs (Users, Groups, Stats, Network, Challenges)

✅ **Database schema**: 74 SQL migrations for Supabase (Postgres). Drop into a fresh Supabase project and run.

✅ **Deploy docs**: one-file guide for Vercel (frontend) + Railway/Fly.io (backend) + Supabase (DB).

✅ **Stripe integration**: Pro subscription tier + one-time PP top-up tiers, webhook idempotency checks, test-mode to prod-mode checklist.

✅ **Modern build**: Vite 8 with Rolldown minifier — production builds in under 1 second on a modern laptop.

✅ **Type-safe everything**: 0 TypeScript errors in the shipped codebase.

### Who this is for

- **Indie devs** who want to launch a habit tracker / accountability app without writing 79k LOC
- **Freelancers** who need to quote habit-tracker builds — this cuts your build time by 80%
- **Agencies** who want to white-label a habit tracker for corporate wellness clients
- **Founders** validating a niche pivot (fitness, recovery, students, language learners — Praxis adapts to any)

### Who this is NOT for

- Beginners who can't run Supabase + Railway locally
- Buyers expecting React Native / iOS native code (this is a PWA)
- Buyers expecting a marketing site / landing page (you bring your own)
- Buyers expecting a mature test suite (there are 8 test files — expand before you ship)

### Honest caveats

- **8 test files on 79k LOC** — you'll want to expand this before launching to real users
- **Railway/Fly.io deploy** — production instance requires paid tier (~$5/mo minimum)
- **No marketing site included** — you get the app, you bring the landing page
- **Italian + English i18n** — if you want Spanish/French/German you'll need to add them
- **Solo-dev conventions** — the codebase was built by one developer working alongside three CLI coding agents, so conventions are consistent-ish but not team-reviewed

### Refund policy

7-day no-questions refund if the code doesn't run on your machine following the deploy guide. No refund after day 7 or if you've deployed to a public URL.

---

## X / Twitter — boilerplate launch posts

### Tweet 1 — Listing announce

> I'm selling the complete Praxis codebase as a starter.
>
> 79k LOC · React + Express + Supabase + Stripe · 36 features · production-deployed
>
> $149 intro price, first 30 buyers. $249 after.
>
> If you want to launch a habit tracker / accountability / goal-journal SaaS this month: [Gumroad link]
>
> [attach: boilerplate-stack.svg]

### Tweet 2 — Social proof substitute (you have no sales yet — use build stats instead)

> What $149 gets you in Praxis Starter:
>
> • 820 git commits
> • 74 Supabase migrations
> • 36 feature modules
> • Stripe subscription + webhook idempotency
> • WebRTC video calls (no Twilio)
> • i18n + PWA + Electron widget
> • Vite 8 production build in 0.7s
>
> Or: ~6 months of your weekends.

### Tweet 3 — "Why sell it?"

> Why am I selling the Praxis codebase instead of launching it?
>
> Because I built too many features before validating demand. The honest answer is: I'd rather 20 of you ship 20 focused niches (fitness buddies, sober community, exam prep) than me ship one bloated everything-app.
>
> $149. One-time. You own the code.

### Tweet 4 — Niche pivot angle

> Praxis Starter is not "a habit tracker." It's the base for 5+ different apps.
>
> Proven reskin targets:
> • Gym accountability (use the tracker system)
> • Sober community (use peer verification + streaks)
> • Exam prep (use cowork rooms + challenges)
> • OKR for remote teams (use the goal tree)
> • Language buddy (use WebRTC + chat + matching)
>
> Pick one. Ship in 4 weeks.

### Tweet 5 — Stack flex

> Praxis Starter technical specs:
>
> Frontend: React 18, TypeScript, MUI v7, Vite 8 (Rolldown), i18next, PWA
> Backend: Express, TypeScript, Supabase client, Stripe SDK
> DB: Supabase Postgres, 74 migrations, RLS configured
> Auth: Supabase JWT, service-role key pattern
> Realtime: Supabase Broadcast (WebRTC signaling)
> Deploy: Vercel + Railway
>
> $149 intro.

---

## IndieHackers — boilerplate launch post

**Title:** I'm selling my 79k-LOC habit-tracker SaaS as a $149 starter. Here's why and what you get.

**Body:**

Last week I posted a brutally honest build log about Praxis, my 2.5-month 820-commit habit-tracker project, and the conclusion was: I built too many features, have no users, and the highest-EV move is to resell the code rather than keep chasing distribution.

This is the "doing that" post.

**What's for sale:** Praxis Starter — the complete codebase for a production-deployed daily goal journal + accountability buddy PWA.

**Price:** $149 for the first 30 buyers, $249 after.

**What you get:**

- Full source (React + Express + TypeScript, 79k LOC)
- 74 Supabase migrations + RLS setup
- Stripe subscription integration (Pro tier + in-app currency top-ups)
- WebRTC video calls, real-time chat, group rooms, referral system, i18n, PWA, Electron desktop widget, admin panel
- Deploy guide for Vercel + Railway + Supabase
- MIT-compatible dependencies
- 7-day refund if it doesn't run

**What you don't get:**

- Users, revenue, or brand (selling the code, not the business)
- A marketing site (bring your own)
- A polished test suite (8 test files — you'll want to add more before launch)
- Ongoing support beyond the 7-day install window

**Why I'm selling instead of shipping:**

Honest answer — I built 36 features and the feature-sprawl killed the launch. The codebase is good, the product strategy was bad. Rather than spend another 3 months cutting features and chasing distribution for a generic habit tracker in a crowded market, I'd rather 20 of you fork it into 20 niches (gym buddies, sober community, exam prep, OKR for remote teams, language learner matching — Praxis Starter covers all of these without major rework).

**Who this is for:**

- You've been wanting to launch a habit-tracker-adjacent SaaS but balked at 6 months of build time
- You're a freelancer quoting habit-tracker builds and want to cut your effort 80%
- You're an agency looking for a corporate-wellness white-label base
- You're a solo founder who has a clear niche hypothesis but no starting point

**Who this is NOT for:**

- Anyone expecting React Native / iOS native code
- Anyone hoping for a polished product they can flip tomorrow (you'll need to strip branding, write a landing page, and launch)
- Anyone who needs hand-holding beyond the deploy guide

**Gumroad link:** [placeholder]

**Happy to answer questions in comments** — stack, architecture, the multi-agent workflow I used to build it, the feature list, anything.

P.S. If someone reading this is specifically looking for an Italian-market habit-tracker reskin, the i18n is already Italian-first and the calorie database is integrated with Open Food Facts. That's half the Italian-specific work already done.

---

## CodeCanyon listing (if you list there)

**Title:** Praxis — Habit Tracker & Accountability SaaS (React + Express + Supabase)

**Short description (160 chars):**

> Complete habit-tracker SaaS boilerplate. React + Express + Supabase. Stripe ready. 79k LOC. Goal tree, WebRTC, chat, groups, i18n, PWA, Electron widget.

**Tags:** saas, habit tracker, react, typescript, supabase, stripe, accountability, productivity, pwa, boilerplate

**Category:** Site Templates → Technology → Software & Services

**Pricing:** Regular license $249 (single end-product), Extended $999 (reseller / SaaS-as-a-service)

---

## Hacker News — "Show HN" (boilerplate version, run only if the technical one already went well)

**Title:** Show HN: I built a habit tracker with 36 features and 0 users — now selling the code

**Body:**

Hi HN,

Two weeks ago I posted a "Show HN" about Praxis, my 2.5-month solo build of a habit-tracker PWA (79k LOC, 36 features, multi-agent workflow). The feedback was generous and the top comment was "you built too much, not too little."

That feedback was right, and it led me to a decision I want to run past the HN crowd: I'm selling the codebase as a boilerplate at $149 on Gumroad rather than continuing to chase distribution for a market where Habitica, Streaks, and Habitify are already entrenched.

The logic is:

1. The code is the asset, not the business. The business needs users I don't have.
2. Habit tracker is a commodity vertical; niche reskins are where the real opportunity sits (gym, sober community, exam prep, OKR tools, language learners).
3. 20 buyers each shipping a focused niche > me shipping one bloated everything-app.
4. My time is better spent on the next build than on distribution for this one.

Question for HN: has anyone here successfully sold a non-trivial SaaS codebase as a boilerplate at this price point? I know the $19 "micro-SaaS template" market is saturated and the $2,000+ "enterprise starter kit" market exists, but the $149–299 range feels underserved. Is that a gap or a no-demand zone?

Any general advice from the HN crowd on pricing, positioning, or where to list beyond Gumroad / CodeCanyon would be hugely appreciated.

Link: [Gumroad placeholder]
