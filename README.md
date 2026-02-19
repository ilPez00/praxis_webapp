# Praxis

**Hierarchical goal trees + algorithmic compatibility matching + mutual accountability.**

A social platform that matches users based on the semantic similarity and progress alignment of their personal goal trees, then enables peer accountability through real-time chat and a mutual grading system.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, MUI v7 (dark theme) |
| Backend | Node.js, Express, TypeScript |
| Database & Auth | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| AI | Google Gemini (embeddings for matching + AI coaching) |
| Payments | Stripe (subscription checkout + webhooks) |
| Styling | MUI dark theme, glassmorphism, Inter / Plus Jakarta Sans |

---

## Project Structure

```
praxis_webapp/
├── src/                        # Backend — Express API
│   ├── controllers/            # Route handlers
│   ├── middleware/             # authenticateToken (Supabase JWT)
│   ├── models/                 # TypeScript interfaces
│   ├── routes/                 # Express routers
│   ├── services/               # MatchingEngineService, EmbeddingService
│   ├── types/                  # Express request extensions
│   └── utils/                  # appErrors, logger, catchAsync
├── client/                     # Frontend — React app
│   └── src/
│       ├── components/common/  # Navbar, GlassCard
│       ├── features/           # Page components by domain
│       │   ├── auth/           # LoginPage, SignupPage, PrivateRoute
│       │   ├── dashboard/      # DashboardPage
│       │   ├── goals/          # GoalTreePage, GoalSelectionPage
│       │   ├── matches/        # MatchesPage
│       │   ├── chat/           # ChatPage (list), ChatRoom (1-1 chat)
│       │   ├── profile/        # ProfilePage
│       │   ├── analytics/      # AnalyticsPage (premium)
│       │   ├── onboarding/     # OnboardingPage, InitialGoalSetup
│       │   └── payments/       # UpgradePage, SuccessPage, CancelPage
│       ├── hooks/              # useUser
│       ├── lib/                # supabase.ts, api.ts (API_URL constant)
│       ├── models/             # TypeScript interfaces (User, GoalNode, etc.)
│       └── types/              # goal.ts (GoalNode, Domain, DOMAIN_COLORS)
├── claude_steps.txt            # Full development history and future roadmap
├── manual_actions.txt          # Required Supabase + Stripe setup steps
├── .env.example                # Backend env var template
└── client/.env.example         # Frontend env var template
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Supabase project
- (Optional) Stripe account, Google Gemini API key

### 1. Clone and install

```bash
git clone <repo-url>
cd praxis_webapp

# Backend
npm install

# Frontend
cd client && npm install && cd ..
```

### 2. Configure environment variables

**Backend** — copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # never expose to browser
GEMINI_API_KEY=<google_ai_studio_key>          # for matching + AI coaching
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLIENT_URL=http://localhost:3000
PORT=3001
```

**Frontend** — copy `client/.env.example` to `client/.env`:

```bash
cp client/.env.example client/.env
```

```env
REACT_APP_SUPABASE_URL=https://<your-project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon_key>         # safe to expose
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
REACT_APP_API_URL=http://localhost:3001         # change for production
```

### 3. Set up Supabase

Run the following SQL in the Supabase SQL Editor (Dashboard → SQL Editor):

```sql
-- Profiles table (created by trigger on signup)
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
  INSERT INTO public.profiles (id, name, age, bio)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    (NEW.raw_user_meta_data->>'age')::int,
    NEW.raw_user_meta_data->>'bio'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Messages table (required for chat)
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

Then enable **Realtime** on the `messages` table:
> Dashboard → Database → Replication → toggle `messages`

And create an **`avatars` storage bucket**:
> Dashboard → Storage → New bucket → name: `avatars` → Public: on → Save

### 4. Run

```bash
# In one terminal — backend (port 3001)
npm run dev

# In another terminal — frontend (port 3000)
cd client && npm start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Features

### Core Flow
- **Sign up / Log in** — Supabase email auth
- **Onboarding** — multi-step profile setup (name, age, bio, photo, interests)
- **Onboarding guard** — new users are redirected to `/onboarding` until `onboarding_completed = true`
- **Goal Selection** — pick up to 3 primary goals from 9 life domains; customize name and details
- **Goal Tree** — hierarchical tree visualization with per-node progress and weights

### Matching
- `GET /matches/:userId` — runs the compatibility engine against all other users
- **Algorithm** — cosine similarity on Gemini embeddings of goal descriptions × progress alignment × weight product (whitepaper §3.3)
- **Fallback** — domain overlap scoring when Gemini API is unavailable
- Filters: minimum compatibility %, domain

### Social & Accountability
- **1-on-1 chat** — real-time messaging via Supabase Realtime (`messages` table)
- **Feedback / grading** — after chatting, rate a partner's goal engagement (8-grade scale)
- **Achievements** — social feed of completed goals with upvote/downvote/comments
- **AI Coaching** — Gemini-powered advice on goals (premium)

### Payments
- Stripe Checkout for premium subscription
- Webhook handling for `checkout.session.completed`, `customer.subscription.*`
- Premium features: Advanced Analytics, AI Coaching

### Design
- Dark glassmorphism theme (amber-gold primary, electric violet secondary)
- `GlassCard` — reusable frosted-glass surface component with glow variants
- Domain color system: 9 colors mapped to life domains throughout the UI

---

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signup` | — | Create account |
| POST | `/auth/login` | — | Log in |
| GET | `/goals/:userId` | — | Fetch goal tree |
| POST | `/goals` | — | Save/update goal tree |
| GET | `/matches/:userId` | — | Get compatibility matches |
| GET | `/messages/:u1/:u2` | — | Fetch conversation |
| POST | `/messages/send` | — | Send message |
| POST | `/feedback` | — | Submit peer grade |
| GET | `/achievements` | — | Social feed |
| POST | `/ai-coaching/request` | JWT | AI coaching request |
| GET | `/analytics/*` | JWT | Premium analytics |
| POST | `/stripe/create-checkout-session` | — | Start upgrade flow |
| POST | `/stripe/webhook` | Stripe sig | Payment events |

Protected routes (`JWT`) require `Authorization: Bearer <supabase_access_token>`.

---

## Environment Variables Reference

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — **never expose to browser** |
| `GEMINI_API_KEY` | ✅ | Google AI Studio key for matching + coaching |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key |
| `STRIPE_PRICE_ID` | ✅ | Stripe recurring price ID |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe webhook signing secret |
| `CLIENT_URL` | ✅ | Frontend URL (for CORS + Stripe redirects) |
| `PORT` | — | Backend port (default: 3001) |

### Frontend (`client/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe publishable key |
| `REACT_APP_API_URL` | ✅ | Backend URL (default: `http://localhost:3001`) |

---

## Deployment

**Backend** → [Railway](https://railway.app) or [Render](https://render.com)
- Set all backend env vars in the dashboard
- Update `PORT` to `$PORT` (Railway provides it automatically)

**Frontend** → [Vercel](https://vercel.com)
- Set `REACT_APP_API_URL` to your deployed backend URL
- Set all `REACT_APP_*` env vars in the Vercel project settings

**Stripe webhooks** → Update endpoint URL to `https://your-backend.railway.app/stripe/webhook`

---

## Development Notes

- `claude_steps.txt` — full development history, architectural decisions, and roadmap (Steps 10–15)
- `manual_actions.txt` — complete Supabase and Stripe setup checklist
- Both frontend and backend compile with **0 TypeScript errors** (`npx tsc --noEmit`)
- The matching engine requires `GEMINI_API_KEY` for full accuracy; falls back to domain-overlap scoring when unavailable
