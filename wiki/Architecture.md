# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                              │
│   React SPA (Vercel / GitHub Pages)   Android App (Kotlin)  │
└───────────────────┬─────────────────────────────────────────┘
                    │  HTTPS / JWT
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Express 5 API  (Railway)                        │
│  /api/users  /api/goals  /api/matches  /api/messages        │
│  /api/groups /api/posts  /api/coaching /api/completions     │
└──────────┬───────────────────────────────────┬──────────────┘
           │ Supabase JS (service role)         │ Gemini SDK
           ▼                                   ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│   Supabase (PostgreSQL)   │       │   Google Gemini API      │
│   + pgvector extension    │       │   Embeddings + Coaching  │
│   + Realtime channels     │       └──────────────────────────┘
│   + Storage (avatars,     │
│     chat-media)           │
└──────────────────────────┘
```

---

## Directory Structure

```
praxis_webapp/
├── src/                        # Express backend (TypeScript)
│   ├── index.ts                # Entry point — Express app, middleware, routes
│   ├── controllers/            # Route handlers (business logic)
│   │   ├── userController.ts
│   │   ├── goalController.ts
│   │   ├── matchController.ts
│   │   ├── messageController.ts
│   │   ├── groupController.ts
│   │   ├── postController.ts
│   │   ├── coachingController.ts
│   │   └── completionController.ts
│   ├── routes/                 # Express routers
│   ├── middleware/             # Auth (authenticateToken), error handler
│   └── lib/                   # Supabase admin client, Gemini client
│
├── client/                     # React frontend (TypeScript)
│   └── src/
│       ├── AppRouter.tsx       # BrowserRouter + route map
│       ├── config/routes.tsx   # All route definitions
│       ├── features/           # Feature-based modules
│       │   ├── auth/           # Login, Signup, PrivateRoute
│       │   ├── dashboard/      # Dashboard (streak, matches, goals)
│       │   ├── goals/          # Goal tree visualization + selection
│       │   ├── matches/        # Match cards
│       │   ├── chat/           # DM chat, media, video calls
│       │   ├── groups/         # Community groups
│       │   ├── posts/          # Reddit-style boards
│       │   ├── coaching/       # AI coach
│       │   ├── analytics/      # Progress analytics (premium)
│       │   ├── payments/       # Stripe upgrade flow
│       │   └── onboarding/     # First-time user flow
│       ├── components/         # Shared UI components
│       ├── hooks/              # useUser, useAuth
│       ├── lib/
│       │   ├── api.ts          # API_URL constant
│       │   └── supabase.ts     # Supabase anon client
│       ├── models/             # Domain enum, shared types
│       └── types/              # GoalNode, User, etc.
│
├── migrations/
│   └── setup.sql               # Idempotent DB migration
├── wiki/                       # GitHub Wiki source files
└── vercel.json                 # Vercel deployment config
```

---

## Authentication Flow

```
User signs up/in via Supabase Auth
         │
         ▼
Supabase issues JWT (stored in localStorage via @supabase/supabase-js)
         │
         ▼
Frontend: useUser hook reads auth.getUser() → fetches profiles row
         │
         ▼
API calls: Authorization: Bearer <jwt> header on every request
         │
         ▼
Backend middleware: supabase.auth.getUser(token) → sets req.user
```

The `PrivateRoute` component in React redirects unauthenticated users to `/login`. It also enforces the onboarding gate: users with `onboarding_completed === false` are redirected to `/onboarding`.

---

## Matching Algorithm

Based on §3.3 of the Praxis whitepaper. Similarity between users A and B:

```
S_AB = Σ(sim_ij × w_i × w_j) / Σ(w_i × w_j)
```

Where:
- `sim_ij` = cosine similarity between Gemini text embeddings of goal nodes i (user A) and j (user B)
- `w_i`, `w_j` = weights of goal nodes (sum to 1 per user)

**Fallback:** When embeddings aren't available, domain-overlap matching is used (counts shared domains between users' goal trees).

Embeddings are stored in the `goal_embeddings` table using the `pgvector` extension, with a `match_users_by_goals` SQL function for efficient nearest-neighbor search.

---

## Weight Recalibration

Based on §3.5 of the whitepaper. After peer feedback on a goal, node weights are adjusted:

| Feedback | Multiplier |
|----------|-----------|
| SUCCEEDED | 0.8× (goal less prominent — you achieved it) |
| DISTRACTED | 1.2× (goal needs more focus) |
| ABANDONED | 0.5× (goal deprioritized) |

Weights are renormalized across the tree after each adjustment.

---

## Real-time Architecture

Supabase Realtime is used for:
- **DM chat**: channel `chat:{user1id}-{user2id}` (sorted), postgres_changes on `messages`
- **Group chat**: channel `group:{roomId}`, broadcast events
- **Video call signaling**: channel `webrtc_{user1id-user2id-sorted}`, broadcast events (`webrtc-offer`, `webrtc-answer`, `webrtc-ice`, `call-ended`)
- **Call invites**: broadcast on the chat channel (`call-invite` event)

---

## Premium Gating

| Feature | Free | Premium |
|---------|------|---------|
| Goal tree creation | 1 free edit | Unlimited |
| Root goals | Up to 3 | Unlimited |
| Analytics | Basic | Advanced |
| AI coaching | — | Full report |
| Matching | Standard | Priority |

Premium is managed via Stripe Checkout. On successful payment, the webhook updates `user_subscriptions` table and sets `profiles.is_premium = true`.
