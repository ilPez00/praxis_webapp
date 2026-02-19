# Praxis

> **Goal-aligned matching. Real-time accountability.**

Praxis is a social platform that matches people based on the semantic similarity and progress alignment of their personal goal trees — then enables peer accountability through real-time chat and a mutual grading system.

The core thesis: the right accountability partner isn't someone who *likes* the same things as you. It's someone who is *working toward the same outcomes* at a similar pace, in the same domains, at a similar level of commitment. Praxis finds them algorithmically.

---

## What it does

### 1. Goal Tree
You build a hierarchical tree of personal goals, organized by life domain (Career, Fitness, Investing, Academics, Mental Health, etc.). Each node has:
- A title and description
- A **weight** (how much of your focus it gets, 0–1)
- A **progress** percentage (0–100%)
- An optional category and details

### 2. Algorithmic Matching
The matching engine compares your goal tree against every other user's tree. Compatibility score `S_AB` is computed as:

```
S_AB = Σ( sim(i,j) × W_i × W_j ) / Σ( W_i × W_j )
```

Where `sim(i,j)` = cosine similarity of Gemini text embeddings × progress alignment factor. Only same-domain node pairs are compared.

When `GEMINI_API_KEY` is unavailable, a domain-overlap fallback kicks in:
```
score = (shared_domains / max_domains) × 0.7
      + (1 − avg_progress_diff) × 0.3
```

### 3. Accountability Chat
Matches with high compatibility scores can open a 1-on-1 chat. Messages are stored in Supabase and delivered in real-time via Supabase Realtime subscriptions.

### 4. Mutual Grading
After a chat session, both parties grade each other's goal engagement using an 8-point scale (SUCCEEDED / LEARNED / ADAPTED / DISTRACTED / …). Grades trigger automatic weight recalibration in the recipient's goal tree, so the tree evolves to reflect peer feedback over time.

### 5. Achievements & Community Feed
When you reach 100% progress on a goal, you can publish it as an achievement. Other users can upvote, downvote, and comment — creating a community accountability feed.

### 6. Premium Features (Stripe)
- AI Coaching via Gemini generative model
- Advanced Analytics (comparison data, progress trends)
- Unlimited goals (free tier capped at 3 root goals)

---

## Current Status

| Area | Status | Notes |
|------|--------|-------|
| Frontend (React + TypeScript) | ✅ Compiles, 0 errors | Runs on :3000 |
| Backend (Express + TypeScript) | ✅ Compiles, 0 errors | Requires Supabase credentials to start |
| Goal Tree UI | ✅ Working | Add/edit/delete nodes, progress & weight sliders |
| Matching engine | ✅ Working | Gemini embeddings + domain-overlap fallback |
| Real-time chat | ✅ Working | Supabase Realtime on `messages` table |
| Auth + onboarding | ✅ Working | Supabase email auth, onboarding guard |
| Premium payments | ✅ Working | Stripe Checkout, webhooks, `is_premium` flag |
| AI Coaching | ✅ Working | Premium-gated, Gemini generative model |
| Analytics | ✅ Working | Premium-gated endpoints |
| Matches page | ✅ Working | Shows mock data until backend returns real matches |
| Demo user seeding | ✅ Built | `POST /admin/seed-demo-users` (requires `ADMIN_SECRET`) |
| Deployment | 🔴 Not deployed | Railway (backend) + Vercel (frontend) — instructions in `manual_actions.txt` |
| GitHub push | 🔴 Pending | SSH key needs to be authorized at github.com/settings/keys |

