# Praxis Webapp — CLAUDE.md

## What Is This Project
Praxis is a daily goal journal + accountability buddy PWA. Goal tree = emotional living journal (notes, mood, AI recaps, visual evolution). Daily loop = morning brief, one-tap check-in, evening recap. Matching = active sparring partner requests. Social proof = public leaderboard, shareable snippets, embeddable streak widget.

## Architecture
- **Backend:** Express + TypeScript — source in `src/`, compiles to `dist/`
- **Frontend:** React + TypeScript + MUI v7 — source in `client/src/`
- **Auth:** Supabase JWT — backend uses service-role key, frontend uses anon key
- **Database:** Supabase (Postgres) — all columns are **snake_case**
- **Deployment:** Vercel (static React) + Railway (Express API)
- **API base:** `client/src/lib/api.ts` exports `API_URL` — never hardcode `localhost:3001`

## Multi-Agent Workflow
This project is developed by three CLI agents: **Claude Code**, **Gemini CLI**, and **Qwen CLI**. Follow these rules:

1. **Check `claude_steps.txt` at the start of every session** — it is the canonical dev log and task list. Read it before doing anything.
2. **Update `claude_steps.txt` at the end of every session** — append a session block with: session number, date, summary of changes, files modified, verification status, and next steps. Sign it `- Sign: Claude`.
3. **Never contradict work done by another agent** — read recent git history (`git log --oneline -20`) before making architectural decisions. If Gemini or Qwen made a change, respect it unless the user explicitly says to revert.
4. **Commit often** — at natural milestones, commit with clear messages. The other agents need to see your work in git.
5. **Update `manual_actions.txt`** if you create SQL migrations or require env var changes.
6. **Coordinate via files, not assumptions** — if you need the next agent to do something, write it in `claude_steps.txt` under "Next Steps".

## Critical Code Conventions
- **MUI v7 Grid:** `<Grid size={{ xs: N, md: M }}>` — the old `<Grid item xs={N}>` API is removed
- **theme.spacing:** `theme.spacing(level * 2)` — returns a string, don't multiply strings
- **Supabase columns:** always snake_case (`sender_id`, `receiver_id`, `avatar_url`, etc.)
- **Import depths:** files in `features/*/components/` need `../../../` to reach `src/models/`
- **Onboarding guard:** `user.onboarding_completed === false` (strict, so `undefined` doesn't trigger)
- **API_URL:** import from `../../lib/api` (depth varies by file), never hardcode URLs
- **Set iteration:** use `Array.from(set)` not `for...of set` (TS target doesn't support downlevel iteration)
- **Array safety:** always guard `.map()` calls with `Array.isArray()` when data comes from API/DB

## Minimal AI Policy
- **Default: no LLM calls.** Matching = pure rule-based (domain overlap + progress similarity). Grading, streaks, weights, analytics = local math / simple backend functions.
- **AI is opt-in:** template-based coaching by default. Real LLM calls (Gemini/DeepSeek) only when user clicks "Axiom Boost" (premium feature).
- **`minimal_ai_mode`** toggle in settings (default TRUE). Respect it in all AI-related code paths.
- Betting, streaks, leaderboard, goal tree visualization = 100% AI-free, always.

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

## Session Logging Format (for claude_steps.txt)
```
Session N: <Title>
- <What changed, one bullet per logical change>
- Files: <list of modified files>
- Verification: <type check / build / test status>
- Next: <what the next session should tackle>
- Sign: Claude
```

## Remember
- Read `claude_steps.txt` FIRST.
- Commit and update `claude_steps.txt` LAST.
- Never modify the "Never modify this paragraph" block in `claude_steps.txt`.
