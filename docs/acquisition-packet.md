# Praxis — Acquisition Information Packet

**Version:** 1.0 | **Date:** April 2026 | **Stage:** Early traction / Pre-launch

---

## Executive Summary

Praxis is a daily goal journal + accountability buddy PWA combining AI coaching (Axiom), social accountability (mutual streaks, partner matching), and gamification (levels, achievements, leaderboards). Built with React/Express/Supabase, fully production-ready with Stripe payments, pgvector AI matching, and 34 feature modules.

**Target buyers:** Productivity SaaS acquirers, gamification platforms, AI coaching startups, or operators looking for a complete codebase with monetization infrastructure.

---

## Key Metrics

> ⚠️ **Note:** Metrics below are placeholders. Replace with actual data from the Admin > Metrics tab before presenting to buyers.

| Metric                  | Current Value | Notes                     |
| ----------------------- | ------------- | ------------------------- |
| **Total Users**         | [X]           | All registered users      |
| **7-Day Active Users**  | [X]           | Checked in within 7 days  |
| **30-Day Active Users** | [X]           | Checked in within 30 days |
| **Paying Users**        | [X]           | Active Pro subscriptions  |
| **MRR**                 | $[X]          | Monthly recurring revenue |
| **Avg. Streak**         | [X] days      | Average check-in streak   |
| **Total Goals**         | [X]           | Goal trees created        |

### Growth Trajectory

| Week   | New Users | Active Users | Paying |
| ------ | --------- | ------------ | ------ |
| Week 1 | [X]       | [X]          | [X]    |
| Week 2 | [X]       | [X]          | [X]    |
| Week 3 | [X]       | [X]          | [X]    |
| Week 4 | [X]       | [X]          | [X]    |

---

## Revenue Model

### Pricing Tiers

| Tier     | Monthly | Annual | Features                                               |
| -------- | ------- | ------ | ------------------------------------------------------ |
| **Free** | $0      | $0     | 3 goals, 5 matches/mo, basic check-ins                 |
| **Pro**  | $9.99   | $79.99 | Unlimited goals, AI briefs, priority matching, betting |

### Revenue Streams

1. **Subscription Revenue** — Pro tier ($9.99/mo)
2. **Virtual Currency (PP)** — One-time purchases ($4.99-$24.99)
3. **Platform Cut** — 5% on duel winnings

### Unit Economics

| Metric              | Value                        |
| ------------------- | ---------------------------- |
| **ARPU**            | ~$[X]                        |
| **CAC**             | $[X] (paid) / $[X] (organic) |
| **LTV (estimated)** | $[X]                         |
| **LTV:CAC**         | [X]:1                        |

---

## Product Features

### Core Loop

- ✅ Daily check-ins with streak tracking
- ✅ Hierarchical goal trees (JSONB)
- ✅ Mood tracking + daily wins
- ✅ Peer verification for goal completion

### AI System

- ✅ Axiom daily briefs (midnight generation)
- ✅ Weekly AI narratives
- ✅ Engagement metric analysis (7 archetypes)
- ✅ Burnout/stagnation risk detection
- ✅ Privacy-preserving design (analyzes behavior, not content)

### Social Features

- ✅ AI semantic matching (pgvector embeddings)
- ✅ Mutual streaks (partner accountability)
- ✅ Direct messaging
- ✅ Chat rooms / group boards
- ✅ Honor system

### Gamification

- ✅ XP/Level system (1-100)
- ✅ Leagues (Bronze → Diamond)
- ✅ 27+ achievements
- ✅ Daily quests with PP/XP rewards
- ✅ Leaderboards
- ✅ Betting/duels

### Marketplace

- ✅ Virtual goods (badges, boosts)
- ✅ Praxis Points purchasable via Stripe
- ✅ Streak shields

---