**To run locally:** The frontend starts immediately. The backend requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env`. See [Quick Start](#quick-start) below.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, MUI v7 (dark glassmorphism theme) |
| Backend | Node.js, Express, TypeScript |
| Database + Auth | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| AI | Google Gemini (embeddings for matching, generative for coaching) |
| Payments | Stripe (Checkout + webhooks) |
| Fonts | Inter (body), Plus Jakarta Sans (headings) |

---

## Project Structure

```
praxis_webapp/
├── src/                         # Backend — Express API
│   ├── controllers/             # Route handlers
│   ├── middleware/              # authenticateToken (Supabase JWT)
│   ├── models/                  # TypeScript interfaces
│   ├── routes/                  # Express routers
│   ├── services/                # MatchingEngineService, EmbeddingService
│   ├── types/                   # Express request type extensions
│   └── utils/                   # appErrors, logger, catchAsync
├── client/                      # Frontend — React app
│   └── src/
│       ├── components/common/   # Navbar, GlassCard
│       ├── data/                # mockMatches.ts (demo profiles)
│       ├── features/            # Page components by domain
│       │   ├── auth/            # LoginPage, SignupPage, PrivateRoute
│       │   ├── dashboard/       # DashboardPage (achievements feed + AI coaching)
│       │   ├── goals/           # GoalTreePage, GoalSelectionPage
│       │   ├── matches/         # MatchesPage (compatibility cards)
│       │   ├── chat/            # ChatPage (list), ChatRoom (1-1 real-time)
│       │   ├── profile/         # ProfilePage (edit + premium badge)
│       │   ├── analytics/       # AnalyticsPage (premium)
│       │   ├── onboarding/      # OnboardingPage, InitialGoalSetup
│       │   └── payments/        # UpgradePage, SuccessPage, CancelPage
│       ├── hooks/               # useUser (auth + profile)
│       ├── lib/                 # supabase.ts, api.ts (API_URL constant)
│       ├── models/              # TypeScript interfaces (User, GoalNode, etc.)
│       └── types/               # goal.ts (GoalNode, Domain, DOMAIN_COLORS)
├── run_praxis.sh                # One-command dev launcher
├── Procfile                     # Railway deployment (web: node dist/index.js)
├── gemini_steps.txt             # Full dev log + roadmap (Claude's working memory)
├── manual_actions.txt           # Step-by-step Supabase + Stripe + deployment setup
├── .env.example                 # Backend env var template
└── client/.env.example          # Frontend env var template
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)
- (Optional) Stripe account, Google Gemini API key

### 1. Clone and install

```bash
git clone https://github.com/ilPez00/praxis_webapp.git
cd praxis_webapp

npm install            # backend
cd client && npm install && cd ..
```

### 2. Configure environment variables

**Backend** (`/.env`):
```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:
```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # from Supabase Dashboard → Settings → API
CLIENT_URL=http://localhost:3000

# Optional but needed for full functionality:
GEMINI_API_KEY=...                 # Google AI Studio
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
ADMIN_SECRET=some-long-random-string
```

**Frontend** (`/client/.env`) — already configured if you cloned with the existing `.env`:
```bash
cp client/.env.example client/.env
```

Fill in:
```env
REACT_APP_SUPABASE_URL=https://<your-project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...   # anon/public key
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
REACT_APP_API_URL=http://localhost:3001
GENERATE_SOURCEMAP=false
```

### 3. Set up Supabase

Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  age INT,
  bio TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, bio, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'bio',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id),
  receiver_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  goal_node_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
```

Then:
1. **Enable Realtime** on `messages`: Dashboard → Database → Replication → toggle `messages`
2. **Create `avatars` bucket**: Dashboard → Storage → New bucket → name: `avatars`, Public: on

### 4. Run

```bash
# Option A — use the launcher script (recommended)
./run_praxis.sh

# Option B — two terminals
npm run dev              # backend on :3001
cd client && npm start   # frontend on :3000
```

Frontend: http://localhost:3000
Backend health: http://localhost:3001

---

## What to expect on first run

**Frontend** starts in ~30 seconds. You'll see:
- `Compiled with warnings` — source map warnings from `face-api.js` (harmless, suppressed by `GENERATE_SOURCEMAP=false`)
- The app is usable without the backend for browsing pages

