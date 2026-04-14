# Asset-Prep Plan — Turning Praxis from Project to Asset

**Date:** 2026-04-14
**Context:** User asked what would make Praxis sellable. Existing `docs/sale-readiness-report.md` and `docs/acquisition-packet.md` already describe the pitch. This plan is the execution list for the gaps those docs don't close on their own.

## Thesis

An asset is something a buyer can (a) value with a number, (b) run without you, (c) inherit cleanly. Praxis has the product and the story; the gaps are **legibility**, **operability**, and **focus**. Every item below maps to one of those three.

---

## P0 — This week (autonomous, no business decisions required)

### Repo hygiene

- [x] **Move ~60 stray files out of repo root** into `docs/archive/{screenshots,sql,notes}` and `docs/{business,features}`. A buyer's first scroll of the root is their first impression. Done in this session.
- [ ] **Delete dup dev logs**: `claude_steps.md` and `CLAUDE_STEPS.md` duplicate `claude_steps.txt` (the canonical file per `CLAUDE.md`).
- [ ] Confirm all `.gitignore` entries cover secret-looking local files (`praxis_auth*`, `supabase_praxis_client*`, `.env*`). Verify none are tracked.

### Technical legibility (audit, don't fix yet)

- [ ] Run `npx license-checker --production --summary` on both `/` and `/client`. Capture result in `docs/compliance/licenses.md`. Flag GPL/AGPL if any.
- [ ] `grep -rn ": any" client/src src | wc -l` — capture number. Asset-grade target: <50 near auth/money, <200 total.
- [ ] `trufflehog filesystem . --no-verification` (or `gitleaks detect`) to scan history for accidental secrets.
- [ ] `jest --listTests | wc -l` + same for playwright — capture test count as baseline.

### Operational legibility

- [ ] **Write `RUNBOOK.md`** at repo root: 1-command bring-up (env needed, `npm i`, `npm run dev`, how to seed DB), emergency rollback, where production is deployed, how Stripe webhook is registered, how to rotate service-role key.
- [ ] **Consolidate deployment docs**: `DEPLOYMENT_GUIDE.md`, `DEPLOYMENT_READY.md`, `docs/MIGRATION_FLY.md`, `docs/MIGRATION_RENDER.md` — keep one canonical `docs/DEPLOYMENT.md`, archive the rest.

---

## P1 — Next 2 weeks (still autonomous where possible)

### De-risk the "anyone can run this" test

- [ ] Replace hardcoded Railway URL fallback in `client/src/lib/api.ts` with `throw` when `REACT_APP_API_URL` missing in production build. **(Ask Gio first — prior session notes say this fallback was load-bearing for Vercel env-var flakiness.)**
- [ ] Migrations as code: audit 60+ SQL files in `migrations/` — are they run in order? Is there a runner? If not, write `scripts/run-migrations.ts` that tracks which ran via a `schema_migrations` table. Replace "run this in Supabase" step from `manual_actions.txt` with a single `npm run migrate`.
- [ ] **Bootstrap script**: `scripts/bootstrap.sh` → installs, creates `.env` from `.env.example`, prompts for Supabase keys, seeds DB. Target: clone-to-running in <5 min.

### Test the money paths (target coverage, not coverage %)

- [ ] Add tests for:
  - `POST /stripe/webhook` — PP purchase credits balance once, not twice (idempotency)
  - `POST /auth/login` — invalid creds return 401, not 500
  - `POST /checkins` — second call same day doesn't double-count
  - `POST /points/spend` — insufficient balance rejected, successful spend decrements once
- [ ] Pin Node version in `package.json` `engines`.

### ADRs for the 5 weirdest decisions

Write one-pagers in `docs/ADRs/`:

- [ ] Why `snake_case` DB columns but `camelCase` TS types (+ converter location)
- [ ] Why service-role key on backend, anon on frontend (security model)
- [ ] Why Railway (backend) + Vercel (frontend) instead of one platform
- [ ] Points economy formula (streak multipliers, completion awards) and why these numbers
- [ ] Matching is pure rule-based, not LLM (per `CLAUDE.md` AI policy)

---

## P2 — Requires your input

### Narrative compression (biggest valuation delta)

Praxis currently runs ~15 surfaces: goal trees, journaling, matching, groups, boards, video calls, betting, services marketplace, events, geolocation, referrals, points, leaderboard, challenges, posts, achievements, axiom coaching. Buyers compress this to one sentence — let's make sure the sentence lands well.

**Pick one primary thesis:**

- (a) **"Daily accountability journal"** — B2C subscription. Core = goal tree + check-ins + axiom briefs. Everything else becomes "labs".
- (b) **"Peer accountability network"** — marketplace/social. Core = matching + verification + leaderboard. Everything else demoted.
- (c) **"Goal coaching platform"** — B2B. Core = services marketplace + axiom + verification flow. Pivot pricing.

Decision input: which of these matches the actual traction in `/admin/metrics`?

### Distribution artifacts

- [ ] Email list opt-in at signup (Mailchimp/Resend). Opt-in rate + list size is ~40% of acquisition price on micro-exits.
- [ ] SEO: public notebook pages (`/notes/:userId` already exists) need OpenGraph tags, sitemap, `robots.txt` — free acquisition = real moat.
- [ ] One integration partner logo (gym, coach, wellness org). Converts "B2C app" to "has channel."

### Legal / transferability

- [ ] GDPR-compliant Terms + Privacy Policy (Iubenda, ~€27/yr). EU-based means this is load-bearing.
- [ ] Move domain, Vercel, Railway, Supabase, Stripe to a business email (`ops@praxis.app`, not personal Gmail).
- [ ] EU trademark "Praxis" if you want the name as part of the asset (€850, ~5mo).
- [ ] SRL or Ltd + business bank account. Personal-Stripe MRR is unsellable — buyer can't inherit the merchant.

### Analytics instrumentation

- [ ] PostHog events on: signup, first check-in, first goal created, day-7 retention hit, subscription started. Buyers ignore metrics without an independent source.

---

## P3 — Pre-listing checklist (only when ready to list)

- [ ] Last 30-day P&L
- [ ] Cost breakdown (Supabase, Railway, Vercel, AI calls, Stripe fees)
- [ ] DAU/WAU ratio screenshot × 4 consecutive weeks
- [ ] Acquisition memo (1-pager): thesis, numbers, tech, unit economics, growth channels
- [ ] Remove `claude_steps.txt` / `gemini_steps.txt` / multi-agent narrative from repo. Move to private Notion. ("AI-slopped" reads as risk to buyers.)
- [ ] Commit a final "v1.0.0" tag. Shows the asset has a stable point, not infinite WIP.

---

## Sequencing rationale

P0 is all autonomous cleanup + audits — nothing depends on you. P1 is mostly autonomous but one item (`api.ts` fallback) needs your sign-off. P2 is where your business decisions shape everything (thesis choice cascades into what gets cut). P3 is the day you actually list.

If you only do P0 + P1, valuation probably lifts 1.5–2× from current state (cleaner code, clearer ops, demonstrable tests on money paths). P2 is where 3–5× happens — narrative compression + distribution artifacts.
