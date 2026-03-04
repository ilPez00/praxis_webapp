# Praxis — Private Beta

Praxis is an accountability partnership platform. Users define goal trees, get matched with partners by semantic alignment, and hold each other accountable via betting, streak tracking, and structured check-ins.

---

## Private Beta Instructions

1. Sign up at the Vercel URL (see below)
2. Complete onboarding — add your name, bio, and age
3. Build your goal tree (3 goals max on the free tier)
4. Tap **Find Matches** — the AI scores partners by goal overlap
5. Open a direct message with a match and propose your first accountability bet

---

## Deployment

### Backend → Railway

Set the following environment variables in your Railway service:

| Variable | Description |
|---|---|
| `PORT` | Port for Express server (Railway injects automatically) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (not the anon key) |
| `GEMINI_API_KEY` | Google Gemini API key for embeddings + AI coach |
| `STRIPE_SECRET_KEY` | Stripe secret key for subscription billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `FRONTEND_URL` | Vercel deployment URL (for CORS) |
| `NODE_ENV` | `production` |

Deploy steps:
1. Connect the `praxis_webapp` GitHub repo to a Railway project
2. Railway auto-detects `railway.toml` and uses nixpacks
3. Set env vars above in the Railway dashboard
4. Deploy — the health endpoint is `/health`

### Frontend → Vercel

1. Import `praxis_webapp/client` as the Vercel root directory
2. Vercel auto-detects `vercel.json` (CRA, `build/` output, SPA rewrites)
3. Set env vars:

| Variable | Description |
|---|---|
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `REACT_APP_API_URL` | Railway backend URL |

4. Deploy

---

## Local Development

```bash
# Backend
cd praxis_webapp
npm install
cp .env.example .env   # fill in env vars
npm run dev            # ts-node-dev on port 3001

# Frontend
cd praxis_webapp/client
npm install
cp .env.example .env   # REACT_APP_* vars
npm start              # CRA dev server on port 3000
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, MUI v6 |
| Backend | Node.js, Express, TypeScript |
| Database | Supabase (Postgres + pgvector + Realtime) |
| Auth | Supabase Auth (email/password) |
| AI | Google Gemini (`embedding-001` for matching, `gemini-pro` for coach) |
| Payments | Stripe (subscriptions) |
| Deploy (API) | Railway (nixpacks) |
| Deploy (Web) | Vercel (CRA) |
| Mobile | Android (Kotlin, Jetpack Compose, Material3) |
