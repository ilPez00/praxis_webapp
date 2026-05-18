# Praxis

Social OS for goal tracking and accountability. Structures the gap between intent and action through commitment partnerships, skin-in-the-game mechanics, and an AI agent (Axiom) that scans your progress daily and builds a causal model of what actually works for you.

**Stack:** Express 5 + TypeScript · React 19 + MUI v7 · Supabase (Postgres + RLS) · Stripe · Vite

---

## Quick Start

```bash
git clone https://github.com/ilPez00/praxis_webapp && cd praxis_webapp

npm install
cd client && npm install && cd ..

cp .env.example .env
cd client && cp .env.example .env && cd ..
# fill in both .env files — see Environment section

npm run dev          # backend :3001
cd client && npm run dev   # frontend :5173
```

---

## Architecture

```
client/src/          React 19 SPA (Vite)
  pages/             Route-level components
  components/        Shared UI (MUI v7)
  hooks/             Data fetching, auth state

src/                 Express 5 backend
  controllers/       Route handlers (~50 controllers)
  services/          Business logic + Axiom AI
  models/            Types, enums, PraxisOntology
  routes/            Express router
  middleware/        Auth (Supabase JWT), rate-limit, Sentry
  migrations/        SQL migration files
```

**Auth flow:** Client sends Supabase JWT → backend middleware verifies with `SUPABASE_JWT_SECRET` → handlers call Supabase with service-role key (bypasses RLS). Never expose service-role key to frontend.

**Deploys:** Backend → Railway · Frontend → Vercel · DB → Supabase hosted

---

## Core Features

### Goal Trees

14 life domains (Maslow-structured) each backed by `DomainDef` in `PraxisOntology`:

| Domain                                                                                   | Score axis    |
| ---------------------------------------------------------------------------------------- | ------------- |
| Body & Fitness · Rest & Recovery · Health & Longevity                                    | Physical      |
| Financial Security · Wealth & Assets                                                     | Economic      |
| Career & Craft · Gaming & Esports · Impact & Legacy                                      | Intellectual  |
| Mental Balance · Friendship & Social · Romance & Intimacy · Community · Spirit & Purpose | Psychological |

Goals decompose into sub-goals (goal trees). Progress tracked as percentage. Each domain has a unit (`reps`, `€`, `pages`, `min`, …).

### Axiom — AI Agent

Background agent runs nightly scans and on-demand analysis:

| Service                          | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `AxiomScanService`               | Goal context enrichment — enriches goals with ayu action schema |
| `AxiomUnifiedScanService`        | Daily scan: progress estimation + narrative generation          |
| `AxiomDailySummaryService`       | Distills day's check-ins into daily summary                     |
| `AxiomPersonaService`            | Builds user psychological profile over time                     |
| `AxiomLearningService`           | Detects patterns: what methods work, what causes failure        |
| `AxiomProgressEstimationService` | Estimates goal % from structured tracker data                   |
| `AxiomWikiWriterService`         | Writes compressed `will→action→effect` flows to community wiki  |
| `AxiomWikiSearchService`         | Semantic search over community wiki                             |
| `AxiomNotebookLMService`         | Generates exportable PDF notebooks from goal history            |
| `AICoachingService`              | Conversational coach with configurable personality              |

All Axiom calls use Gemini (primary) via `@google/generative-ai`. MCP server available for programmatic access (`praxis-mcp-server/`).

### Accountability & Social

- **Partner matching** — `MatchingEngineService` pairs users by overlapping goals, schedule, commitment level
- **Accountability bets** — `bettingController` + Stripe for real-stakes commitments
- **Duels** — time-boxed head-to-head goal challenges (`duelResolutionCron`)
- **Groups** — `groupController` + `groupRecommendationController`
- **Sparring** — peer review of methods (`sparringController`)
- **Honor system** — community reputation (`honorController`)

### Check-ins & Tracking

- Manual check-in with mood, win-of-the-day, free text
- Structured trackers (`StructuredTrackerWriter/Reader`) — typed data points per domain
- Calendar integration — Google Calendar sync (`GoogleCalendarService`)
- Push notifications — web-push (`pushController`)
- Streaks, fail tracking, weekly challenges

### Aura Integration

Aura (Android) connects directly via REST API:

```
POST /api/checkins          — auto check-in from vision/audio/voice events
PATCH /api/goals/:id        — update node progress percentage
GET  /api/goals/active      — fetch active goals for HUD/bridge scoring
```

Aura mirrors `PraxisOntology` in Kotlin (`rachmaninov/PraxisOntology.kt`). The `PraxisEventBridge` scores every wiki ingest against active goals and surfaces a one-tap check-in prompt when threshold is exceeded. `GoalHudStrip` shows the most context-relevant goal as a persistent HUD dot.

---

## Environment Variables

### Backend `.env`

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_JWT_SECRET=
GEMINI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
PORT=3001
NODE_ENV=development
```

### Frontend `client/.env`

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001
VITE_STRIPE_PUBLIC_KEY=
VITE_VAPID_PUBLIC_KEY=
```

---

## Database

Migrations in `migrations/`. Apply in order against your Supabase project:

```bash
# via Supabase CLI
supabase db push

# or directly
psql $DATABASE_URL -f migrations/001_init.sql
```

RLS policies are defined per-table. Backend bypasses with service-role key.

---

## Deployment

```bash
# Backend (Railway)
railway up

# Frontend (Vercel)
cd client && vercel --prod

# Docker (self-hosted)
docker build -t praxis .
docker run -p 3001:3001 --env-file .env praxis
```

---

## MCP Server

Praxis exposes an MCP server for AI agent access:

```bash
cd praxis-mcp-server && npm install
node dist/index.js
```

Tools: `get_goals`, `post_checkin`, `update_progress`, `search_wiki`, `get_daily_summary`.

---

## API Reference (key endpoints)

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/goals                  list active goals
POST   /api/goals                  create goal
PATCH  /api/goals/:id              update progress/status

POST   /api/checkins               log check-in
GET    /api/checkins/:userId       user check-in history

GET    /api/axiom/scan             trigger daily axiom scan
GET    /api/axiom/summary/:userId  today's summary
POST   /api/axiom/coach            conversational coaching

GET    /api/matching               find accountability partners
POST   /api/bets                   create accountability bet
POST   /api/duels                  challenge a user

GET    /api/wiki/search?q=         search community wiki
```

Full route list: `src/routes/`.