## Tech Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| **Frontend**   | React 18 + TypeScript + MUI v7 + Vite       |
| **Backend**    | Express 5 + TypeScript                      |
| **Database**   | Supabase (PostgreSQL + pgvector + Realtime) |
| **Auth**       | Supabase JWT                                |
| **AI**         | Google Gemini + DeepSeek fallback           |
| **Payments**   | Stripe (subscriptions + one-time)           |
| **Storage**    | Supabase Storage                            |
| **Deployment** | Vercel (frontend) + Railway (backend)       |
| **CI/CD**      | GitHub Actions                              |

### Key Technical Decisions

- **pgvector semantic search** for goal similarity matching
- **Privacy-preserving AI** — Axiom analyzes engagement patterns, not message content
- **Supabase RLS** for row-level security on all tables
- **Stripe webhooks** for subscription state management
- **64 database migrations** showing active iteration

---

## Codebase Stats

| Metric                | Value                  |
| --------------------- | ---------------------- |
| **TypeScript Files**  | 341                    |
| **Lines of Code**     | ~73,787                |
| **SQL Migrations**    | 64 files, ~9,600 lines |
| **Controllers**       | 42 backend controllers |
| **API Routes**        | 57 route modules       |
| **Frontend Features** | 34 feature modules     |

---

## API Costs (Monthly)

| Service           | Cost         | Notes                          |
| ----------------- | ------------ | ------------------------------ |
| **Supabase**      | ~$[X]        | Tier depends on usage          |
| **Google Gemini** | ~$[X]        | Pay-as-you-go, scales with DAU |
| **Vercel**        | ~$[X]        | Frontend hosting               |
| **Railway**       | ~$[X]        | Backend hosting                |
| **Resend**        | ~$[X]        | Email (free tier: 100/day)     |
| **Total**         | **~$[X]/mo** | Base + variable costs          |

---

## Competitive Positioning

| Competitor           | Weakness                        | Praxis Advantage                     |
| -------------------- | ------------------------------- | ------------------------------------ |
| **Habitica**         | No AI matching, dated UX        | AI-powered matching + modern PWA     |
| **Coach.me**         | Human coaches only, expensive   | AI coaching at scale, affordable     |
| **Fokus**            | Simple goal tracking, no social | Social accountability + gamification |
| **r/GetDisciplined** | Reddit only, no product         | Real product with community          |

---

## Risks & Mitigations

| Risk                 | Impact | Mitigation                                 |
| -------------------- | ------ | ------------------------------------------ |
| **AI API costs**     | Medium | Minimal AI mode fallback, usage monitoring |
| **User acquisition** | High   | Referral system, viral sharing, PH launch  |
| **Churn**            | Medium | Streak mechanics, milestone celebrations   |
| **Competition**      | Low    | First-mover in AI + social accountability  |

---

## Ask

### Valuation

| Stage                         | Multiple        | Value       |
| ----------------------------- | --------------- | ----------- |
| **Pre-revenue**               | 1-3x code value | $50K-$150K  |
| **Early traction ($500 MRR)** | 10-20x MRR      | $5K-$10K    |
| **Growth ($5K MRR)**          | 5-10x ARR       | $25K-$50K   |
| **Scale ($50K MRR)**          | 5-10x ARR       | $250K-$500K |

### Preferred Structure

- **Cash** — Full payment on close
- **Escrow** — 50% upfront, 50% after 30-day transition

### What's Included

- Full codebase (all TypeScript, SQL migrations)
- Supabase schema + RLS policies
- Stripe integration + webhook handlers
- AI services (Gemini API key transfer)
- Documentation (README, API docs, architecture)
- 30-day transition support

### What's Not Included

- Domain, brand, social accounts
- Customer data (GDPR compliance)
- Third-party API keys (buyer must set up)

---

## Next Steps

1. **Review metrics** — Visit `/admin` → Metrics tab
2. **Test payment flow** — Complete a Stripe test purchase
3. **Verify email delivery** — Configure Resend API key
4. **Document growth** — Capture 4-week user/revenue trends

---

## Contact

**Gio | Verona, Italy**

- Email: [your@email.com]
- LinkedIn: [optional]
- Twitter: [optional]

---

_This packet was generated as part of the Praxis growth sprint. For the latest metrics, visit the Admin > Metrics tab in the application._