**Backend** requires valid Supabase credentials. If it crashes:
```
Error: Supabase URL and Service Role Key are required
```
→ Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env` (see `manual_actions.txt` Step 2).

**Matches page** shows 7 sample profiles with compatibility scores even without a backend — so the UI is immediately demonstrable.

---

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | — | Create account |
| POST | `/auth/login` | — | Log in |
| GET | `/goals/:userId` | — | Fetch goal tree |
| POST | `/goals` | — | Save/update goal tree |
| GET | `/matches/:userId` | — | Run compatibility engine |
| GET | `/messages/:u1/:u2` | — | Fetch conversation |
| POST | `/messages/send` | — | Send message |
| POST | `/feedback` | — | Submit peer grade |
| GET | `/achievements` | — | Community feed |
| POST | `/ai-coaching/request` | JWT | AI coaching (premium) |
| GET | `/analytics/*` | JWT | Analytics (premium) |
| POST | `/stripe/create-checkout-session` | — | Start Stripe Checkout |
| POST | `/stripe/webhook` | Stripe sig | Handle payment events |
| POST | `/admin/seed-demo-users` | X-Admin-Secret | Seed 7 demo profiles |

Protected routes (`JWT`) require `Authorization: Bearer <supabase_access_token>`.

---

## Environment Variables

### Backend (`/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — **never expose to browser** |
| `GEMINI_API_KEY` | ✅* | Google AI Studio key (*optional: matching falls back to domain overlap) |
| `STRIPE_SECRET_KEY` | ✅* | Stripe secret key (*optional: payments disabled without it) |
| `STRIPE_PRICE_ID` | ✅* | Stripe recurring price ID |
| `STRIPE_WEBHOOK_SECRET` | ✅* | Stripe webhook signing secret |
| `CLIENT_URL` | ✅ | Frontend URL (CORS + Stripe redirects) |
| `ADMIN_SECRET` | — | Guards `POST /admin/seed-demo-users` |
| `PORT` | — | Backend port (default: 3001) |

### Frontend (`/client/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_SUPABASE_URL` | ✅ | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key (safe to expose) |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | — | Stripe publishable key |
| `REACT_APP_API_URL` | ✅ | Backend URL (default: `http://localhost:3001`) |
| `GENERATE_SOURCEMAP` | — | Set `false` to suppress face-api.js warnings |

---

## Deployment

**Backend → [Railway](https://railway.app)**
- `Procfile` already committed: `web: node dist/index.js`
- Build command: `npm install && npm run build`
- Set all backend env vars in Railway Variables panel
- Railway auto-injects `PORT` — do not set it manually

**Frontend → [Vercel](https://vercel.com)**
- Set Root Directory to `client/`
- Framework: Create React App
- Set `REACT_APP_API_URL` to your Railway backend URL
- Set all `REACT_APP_*` env vars in Vercel project settings

**Full deployment walkthrough:** see `manual_actions.txt` Steps 11–13.

---

## Architecture Notes

- **Auth flow:** Frontend uses anon Supabase client (JWT in browser localStorage). Backend uses service-role client to verify JWTs server-side via `authenticateToken` middleware.
- **Matching:** O(|A.nodes| × |B.nodes|) Gemini embedding calls per user pair, with in-request caching. Falls back to domain-overlap scoring when `GEMINI_API_KEY` is unset or Gemini API fails.
- **Real-time:** Supabase Realtime postgres_changes subscription in `ChatRoom.tsx`. The `messages` table must have Realtime enabled (Dashboard → Database → Replication).
- **MUI v7:** Grid API changed — use `<Grid size={{ xs: N, md: M }}>`, not `<Grid item xs={N}>`.
- **All axios calls** use `${API_URL}` from `client/src/lib/api.ts`. Change `REACT_APP_API_URL` for production.

---

## Development History

Full session-by-session log in `gemini_steps.txt` (Sessions 1–9 built by Gemini CLI, Sessions 10–13 by Claude Code).

Setup and deployment checklist in `manual_actions.txt`.
