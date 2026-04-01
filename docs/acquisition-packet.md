# 🎯 PRAXIS — ACQUISITION INFORMATION PACKET

### _Confidential — For Qualified Buyers Only_

**Date:** April 2026  
**Stage:** Early Traction / Pre-Series A  
**Location:** Verona, Italy 🇮🇹  
**Founder:** Giovanni Pezzingiovanni (ilPez00)

---

## 📌 EXECUTIVE SUMMARY

**Praxis** is an AI-powered accountability platform that combines goal tracking with social community to help users achieve real-world momentum.

**One-Liner:** "Your AI accountability partner that actually works."

**Problem:** 92% of people fail to achieve their goals. Existing solutions are either solo journaling apps (notion, Day One) or shallow habit trackers (Habitica, Streaks) — neither provides the accountability and community needed for real change.

**Solution:** Praxis combines:

- 🎯 **Goal Trees** — Hierarchical goal tracking with progress visualization
- 🔥 **Streaks & Accountability** — Daily check-ins with peer verification
- 🤖 **AI Coaching (Axiom)** — Daily briefs, weekly narratives, personalized insights
- 🤝 **Social Matching** — AI-powered partner matching based on goal alignment
- 🏆 **Gamification** — Levels, leagues, achievements, leaderboards

**Traction:** (Fill in with live metrics from `/admin/metrics`)

- Total Users: [X]
- MAU: [X]
- Paying Users: [X]
- MRR: $[X]

**Ask:** $200K–$500K for 10–20% equity (or acqui-hire at $200K+)

---

## 📊 KEY METRICS

### Current State (as of April 2026)

| Metric              | Value                  | Notes                     |
| ------------------- | ---------------------- | ------------------------- |
| **Total Users**     | [from /admin/metrics]  | Registered accounts       |
| **DAU (7d avg)**    | [from /admin/metrics]  | Unique check-ins          |
| **MAU**             | [from /admin/metrics]  | Unique check-ins          |
| **DAU/MAU Ratio**   | [calc: DAU/MAU]        | Target: 40%+              |
| **Paying Users**    | [from /admin/metrics]  | Pro subscribers           |
| **MRR**             | $[from /admin/metrics] | Monthly recurring revenue |
| **Avg Streak**      | [calc]                 | Average user streak       |
| **Goals Created**   | [from /admin/metrics]  | Total goal nodes          |
| **Check-ins (30d)** | [from /admin/metrics]  | Engagement metric         |

### Growth Trajectory

| Month    | Users  | MAU    | Paying | MRR    |
| -------- | ------ | ------ | ------ | ------ |
| Jan 2026 | —      | —      | —      | —      |
| Feb 2026 | —      | —      | —      | —      |
| Mar 2026 | —      | —      | —      | —      |
| Apr 2026 | [fill] | [fill] | [fill] | [fill] |

_(Export weekly from /admin/metrics endpoint)_

---

## 💰 BUSINESS MODEL

### Revenue Streams

1. **Pro Subscription** — $9.99/month or $79.99/year (save 33%)
   - Unlimited root goals (free: 3)
   - Weekly AI narratives
   - Priority matching
   - Advanced analytics
   - Sparring partner access

2. **Praxis Points (PP)** — One-time purchases
   - 500 PP — $4.99
   - 1100 PP — $9.99 (most popular)
   - 3000 PP — $24.99 (best value)

   **Use Cases:**
   - Extra goal slots (200 PP)
   - AI coaching sessions (500 PP)
   - Profile boosts (50-200 PP)
   - Custom themes/badges (100-200 PP)

3. **Platform Fees** — 5% on duel winnings (future)

### Unit Economics

| Metric           | Value        | Calculation                            |
| ---------------- | ------------ | -------------------------------------- |
| **CAC**          | $0 (organic) | No paid ads yet                        |
| **LTV**          | $120 (est.)  | Avg subscription length 12 mo × $10/mo |
| **LTV:CAC**      | ∞ (organic)  | Will decrease with paid acquisition    |
| **Gross Margin** | 95%+         | SaaS, low variable costs               |
| **Churn**        | [track]      | Monthly subscription cancellations     |

