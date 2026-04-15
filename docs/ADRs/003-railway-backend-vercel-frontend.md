# ADR 003 — Railway for Express backend, Vercel for React frontend

## Context

Praxis has a persistent Express server (WebSocket-ish real-time via Supabase Broadcast, Stripe webhooks, cron-like Axiom brief generation) and a static-ish React SPA. A single-platform deploy (e.g., both on Vercel) would be simpler operationally, but each platform has different strengths.

Vercel's serverless model is great for edge routes and ISR but adds cold-start pain for long-lived Express middleware state. Railway runs a real always-on Node process, which matches the existing codebase without rewrites.

## Decision

- **Backend (Express) → Railway.** Deployed from `main` via `railway.toml`. Runs as one long-lived Node process. `/health` endpoint for the Railway healthcheck.
- **Frontend (Vite build) → Vercel.** Static deploy. `vercel.json` contains a proxy rewrite `/api/*` → Railway URL as a **backup** path. Primary path is the client calling Railway directly via `REACT_APP_API_URL`.
- **No shared deploy step.** Both redeploy independently on `git push origin main`.

## Consequences

- ✅ No refactor cost: Express stays Express, no serverless-ification.
- ✅ Stripe webhooks, cron jobs, and Supabase broadcast subscriptions survive across requests (wouldn't survive cold-start on pure serverless).
- ✅ Vercel gives free static hosting + CDN for the SPA; Railway is the right tool for the backend.
- ❌ Two deploy surfaces means two sets of env vars, two dashboards, two places a production failure can originate.
- ❌ CORS and env-var baking must match across both. See `RUNBOOK.md §6` — the most common production failure is `REACT_APP_API_URL` missing at Vercel build time.
- ❌ Domain routing is fronted by Vercel (via the proxy rewrite); if Railway is down, the proxy fails rather than the SPA degrading gracefully.

## Migration prerequisites before moving to a single platform

If a buyer wants everything on one platform post-acquisition, the cleanest path is:

1. Convert Express to Next.js route handlers or Fastify on Fluid Compute (~2 weeks).
2. Replace Supabase Broadcast signaling with Vercel Queues or a third-party (Pusher, Ably).
3. Move Stripe webhook handler into the new runtime; re-register webhook endpoint with Stripe.
4. Move cron-like Axiom brief generator to Vercel Crons (`crons` in `vercel.ts`).

None of this is required today, and the current split works fine.
