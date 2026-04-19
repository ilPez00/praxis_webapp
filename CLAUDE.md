# Praxis Webapp — CLAUDE.md

## Project

Praxis = daily goal journal + accountability buddy PWA. Goal tree = emotional living journal. Daily loop = morning brief, one-tap check-in, evening recap. Matching = sparring partner requests. Social proof = leaderboard, shareable snippets, embeddable streak widget.

## Architecture

- Backend: Express + TypeScript → `src/` → `dist/`
- Frontend: React + TypeScript + MUI v7 → `client/src/`
- Auth: Supabase JWT (service-role key backend, anon key frontend)
- Database: Supabase (Postgres), **snake_case** columns
- Deployment: Vercel (static React) + Railway (Express API)
- API base: `client/src/lib/api.ts` exports `API_URL`

## Coordination Docs

- `docs/DEV_PLAN.md` — features shipped, removed, proposed. Update when shipping or removing.
- `manual_actions.txt` — SQL migrations + env changes user must run. Update on every schema/env change.
- `git log --oneline -20` — check before making direction changes. Respect prior agent work unless user reverts.
- Commit often, clear messages.

## Code Conventions

- MUI v7 Grid: `<Grid size={{ xs: N, md: M }}>` (old API removed)
- theme.spacing: `theme.spacing(level * 2)` returns string
- Supabase columns: snake_case (`sender_id`, `receiver_id`, etc.)
- Import depths: `features/*/components/` → `../../../` to reach `src/models/`
- Onboarding guard: `user.onboarding_completed === false`
- API_URL: import from `../../lib/api`, never hardcode
- Set iteration: `Array.from(set)` not `for...of set`
- Array safety: guard `.map()` with `Array.isArray()` for API/DB data

## AI Policy

- Axiom daily briefs always use LLM (once-daily, fallback on failure)
- Matching = pure rule-based (domain overlap + progress similarity). No LLM.
- Grading, streaks, weights, analytics = local math
- Betting, streaks, leaderboard, goal tree viz = 100% AI-free

## Build & Run

```bash
# Backend
cd /home/gio/Praxis/praxis_webapp
npm run dev          # ts-node src/index.ts on :3001

# Frontend
cd client
npm start            # React dev server on :3000

# Type check
cd client && npx tsc --noEmit

# Build
cd client && npm run build
```