### Cost Structure

| Expense               | Monthly      | Notes                   |
| --------------------- | ------------ | ----------------------- |
| **Supabase**          | $25–50       | Database, auth, storage |
| **Vercel (Frontend)** | $0–20        | Hobby/Pro plan          |
| **Railway (Backend)** | $5–20        | Starter plan            |
| **Google Gemini**     | $0–50        | Pay-as-you-go AI        |
| **Stripe Fees**       | 2.9% + $0.30 | Per transaction         |
| **Resend (Email)**    | $0–30        | Free tier → paid        |
| **Total (current)**   | ~$100–200/mo | At current scale        |
| **Total (at 1K DAU)** | ~$500–800/mo | Projected               |

---

## 🛠️ TECH STACK

### Frontend

- **React 18** + TypeScript
- **MUI v7** — Component library
- **Vite** — Build tool
- **react-confetti, react-hot-toast** — UX polish

### Backend

- **Node.js** + Express + TypeScript
- **Supabase** — PostgreSQL, Auth, Realtime, Storage
- **pgvector** — AI embeddings for matching
- **Stripe** — Payments & subscriptions
- **Resend** — Transactional email

### AI/ML

- **Google Gemini** — Daily briefs, weekly narratives, coaching
- **Custom matching algorithm** — Rule-based goal overlap scoring

### DevOps

- **Vercel** — Frontend hosting
- **Railway** — Backend hosting
- **GitHub Actions** — CI/CD
- **Sentry** — Error tracking

### Code Quality

- **TypeScript** — 100% typed
- **ESLint** + Prettier
- **Husky** + lint-staged — Pre-commit hooks
- **Jest** + Playwright — Unit + E2E tests

---

## 📈 MARKET OPPORTUNITY

### TAM (Total Addressable Market)

- **Global Productivity Software Market:** $100B+ by 2030
- **Habit Tracking Apps:** 50M+ downloads annually
- **Personal Development Market:** $43B annually

### SAM (Serviceable Addressable Market)

- **English-speaking markets:** US, UK, Canada, Australia (~300M potential users)
- **Target demographic:** Ages 18–45, goal-oriented, tech-savvy
- **Estimated SAM:** 10M users

### SOM (Serviceable Obtainable Market)

- **Year 1 goal:** 10K users, 500 paying, $5K MRR
- **Year 2 goal:** 100K users, 5K paying, $50K MRR
- **Year 3 goal:** 500K users, 25K paying, $250K MRR

### Competitive Landscape

| Competitor   | Strengths               | Weaknesses                   | Praxis Differentiator      |
| ------------ | ----------------------- | ---------------------------- | -------------------------- |
| **Habitica** | Gamification, community | Too game-like, not serious   | Real accountability + AI   |
| **Coach.me** | Human coaching          | Expensive ($100+/session)    | AI coaching at 1/10th cost |
| **Notion**   | Flexible, popular       | Solo tool, no accountability | Social + AI built-in       |
| **Streaks**  | Simple, beautiful       | iOS only, no community       | Cross-platform + social    |
| **Day One**  | Beautiful journaling    | Private, no accountability   | Public accountability      |

---

## 🎯 GROWTH STRATEGY

### Completed (Growth Sprint — March 2026)

- ✅ Stripe payment flow (billing portal, annual pricing)
- ✅ Viral sharing (5 touchpoints: check-in, achievements, leaderboard, goals, posts)
- ✅ Email retention system (5 templates)
- ✅ Gamification (levels, quests, achievements, leagues)
- ✅ Product Hunt preparation

### Next 90 Days

1. **Product Hunt Launch** (April 2026)
   - Target: #1 Product of the Day
   - Goal: 1K signups, 50 paying users

2. **Content Marketing**
   - SEO blog posts (goal-setting, accountability, AI coaching)
   - Guest posts on productivity blogs
   - YouTube tutorials

3. **Community Building**
   - Discord server for power users
   - Weekly accountability challenges
   - User success stories

