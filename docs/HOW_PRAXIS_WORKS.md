# How Praxis Works — Complete System Documentation

**Last Updated:** 2026-03-15  
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Core Philosophy](#core-philosophy)
3. [System Architecture](#system-architecture)
4. [User Journey](#user-journey)
5. [Key Features](#key-features)
6. [Data Flow](#data-flow)
7. [Technology Stack](#technology-technology-stack)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Security & Privacy](#security--privacy)

---

## Overview

**Praxis** is a goal accountability platform that combines behavioral psychology, social accountability, and AI coaching to help users achieve their goals. Unlike traditional productivity apps that focus on tracking, Praxis focuses on **sustainable intentionality** through community support and intelligent feedback.

### What Makes Praxis Different

| Traditional Apps | Praxis |
|------------------|--------|
| Solo tracking | Social accountability |
| Hustle culture | Sustainable intensity |
| Generic reminders | AI-personalized interventions |
| All-or-nothing streaks | Balance-focused approach |
| Manual input only | Behavioral pattern detection |

---

## Core Philosophy

### The Praxis Method

1. **Intentionality Over Intensity**
   - Small, consistent actions beat sporadic bursts
   - System detects burnout risk and intervenes
   - "Zen Days" preserve streaks while allowing rest

2. **Social Accountability**
   - Goals are more likely to be completed with witnesses
   - Match users with similar goals automatically
   - Honor system rewards consistency, not just completion

3. **Sustainable Growth**
   - AI monitors balance across life domains
   - Intervenes when one domain dominates others
   - Encourages recovery as part of progress

4. **Privacy-Preserving Personalization**
   - Engagement metrics (not content) drive recommendations
   - Behavioral patterns inform interventions
   - No message scanning for AI analysis

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   React     │  │   Mobile    │  │   Desktop   │             │
│  │   Web App   │  │   Apps      │  │   (Electron)│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                │                │                     │
│         └────────────────┴────────────────┘                     │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────┼──────────────────────────────────────┐
│                      API LAYER                                  │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Express.js Server (Node.js)                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │   Auth   │ │  Goals   │ │  Social  │ │   AI     │  │   │
│  │  │  Routes  │ │  Routes  │ │  Routes  │ │  Routes  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                   SERVICE LAYER                                 │
│                          ▼                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Engagement  │  │   Matching   │  │   Axiom AI   │          │
│  │   Metrics    │  │   Engine     │  │   Coaching   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Embedding   │  │   Points     │  │  Completion  │          │
│  │   Service    │  │   System     │  │   Protocol   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    DATA LAYER                                   │
│                          ▼                                      │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │   Supabase      │         │   External APIs │               │
│  │   (PostgreSQL)  │         │   ┌───────────┐ │               │
│  │  ┌───────────┐  │         │   │  Gemini   │ │               │
│  │  │  pgvector │  │         │   │  (Google) │ │               │
│  │  │  (RAG)    │  │         │   └───────────┘ │               │
│  │  └───────────┘  │         │   ┌───────────┐ │               │
│  │  ┌───────────┐  │         │   │  Stripe   │ │               │
│  │  │  Realtime │  │         │   │(Payments) │ │               │
│  │  │  (WS)     │  │         │   └───────────┘ │               │
│  │  └───────────┘  │         └─────────────────┘               │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Journey

### 1. Onboarding (First 5 Minutes)

```
Sign Up → Set Language → Create First Goal → System Explains Rules
    │           │              │                    │
    │           │              │                    └─→ Streak mechanics
    │           │              │                    └─→ Honor system
    │           │              │                    └─→ Completion Protocol
    │           │              │
    │           │              └─→ Goal tree structure (root → sub-goals)
    │           │
    │           └─→ Interface language + AI communication
    │
    └─→ Email or Google OAuth
```

### 2. Daily Engagement Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    MORNING (7-9 AM)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Axiom Morning Brief appears                      │   │
│  │    - Personalized message (by archetype)            │   │
│  │    - Daily routine suggestion                       │   │
│  │    - Match recommendation                           │   │
│  │    - Event/place suggestion                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2. Daily Check-in                                   │   │
│  │    - One tap to confirm intention                   │   │
│  │    - +1 to streak                                   │   │
│  │    - +10 Praxis Points                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   DAYTIME (9 AM - 6 PM)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3. Goal Work Sessions                               │   │
│  │    - Update goal progress                           │   │
│  │    - Log tracker entries                            │   │
│  │    - Journal completion (optional)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 4. Social Interactions (optional)                   │   │
│  │    - Give honor to matches                          │   │
│  │    - Respond to completion requests                 │   │
│  │    - Join group sessions                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   EVENING (6 PM - 10 PM)                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 5. Evening Review                                   │   │
│  │    - Review progress                                │   │
│  │    - Plan tomorrow's key action                     │   │
│  │    - Optional reflection                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3. Weekly Cycle

```
Monday:
  └─→ Axiom Weekly Narrative (AI-generated recap)
      - "Last week you logged 5 check-ins..."
      - Pattern recognition ("You're most productive on Tuesdays")
      - Gentle nudge for neglected domains

Wednesday:
  └─→ Mid-week engagement check
      - If activity low: intervention message
      - If streak at risk: reminder

Sunday:
  └─→ Weekly preparation prompt
      - "What's your ONE key goal for next week?"
      - System prepares Monday brief accordingly
```

### 4. Monthly Cycle

```
End of Month:
  └─→ Monthly Review Generated
      - Completion rate by domain
      - Streak statistics
      - Social contribution (honor given/received)
      - Points earned/spent
      
  └─→ Next Month Planning
      - Suggests goal adjustments
      - Identifies patterns to leverage
      - Recommends new connections
```

---

## Key Features

### 1. Goal Trees

**Structure:**
```
Root Goal (e.g., "Get Fit")
├── Sub-goal 1 ("Lose 10kg")
│   ├── Milestone 1.1 ("Join gym")
│   └── Milestone 1.2 ("Meal prep Sundays")
├── Sub-goal 2 ("Run 5K")
│   ├── Milestone 2.1 ("Couch to 5K app")
│   └── Milestone 2.2 ("Park run monthly")
└── Sub-goal 3 ("Strength training")
    └── Milestone 3.1 ("Learn compound lifts")
```

**Rules:**
- Root goals must have a domain (Fitness, Career, Relationships, etc.)
- Progress propagates upward (completing milestones updates parent)
- Free users: 3 root goals max
- Pro users: Unlimited goals

### 2. Daily Check-ins

**Mechanics:**
- One tap before midnight local time
- Resets at midnight (user's timezone)
- Streak counter increments
- +10 Praxis Points per check-in
- Visual feedback (fire animation for streaks)

**Streak Protection:**
- "Freeze Streak" available once/month (Pro feature)
- "Zen Day" preserves streak while resting
- Streak recovery: Pay PP or wait 7 days

### 3. Completion Protocol

**How It Works:**
```
User A completes a goal
    │
    ├─→ System notifies User A's matches
    │   └─→ "Your match just completed 'Run 5K'!"
    │
    └─→ Match can respond:
        ├─→ Give Honor (+5 PP to both)
        └─→ Send Message (strengthens bond)
```

**Benefits:**
- Creates accountability loop
- Reinforces social connection
- Both parties earn points
- Builds relationship through shared wins

### 4. Honor System

**Types of Honor:**
| Type | Cost | Recipient Gets | Giver Gets |
|------|------|----------------|------------|
| Regular Honor | Free | +5 PP | +2 PP |
| Super Honor | 20 PP | +25 PP | +10 PP |
| Completion Honor | Free | +10 PP | +5 PP |

**Honor Streaks:**
- Giving honor daily builds a separate streak
- Weekly leaderboards for top honor-givers
- "Generosity Score" visible on profile

### 5. AI Coaching (Axiom)

**Free Tier:**
- Daily brief (template-based, metric-personalized)
- Weekly narrative (template-based)
- 50 PP per chat message
- 100 PP to trigger extra brief

**Pro Tier:**
- Unlimited LLM-powered coaching
- Real-time goal analysis
- Deep conversation context
- Priority response

**What Axiom Sees (Privacy-Preserving):**
- ✅ Check-in timestamps
- ✅ Goal progress percentages
- ✅ Streak length
- ✅ Social interaction counts
- ❌ Goal descriptions
- ❌ Journal entries
- ❌ Chat messages

### 6. Matching System

**Algorithm:**
```
For each user A:
  1. Get A's goal domains
  2. Find users with overlapping domains
  3. Score by:
     - Domain overlap (40%)
     - Goal name similarity (30%)
     - Streak proximity (20%)
     - Language match (10%)
  4. Return top 5 matches
```

**Match Actions:**
- View each other's goal trees (read-only)
- Give honor on completion
- Send direct messages
- Join same group sessions

### 7. Praxis Points Economy

**Earning PP:**
| Action | Points |
|--------|--------|
| Daily check-in | +10 |
| Complete goal | +50-500 (based on difficulty) |
| Give honor | +2 to +10 |
| Receive honor | +5 to +25 |
| Help match complete | +20 |
| Weekly streak bonus | +50 |

**Spending PP:**
| Item | Cost |
|------|------|
| Axiom chat message | 50 PP |
| Trigger extra brief | 100 PP |
| Super Honor | 20 PP |
| Streak freeze | 100 PP |
| Streak recovery | 200 PP |
| Profile customization | 50-200 PP |

### 8. Trackers

**Types:**
- **Habit Trackers:** Daily yes/no (meditation, exercise)
- **Metric Trackers:** Numerical (weight, pages read)
- **Mood Trackers:** 1-5 scale
- **Custom Trackers:** User-defined

**Integration:**
- Tracker entries count toward daily check-in
- Visual progress charts
- Correlation with goal progress

---

## Data Flow

### 1. User Registration Flow

```
POST /api/auth/signup
    │
    ├─→ Validate email/password
    │
    ├─→ Create Supabase Auth user
    │   └─→ Returns JWT + refresh token
    │
    ├─→ Create profile row
    │   └─→ Default: language=en, is_premium=false
    │
    ├─→ Create empty goal_tree row
    │
    └─→ Send welcome email
        └─→ Includes onboarding checklist
```

### 2. Goal Creation Flow

```
POST /api/goals/tree
    │
    ├─→ Validate goal structure
    │   └─→ Max depth: 5 levels
    │   └─→ Required: name, domain, progress
    │
    ├─→ Save to goal_trees.nodes (JSONB)
    │
    ├─→ Generate embeddings (fire-and-forget)
    │   └─→ For semantic matching
    │   └─→ Stored in goal_embeddings table
    │
    └─→ Trigger match recalculation
        └─→ Updates user's matches
```

### 3. Daily Check-in Flow

```
POST /api/checkins
    │
    ├─→ Check if already checked in today
    │   └─→ Return current streak if yes
    │
    ├─→ Increment streak counter
    │
    ├─→ Add 10 PP to profile
    │
    ├─→ Create checkin row
    │   └─→ Timestamp recorded
    │
    ├─→ Check for streak milestones
    │   └─→ 7, 30, 100, 365 days → bonus PP
    │
    └─→ Return updated streak + points
```

### 4. Axiom Brief Generation (Midnight Cron)

```
Cron: 00:00 local time
    │
    ├─→ Query active users (last 7 days)
    │
    ├─→ For each user:
    │   │
    │   ├─→ Calculate engagement metrics
    │   │   └─→ Archetype, motivation style, risks
    │   │
    │   ├─→ Generate metric-based brief
    │   │   └─→ Message by archetype
    │   │   └─→ Routine by motivation style
    │   │   └─→ Challenge by risk factor
    │   │
    │   ├─→ Pick best match/event/place
    │   │   └─→ Algorithmic scoring (no LLM)
    │   │
    │   └─→ Store in axiom_daily_briefs
    │
    └─→ Log completion
```

### 5. Match Notification Flow

```
User A completes goal
    │
    ├─→ POST /api/completions
    │
    ├─→ Get A's matches
    │
    ├─→ For each match:
    │   ├─→ Create notification
    │   │   └─→ "Your match completed X!"
    │   │
    │   └─→ Send push notification (if enabled)
    │
    └─→ Match can respond:
        ├─→ POST /api/honor/:targetId
        │   └─→ Both users get PP
        │
        └─→ POST /api/messages
            └─→ Creates DM thread
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| React | UI framework | 18.x |
| TypeScript | Type safety | 5.x |
| Material-UI | Component library | 5.x |
| React Router | Navigation | 6.x |
| Axios | HTTP client | 1.x |
| React Hot Toast | Notifications | 8.x |
| Supabase JS | Auth + Realtime | 2.x |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js | Runtime | 20.x |
| Express.js | Web framework | 4.x |
| TypeScript | Type safety | 5.x |
| Supabase JS | Database client | 2.x |
| node-cron | Scheduled jobs | 4.x |
| Winston | Logging | 3.x |
| JWT | Authentication | 9.x |
| bcrypt | Password hashing | 5.x |

### Database

| Technology | Purpose | Version |
|------------|---------|---------|
| PostgreSQL | Primary database | 15.x |
| pgvector | Semantic search | 0.5.x |
| Supabase | Managed Postgres | Latest |
| Realtime | WebSocket subscriptions | Built-in |

### AI/ML

| Technology | Purpose | Cost |
|------------|---------|------|
| Google Gemini | LLM for Axiom | $0.0002/1K tokens |
| DeepSeek | Fallback LLM | $0.0001/1K tokens |
| Custom embeddings | Goal matching | Included |

### Infrastructure

| Service | Purpose | Tier |
|---------|---------|------|
| Railway | Backend hosting | Starter ($5/mo) |
| Vercel | Frontend hosting | Pro ($20/mo) |
| Supabase | Database + Auth | Pro ($25/mo) |
| Stripe | Payments | Standard (2.9% + 30¢) |

---

## Database Schema

### Core Tables

```sql
-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT,
  bio TEXT,
  current_streak INTEGER DEFAULT 0,
  praxis_points INTEGER DEFAULT 0,
  language TEXT DEFAULT 'en',
  is_premium BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal trees (stored as JSONB nodes)
CREATE TABLE goal_trees (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  nodes JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily check-ins
CREATE TABLE checkins (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  streak_count INTEGER,
  UNIQUE(user_id, DATE(checked_in_at))
);

-- Engagement metrics cache (24h TTL)
CREATE TABLE engagement_metrics (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  metrics JSONB NOT NULL,
  calculated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- Axiom daily briefs
CREATE TABLE axiom_daily_briefs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  date DATE,
  brief JSONB NOT NULL,
  generated_at TIMESTAMPTZ,
  UNIQUE(user_id, date)
);

-- Social matches
CREATE TABLE matches (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  matched_user_id UUID REFERENCES profiles(id),
  match_score DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Honor transactions
CREATE TABLE honor (
  id UUID PRIMARY KEY,
  giver_id UUID REFERENCES profiles(id),
  receiver_id UUID REFERENCES profiles(id),
  target_id UUID,
  honor_type TEXT,
  points_transferred INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goal embeddings (for semantic matching)
CREATE TABLE goal_embeddings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  goal_node_id UUID,
  node_name TEXT,
  embedding VECTOR(768),
  UNIQUE(user_id, goal_node_id)
);
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/me` | Get current user |

### Goals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals/tree` | Get user's goal tree |
| POST | `/api/goals/tree` | Save goal tree |
| PUT | `/api/goals/tree` | Update goal tree |
| POST | `/api/goals/:id/complete` | Mark goal complete |

### Check-ins

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/checkins/today` | Check if checked in |
| POST | `/api/checkins` | Daily check-in |
| GET | `/api/checkins/history` | Get check-in history |

### AI Coaching

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai-coaching/brief` | Get daily brief |
| POST | `/api/ai-coaching/request` | Chat with Axiom |
| POST | `/api/ai-coaching/report` | Get coaching report |
| POST | `/api/ai-coaching/weekly-narrative` | Weekly recap |

### Social

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/matches` | Get user's matches |
| POST | `/api/honor/:targetId` | Give honor |
| DELETE | `/api/honor/:targetId` | Revoke honor |
| GET | `/api/messages` | Get conversations |
| POST | `/api/messages` | Send message |

### Points

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/points/balance` | Get PP balance |
| GET | `/api/points/catalogue` | Get spendable items |
| POST | `/api/points/spend` | Spend PP |

---

## Security & Privacy

### Authentication

- **JWT-based** with 1-hour expiry
- **Refresh tokens** stored HTTP-only
- **Supabase Auth** handles password hashing (bcrypt)
- **Google OAuth** supported

### Authorization

- **Row Level Security (RLS)** on all tables
- Users can only access their own data
- Admin role bypasses RLS for moderation

### Data Privacy

**What We Store:**
- ✅ Email (for auth)
- ✅ Goal names and progress
- ✅ Check-in timestamps
- ✅ Social connections

**What We Don't Store:**
- ❌ Payment info (Stripe handles)
- ❌ Passwords (Supabase handles)
- ❌ Message content encrypted at rest

**What We Don't Analyze:**
- ❌ Goal descriptions (for AI)
- ❌ Journal entries
- ❌ Chat messages
- ❌ Bio text

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/*` | 10 req | 1 minute |
| `/api/ai-coaching/*` | 30 req | 1 minute |
| `/api/checkins` | 5 req | 1 minute |
| All others | 100 req | 1 minute |

### Compliance

- **GDPR:** Right to deletion, data export
- **CCPA:** Opt-out of data selling (none occurs)
- **COPPA:** No users under 13 (ToS enforced)

---

## Monitoring & Observability

### Logging

- **Winston** for structured logging
- Levels: error, warn, info, debug
- PII automatically redacted

### Metrics Tracked

- Daily Active Users (DAU)
- Check-in rate
- Goal completion rate
- Axiom API calls
- Match success rate

### Alerts

- API error rate > 5%
- Database connection pool exhausted
- AI quota > 80%
- Payment failures

---

## Deployment

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=AIza...

# Optional
DEEPSEEK_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
ADMIN_SECRET=supersecret

# Feature Flags
ENABLE_AI_COACHING=true
MINIMAL_AI_MODE=false
```

### Deployment Steps

1. **Backend (Railway):**
   ```bash
   railway login
   railway up --detach
   ```

2. **Frontend (Vercel):**
   ```bash
   vercel login
   vercel --prod
   ```

3. **Database Migrations:**
   ```bash
   cd migrations
   supabase db push
   ```

---

## Support & Troubleshooting

### Common Issues

**"Axiom is offline"**
- Check `GEMINI_API_KEY` in Railway dashboard
- Verify AI Studio billing is active

**"Check-in failed"**
- User may have already checked in
- Timezone mismatch possible

**"Match not loading"**
- pgvector extension may not be enabled
- Run: `CREATE EXTENSION IF NOT EXISTS vector;`

### Contact

- **Email:** support@praxis.app
- **Docs:** https://docs.praxis.app
- **Status:** https://status.praxis.app

---

**Built with ❤️ by the Praxis Team**
