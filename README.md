# ⚖️ Praxis

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Build-Vite%208-646CFF.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-blueviolet.svg)](https://supabase.com/)
[![Status](https://img.shields.io/badge/Status-Active_Development-success.svg)](https://github.com/giovannigallo/praxis_webapp)

> **Aligning Will. Designing Intent.**<br>
> Praxis transforms isolated goal-setting into mutual commitment through accountability partnerships that make achievement inevitable.

---

<p align="center">
  <strong>🚀 Built for those who know that willpower alone isn't enough.</strong><br>
  <em>Praxis pairs you with the right partner, gives you skin in the game, and tracks what actually matters.</em>
</p>

---

## 🎯 What Is Praxis?

Praxis is a **next-generation accountability partnership platform** that moves beyond solitary habit-tracking by connecting you with committed partners who share your goals and values. Through structured accountability, meaningful stakes, and intelligent matching, Praxis ensures your goals are not just tracked — **they're achieved**.

### The Problem We Solve

| Traditional Habit Trackers            | Praxis                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| Solo journey — easy to quit           | **Social accountability** — harder to let your partner down   |
| Hollow streaks — breaks feel punitive | **Grace & recovery** — life happens, systems adapt            |
| No consequences for skipping          | **Skin in the game** — accountability bets with real stakes   |
| Generic reminders                     | **Smart partner matching** — find people who share your drive |
| Data you never look at                | **Rich analytics** — insights that drive behavior change      |

### Who Praxis Is For

- **🎯 Achievers** who know they perform better with a committed partner
- **🤝 Accountability seekers** tired of breaking goals alone
- **💪 Disciplined builders** who want to track progress with intentionality
- **📈 Growth-minded individuals** who value sustainable intensity over hustle culture

---

## ✨ Core Features

### 🌲 Goal Trees

Define high-level objectives and break them down into actionable, trackable sub-goals. Visualize your entire path from intention to completion.

### 🤝 Smart Partner Matching

Find accountability partners with overlapping goals, complementary schedules, and shared commitment levels. No more going it alone.

### 💰 Accountability Bets

Put real stakes on your commitments. Define what happens if you follow through — or don't. Skin in the game changes everything.

### 📊 Rich Analytics

Track streaks, reliability scores, completion rates, and partnership health. Data-driven insights into what's working and what needs attention.

### 🎮 Gamification & XP System

Earn XP for consistent engagement, unlock achievements, and climb status tiers from Newcomer to Relentless. Progress that feels rewarding.

### 📓 Integrated Notebook

Journal your journey with location tracking, automated logging, and intelligent pattern detection. Your growth narrative, preserved.

### 🔥 Mutual Streaks

Build streaks together with your partner. When one shows up, both benefit. Social accountability that compounds over time.

### 🛡️ Privacy-First Design

Built on Supabase with row-level security, encrypted messaging, and transparent data practices. Your goals are yours.

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT LAYER                      │
│   React 19 (TypeScript) · Material UI · Vite 8      │
│   Web App → Electron Desktop → Mobile (in progress) │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────┴──────────────────────────────┐
│                     API LAYER                        │
│         Express 5 (Node.js/TypeScript)               │
│  Auth · Goals · Social · Payments · Scheduling      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│                   SERVICE LAYER                      │
│   Engagement Metrics · Matching Engine · XP System  │
│   Streak Logic · Notification System · Analytics    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│                    DATA LAYER                        │
│     PostgreSQL (Supabase) · Stripe · Sentry ·       │
│     Winston Logging · Node-cron Scheduling          │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer          | Technology                    | Why                                            |
| -------------- | ----------------------------- | ---------------------------------------------- |
| **Frontend**   | React 19 + TypeScript         | Type-safe, component-driven UI                 |
| **Routing**    | React Router v6 (Data Router) | Modern data fetching patterns                  |
| **Styling**    | Material UI v6                | Consistent, accessible design system           |
| **Build**      | Vite 8                        | 8× faster builds, optimized bundles            |
| **Backend**    | Express 5 + TypeScript        | Stable, extensible API framework               |
| **Database**   | PostgreSQL (Supabase)         | Relational integrity + real-time subscriptions |
| **Auth**       | Supabase Auth                 | OAuth + email auth, JWT sessions               |
| **Payments**   | Stripe                        | Global payments, subscription management       |
| **Monitoring** | Sentry                        | Error tracking, performance profiling          |
| **Logging**    | Winston                       | Structured, production-grade logging           |
| **Testing**    | Jest · Playwright · K6        | Unit, E2E, and load testing coverage           |
| **Deployment** | Vercel (FE) · Railway (BE)    | Zero-downtime deploys on `main`                |

---

## 📖 Documentation

Comprehensive documentation lives in `docs/`:

### Product & Strategy

- [Product Strategy (90-Day Plan)](./docs/PRODUCT_STRATEGY.md)
- [How Praxis Works](./docs/HOW_PRAXIS_WORKS.md)
- [Gamification System](./docs/gamification-enhancement-plan.md)
- [Growth Sprint Plan](./docs/growth-sprint-plan.md)

### Technical Reference

- [Architecture Overview](./docs/wiki/Architecture.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Database Schema](./docs/wiki/Database-Schema.md)
- [Deployment Guide](./docs/wiki/Deployment.md)

### Analytics & Growth

- [Analytics Dashboard](./ANALYTICS_DASHBOARD_TEMPLATE.md)
- [Metrics Dashboard Guide](./docs/METRICS_DASHBOARD_GUIDE.md)

---

## 🚀 Quick Start (Developers)

### Prerequisites

- **Node.js** >= 20.0.0
- **Supabase Project** — create at [supabase.com](https://supabase.com)
- **Git** — for version control

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/praxis_webapp.git
cd praxis_webapp

# 2. Install all dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your Supabase URL, service role key, Stripe keys, etc.

# 4. Start the backend (port 3001)
npm run dev

# 5. In another terminal, start the frontend (port 3000)
cd client
npm install
cp .env.example .env
# Edit client/.env with your Supabase URL, anon key, and API URL
npm run dev
```

### Available Commands

**Backend:**

```bash
npm run dev              # Development server with hot-reload
npm run build            # Compile TypeScript
npm start                # Production server
npm test                 # Unit tests (Jest)
npm run test:e2e         # E2E tests (Playwright)
npm run test:load        # Load tests (K6)
npm run lint             # Code quality checks
npm run lint:fix         # Auto-fix lint issues
```

**Frontend** (`client/`):

```bash
npm run dev              # Vite dev server with HMR
npm run build            # Production build
npm run preview          # Preview production build
```

### Environment Variables

**Root `.env`:**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
PORT=3001
```

**`client/.env`:**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3001/api
```

---

## 🧪 Testing & Quality

Praxis maintains a comprehensive test suite:

| Test Type | Tool       | Command             | Coverage                       |
| --------- | ---------- | ------------------- | ------------------------------ |
| **Unit**  | Jest       | `npm test`          | Core business logic, utilities |
| **E2E**   | Playwright | `npm run test:e2e`  | Critical user flows            |
| **Load**  | K6         | `npm run test:load` | API performance under load     |

**Code Quality:**

- ESLint + TypeScript strict mode enforced
- Pre-commit hooks via Husky
- lint-staged for staged file checks
- `.editorconfig` for consistent formatting

---

## 🤝 Contributing

Praxis welcomes contributions from the community. Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting PRs.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to your branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Contribution Areas

- 🐛 **Bug fixes** — always welcome
- 🎨 **UI/UX improvements** — make Praxis more intuitive
- 📝 **Documentation** — help new contributors and users
- 🧪 **Test coverage** — strengthen reliability
- 🚀 **New features** — discuss in Issues first for major changes
- 🌍 **Localization** — translate for your language

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Supabase** — for the incredible backend platform
- **Stripe** — for seamless payment infrastructure
- **The open-source community** — for the tools and libraries that make Praxis possible

---

<p align="center">
  <em>Praxis is built by individuals who believe that accountability transforms intention into action.</em><br>
  <strong>Join us in making commitment contagious.</strong>
</p>

<p align="center">
  <sub>⚖️ Aligning Will · Designing Intent · Building Praxis</sub>
</p>
