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

## Multi-Agent Workflow

Three CLI agents: **Claude Code**, **Gemini CLI**, **Qwen CLI**.

1. **Check `claude_steps.txt` session start** — canonical dev log/task list.
2. **Update `claude_steps.txt` session end** — append: session#, date, change summary, files, verification, next steps. Sign `- Sign: Claude`.
3. **Never contradict other agent work** — `git log --oneline -20` before decisions. Respect unless user reverts.
4. **Commit often** — clear messages for visibility.
5. **Update `manual_actions.txt`** for SQL migrations/env changes.
6. **Coordinate via files** — write needs in `claude_steps.txt` "Next Steps".

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

## Session Format (claude_steps.txt)

```
Session N: <Title>
- <change>
- Files: <list>
- Verification: <status>
- Next: <next session task>
- Sign: Claude
```

## Remember

- Read `claude_steps.txt` FIRST.
- Commit and update `claude_steps.txt` LAST.
- Never modify "Never modify this paragraph" block.