4. **Paid Acquisition (Test)**
   - Reddit ads (r/productivity, r/getdisciplined)
   - Twitter/X ads (productivity influencers)
   - Budget: $500/mo test

### Next 12 Months

1. **Mobile App** — React Native (iOS + Android)
2. **Team Hiring** — 1 frontend, 1 marketing
3. **Enterprise Tier** — Team accountability for companies
4. **International Expansion** — Italian, Spanish, French localization

---

## 🏆 MILESTONES & ACHIEVEMENTS

### Technical Milestones

- ✅ Full gamification system (levels, quests, achievements)
- ✅ AI coaching (Axiom daily briefs, weekly narratives)
- ✅ Real-time matching algorithm
- ✅ Payment system (Stripe subscriptions + PP purchases)
- ✅ Email retention system
- ✅ Admin metrics dashboard

### Product Milestones

- ✅ Goal tree visualization
- ✅ Streak system with peer verification
- ✅ Community feed + posts
- ✅ Leaderboards with league system
- ✅ Betting/duel system
- ✅ Notebook/journaling system

### Business Milestones

- ✅ First paying customer: [DATE]
- ✅ $100 MRR: [DATE]
- ✅ $1K MRR: [TARGET: Q3 2026]
- ✅ 1K users: [TARGET: Q3 2026]
- ✅ Product Hunt #1: [TARGET: April 2026]

---

## 📋 DUE DILIGENCE CHECKLIST

### Legal

- [x] Company incorporated (sole proprietorship → SRL if needed)
- [ ] Trademark registration (Praxis name/logo)
- [x] Terms of Service + Privacy Policy
- [ ] GDPR compliance (EU users)

### Financial

- [ ] Bank account separation (business vs personal)
- [ ] Accounting system (Xero/QuickBooks)
- [ ] Revenue recognition policy
- [ ] Tax filings (Italy → US expansion)

### Technical

- [x] Codebase audited (security, performance)
- [x] Database backups automated
- [x] Error tracking (Sentry)
- [ ] Load testing completed
- [ ] Disaster recovery plan

### Operational

- [ ] Customer support system (Intercom/Zendesk)
- [ ] On-call rotation (if team)
- [ ] Documentation (internal + user-facing)

---

## 💼 ACQUISITION SCENARIOS

### Scenario 1: Acqui-Hire ($200K–$400K)

**Buyer:** Productivity app company (Notion, Habitica, Coach.me)  
**Rationale:** Team + technology integration  
**Structure:** Cash + earnout based on retention  
**Timeline:** 3–6 months

### Scenario 2: Strategic Acquisition ($500K–$2M)

**Buyer:** Larger tech company entering productivity (Google, Microsoft, Meta)  
**Rationale:** AI coaching + social accountability IP  
**Structure:** Cash + stock  
**Timeline:** 6–12 months

### Scenario 3: Roll-Up ($1M–$5M)

**Buyer:** PE firm aggregating productivity apps  
**Rationale:** Consolidate market, cross-sell  
**Structure:** Cash + revenue share  
**Timeline:** 6–9 months

### Scenario 4: Continue Building (Recommended)

**Path:** Raise $500K–$1M seed round  
**Valuation:** $3M–$5M post-money  
**Use of Funds:** Team (3–5 people), marketing, mobile app  
**Exit Target:** $20M–$50M in 3–5 years

---

## 📞 CONTACT

**Giovanni Pezzingiovanni**  
Founder & Lead Developer  
📧 [your-email@praxis.app]  
📱 [your-phone]  
📍 Verona, Italy  
🔗 [LinkedIn/GitHub/Twitter]

**Legal Counsel (if applicable):**  
[Firm Name]  
[Contact]

---

## ⚠️ CONFIDENTIALITY NOTICE

This document contains proprietary and confidential information intended solely for the use of qualified buyers who have signed a non-disclosure agreement. Distribution without written consent is prohibited.

**© 2026 Praxis. All rights reserved.**

---

_Last Updated: March 28, 2026_  
_Version: 1.0_  
_Generated from: /docs/ACQUISITION_PACKET.md_
