# Praxis — Development Plan

> Snapshot: 2026-04-19. Authoritative roadmap doc. Pairs with `claude_steps.txt` (session log) and `manual_actions.txt` (DB/env changes). Update this file when shipping, removing, or proposing major features.

---

## 1. Currently Shipped (live in main)

Core product surface as of this snapshot. Each bullet names the feature and where it lives in the codebase.

### Identity & Onboarding

- **Supabase JWT auth** — backend service-role key, frontend anon key (`client/src/hooks/useUser.ts`)
- **@username at onboarding** — format + uniqueness validation, persisted in `profiles.username`
- **Onboarding flow** — multi-step (domain selection → goal scaffold → avatar → @username)
- **Profile public view** + reliability score + location detect (Nominatim reverse geocode)

### Goal System (The Notebook)

- **Goal tree / Notebook** — JSONB `goal_trees.nodes`, recursive parent/child, weighted progress roll-up
- **Goal metadata** — `completionMetric`, `targetDate`, `customDetails` (description)
- **Peer verification** — DM card "Verify/Reject" → auto-achievement on approve (`completionController.ts`)
- **Premium gate** — `goal_tree_edit_count` enforces 1 free re-edit, admin bypass
- **Marketplace slot expansion** — buy extra root-goal slots (200 PP each via `goal_slot`)
- **Suspend goal** — 50 PP action sets `node.status='suspended'` (renders greyed + ⏸ badge)
- **Visual overhaul** — dot-grid bg, radial gradients, gradient branches, domain emoji icons

### Tracker System

- **13 tracker types** — lift, cardio, meal, steps, sleep, meditation, study, reading, expense, investment, music, journal, gaming
- **Domain auto-activation** — FITNESS → lift/cardio/meal/steps etc.
- **Dual-write architecture** — JSONB log + 13 structured Postgres tables with `GENERATED ALWAYS AS ... STORED` computed metrics (volume_kg, pace_min_per_km, total_eur)
- **Exercise library** (50 entries grouped by muscle) + **food library** (51 entries with kcal/100g + Open Food Facts fallback) — both render as MUI Autocomplete
- **Structured summary reader** — `getStructuredSummary()` powers Axiom prompts (AICoaching + notebookAxiom)

### Check-ins & Streaks

- **Daily check-in** — one-tap, mood + win_of_the_day, +10 PP base
- **Streak multipliers** — ×1 (base 10), ×2 @ 7d (+20), ×3 @ 30d (+30) stacked → 30–70 PP/day
- **Reliability score** `R = 0.65·C + 0.25·V + 0.10·S` (check-in rate, verification rate, streak stability)
- **Balance widget** — Master Roshi nudge when streak ≥ 14d and a domain averages 0% progress

### AI (Axiom) — LLM-gated

- **Morning daily brief** (once/day, LLM, fallback to heuristic on failure)
- **Notebook query** — POST `/notebook/axiom-query` answers free-form questions on logged data (50 PP, premium free)
- **Progress estimation service** — LLM-assisted grading fed structured tracker aggregates
- **Coaching chat surface** — dedicated `/coaching` route with unlock CTA for non-premium

### Points Economy (PP)

- **Catalogue** (`pointsController`) — boost_visibility/150, goal_slot/200, coaching_session/500, super_match/300, custom_icon/100, skip_grading/80, bet_stake/50, suspend_goal/50
- **Earn paths** — daily check-in streak (30–70), peer-verified goal completion (`+50 × weight`), streak sharing
- **PP purchase via Stripe** — pp_500 (€4.99), pp_1100 (€9.99), pp_3000 (€24.99) with idempotency on `stripe_session_id`

### Social & Network

- **Matching** — pure rule-based (domain overlap + progress similarity); no LLM
- **Geolocation + nearby users** — Haversine query, "Near You" widget on Dashboard
- **Personalized smart feed** — `/posts/feed` weighted score (goal overlap 30%, proximity 25%, honor 20%, reliability 15%, recency 10%, ×1.3 if shared board)
- **Groups = Reddit-style boards** — Posts tab (titled threads) + Chat tab per room
- **Chat** — text, media (Supabase Storage), completion-request cards, system messages, **rich reference linking** (goals/services/posts/groups/events inside messages via `metadata.reference`)
- **Video calls (WebRTC)** — Supabase Broadcast signaling (`webrtc_{sortedIds}`), Google STUN
- **Live streaming** + **donations** (PP tips to streamer)
- **Referral program** — unique code, +100 PP to both parties on claim

### Betting (Goal Staking)

- **Place/cancel bets** on goals with PP slider; 2× payout on peer-verified completion
- **Opponent betting** — bet against another user's claim; anonymous fails
- **Accountability posts** — placing a stake auto-posts to feed
- **Active/history tabs** with progress rings

### Marketplace

- **Services/jobs/gigs** CRUD (`/services`) — type filter, Browse + My Listings tabs
- **Premium (Pro)** — Stripe subscription; unlocks unlimited Axiom, extra goal slots, PDF full-history export
- **PP purchase** tiers (see Points Economy)
- **Betting entry point** (moved here from standalone nav)

### Notebook Export (PDF)

- **Free tier** — GET `/diary/export/plain` streams a curated 365-day PDF (cover, metrics grid, goals tree, tracker tables, life-log timeline, footer pagination)
- **Pro / 500 PP** — POST `/diary/export/notes` streams full-history (5-year) PDF
- **Renderer** — `NotebookPdfRenderer.ts` uses `pdfkit`, zebra-striped tables, auto-pagination with header repeat, brand palette

### Admin

- **5-tab panel** — Users, Groups/Boards, Stats, Network Diagram, Challenges
- **Admin bypass** on edit gates (goal tree, locked briefs)

### Dev/Ops

- **Sentry** error tracking
- **Zod validation** on critical POST endpoints
- **Stripe idempotency + RLS audit + E2E smoke**
- **i18n** — 100+ translation keys
- **Praxis CLI** — internal automation binary
- **Railway** (Express API) + **Vercel** (static React) split

---

## 2. Implemented → Removed / Hidden

Features that shipped and were later removed, hidden, or replaced. Kept here for historical context and so we don't re-invent something we already tried.

| Feature                                                         | Status  | Commit                   | Reason / note                                                                                                          |
| --------------------------------------------------------------- | ------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Events (Discover + feature)**                                 | Hidden  | `95f9eac` + this session | Removed from Discover filter/markers/compact feed; awaiting reimplementation as seasonal/community milestones (see §3) |
| **Identity verification page (`/verify-identity`)**             | Removed | `e95ca11`                | Route deleted; plan was face-api liveness, deprecated with face-api                                                    |
| **face-api.js**                                                 | Removed | `952f0a7`                | Bundle size + accuracy; replaced by peer verification flow                                                             |
| **Dashboard tracker chips + accountability buddy widget**       | Removed | `21debb0`                | Cluttered dashboard; trackers now live in notebook, buddy surfaced via matches                                         |
| **Axiom goal-strategy + network-leverage blocks (daily brief)** | Removed | `88e81cd`                | Noisy; daily brief now focuses on one actionable nudge                                                                 |
| **Axiom's Take** (inline commentary)                            | Removed | `9d60a33`                | Redundant with notebook query + morning brief                                                                          |
| **Welcome State (Notebook empty-state)**                        | Removed | `83aba9d`                | Onboarding already walks new users through first entry                                                                 |
| **Axiom training sources + knowledge base UI**                  | Removed | `3d74e21`                | Leaked internals; not user-facing value                                                                                |
| **EmbeddingService**                                            | Removed | `f47e68a`                | Semantic search not materially better than rule-based match for current data size                                      |
| **HabitCalendar**                                               | Removed | `09d013f`                | Replaced with check-in streak + tracker aggregates                                                                     |
| **Old SVG goal-tree visualization**                             | Removed | `3287ddc`                | Replaced by gradient/dot-grid canvas viz                                                                               |
| **More dropdown (nav)**                                         | Removed | `ea50180`                | Flattened nav; surface everything directly                                                                             |
| **Friends (nav entry)**                                         | Removed | `2f65327`                | Matches + DMs cover this; "Friends" implied a social graph we don't maintain                                           |
| **Betting (standalone nav)**                                    | Removed | `1cf2780`                | Moved under Marketplace                                                                                                |
| **Post feed in marketplace**                                    | Removed | `d1a93f8`                | Marketplace is transactional; feed belongs on Dashboard                                                                |
| **Archetype references**                                        | Removed | `be16712`                | Feature pivot; domains replaced archetypes                                                                             |
| **Goal/subgoal nomenclature**                                   | Removed | `a5648ee`                | Everything is a "node" in the tree — uniform vocab                                                                     |
| **Habit heatmap**                                               | Removed | `9cd77b9`                | Replaced with line chart (cleaner for streaks)                                                                         |
| **react-leaflet**                                               | Removed | `9fe4a0f`                | Switched map stack                                                                                                     |
| **Google Maps SDK**                                             | Removed | `82491ce`                | API-key-gated; deferred until we have budget / need                                                                    |
| **Goal-tree → Notebook rename (old name deprecated)**           | Renamed | `43b4be4`                | Product identity: it's a journal, not a tree                                                                           |
| **Trend / metrics button (Notebook)**                           | Removed | this session             | User-requested simplification                                                                                          |
| **`minimal_ai_mode`**                                           | Removed | `8cdc20d`                | Collapsed into premium/PP gating                                                                                       |
| **Social-density features**                                     | Removed | `0471182`                | Overengineered for current scale                                                                                       |

Pattern takeaway: most removals are **consolidation** (two surfaces → one) or **deferred infra** (face-api, maps, embeddings) — not product-direction reversals. Keep the list when considering a rebuild; most of these will come back in a cleaner form.

---

## 3. Proposed Future Features

Elaborations for each. Grouped by theme. Priority tags: 🔴 next up, 🟡 planned, 🟢 speculative.

### 3.1 Social & Accountability

**🔴 WhatsApp-style Groups v2**  
Current groups are Reddit-style boards (posts + chat). Add: member list with avatars, explicit join/leave with approval for private rooms, group description/rules field, admin/moderator roles, pinned posts, mute notifications, @mentions. Keep posts tab for long-form, add "Events" pin area (see 3.6). DB: `chat_room_members.role` enum ('admin','mod','member'), `chat_rooms.is_private`, `chat_rooms.description`. Frontend: `GroupSettingsDialog` + member drawer.

**🟡 Accountability streaks with peer verification**  
Two users pair up ("sparring partners"). Each logs daily; every 7d both must peer-verify each other to keep the joint streak. Joint streak unlocks bigger PP multipliers than solo. Builds on existing `completion_requests` table + matches. DB: `partnerships(user_a, user_b, status, started_at, current_streak)`. Surface: "Sparring" tab in Matches.

**🟡 Bet auto-grading via peer verification**  
Current bets settle on self-report + admin review. Wire bet resolution to peer-verification flow: claim completion → verifier approves → bet auto-pays 2× stake. If verifier rejects, stake goes to a "honor pool" redistributed to verifiers. DB: `bets.verification_request_id` FK → `completion_requests.id`. Killer UX: a single approval discharges goal + bet + achievement simultaneously.

**🟢 Federated sparring-partner matching**  
Opt-in cross-instance matching using domain overlap + progress similarity. Users from partnered Praxis installations appear in each other's match pool. Privacy: only share `{domain_vector, progress_hash, pseudonym}`. Needs protocol spec (ActivityPub? custom?).

**🟢 Reliability-score leaderboard**  
Weekly leaderboard of top R scores per domain. Already have R formula; just need leaderboard view + weekly reset snapshot table.

### 3.2 Axiom / AI

**🟡 Axiom "Boost" tier**  
Premium-within-premium. Unlocks: unlimited notebook queries, faster model (we currently gate to `fast`), weekly personalized "state of you" report (PDF, emailed), voice interface. Stripe new price ID. Gate in `aiCoachingService.generateCoachingResponse` on `profile.axiom_tier`.

**🟡 Multi-language coach persona**  
Respect `profile.language` not just in UI strings but in Axiom prompt + response. Tone guide already exists in English (`AXIOM_TONE_GUIDE.md`); translate + adapt for it/es/fr/de.

**🟢 Structured-tracker history visualizations**  
Per-metric sparklines (volume_kg over 90d, avg pace, kcal in/out, net spend trend) on each tracker's detail page. Data is in structured tables; just need SVG sparkline component + `GET /trackers/:type/history`.

**🟢 AI narrative export refinements**  
Notebook PDF currently lists raw data. Add opt-in "Axiom narrative" page at the front: 400-word human-readable summary of the export period, themes, concerns, wins. LLM prompt templated on existing notebookAxiom structure.

**🟢 Voice-first check-in**  
Speak your win_of_the_day + mood; Whisper transcribes; same check-in endpoint.

### 3.3 Notebook & Trackers

**🔴 Tracker backfill script (JSONB → structured)**  
Existing users have historical `tracker_logs` rows in JSONB only. Write a one-shot migration script that reads each legacy log and inserts into the correct structured table via `StructuredTrackerWriter`. Needed so structured summaries/PDF reflect full history, not just post-2026-04-19 logs. CLI command: `praxis backfill-trackers --user-id=all`.

**🟡 Enumerate+Increment tracker model v2**  
Already shipped (`3760b98`) for count-based trackers. Expand to: templated enumerations (pre-defined list), quick-add buttons from history, "carry forward" from yesterday. Useful for reading/meditation/study where the item often repeats.

**🟢 Goal-dependency DAG (beyond tree)**  
Current structure is strict tree (each node one parent). Real goals have prerequisites across branches ("learn Italian before moving to Rome"). Add `goal_dependencies(node_id, depends_on_node_id)`. Visualize as overlay arrows on existing tree. Affects progress roll-up: blocked nodes show as amber.

**🟢 Offline notebook logging with sync**  
Partially shipped (`8132b8f`). Harden: conflict resolution rules, IndexedDB persistence, background sync API, optimistic UI for structured tracker writes.

### 3.4 Maps & Location

**🟡 Google Maps upgrade**  
Re-introduce Maps SDK behind `GOOGLE_MAPS_API_KEY` env var. Needed for richer map (traffic, places, directions) than Leaflet/OSM. Gate behind feature flag so self-hosters can keep OSM.

**🟡 Map overlay for smart-feed / discover**  
`DiscoverPage` already clusters users/places on map. Add post-pin overlay: posts with location show as small bubbles; tap → feed item. Data already has `latitude/longitude` on posts (implicit from author).

**🟢 Commute-based matching**  
"Users on your route" — if user opts in sharing home+work, compute potential meeting points near both commutes.

### 3.5 Monetization

**🔴 Stripe production hardening**  
Production `STRIPE_PRICE_ID`s for subscription + PP tiers; register production webhook endpoint; end-to-end test via Stripe CLI. Blockers are config-only.

**🔴 Demo-user seeder**  
`POST /admin/seed-demo-users` creates 20 demo accounts with varied goals, streaks, tracker history, and match compatibility. Needed for screenshots, E2E tests, onboarding demo.

**🟡 Annual plan + founding-member pricing**  
Stripe annual price with ~2mo discount; "Founding Member" badge for first N subscribers stored in `profiles.badges`.

**🟡 Referral tier upgrade**  
Currently flat +100 PP each side. Add: 5 successful referrals → 1mo Pro free; 10 → lifetime PP×1.2 multiplier. Track in `referral_claims`.

**🟢 In-product ads (first-party only)**  
Surface featured `services` listings as promoted cards in smart feed for PP cost. No third-party ad network.

### 3.6 Events (reintroduction)

**🟡 Seasonal / community milestones**  
Replaces old generic events. Time-bounded challenges tied to calendar (Dry January, NaNoWriMo, SummerBody2026). Users opt in; check-ins during the window contribute to a shared community progress bar; completion awards a limited badge + PP. DB: `events(id, slug, start_at, end_at, domain, rules_json, rewards_json)`, `event_participants(user_id, event_id, joined_at, completed)`. UI: new `/events` with discover grid + per-event leaderboard.

**🟢 Group-hosted events**  
A group/board can host a 7-day sprint ("This week we all read 50pp/day"). Extends the global events system to scope = group.

### 3.7 Platform & Infra

**🟡 Native iOS companion**  
Swift shell around PWA for notification reliability + Apple Pay + Shortcuts (one-tap check-in from home screen). React Native or Capacitor; Capacitor preferred for code reuse.

**🟢 Praxis CLI expansion**  
Already have `praxis` binary (`82cebfe`). Add: `praxis log-tracker`, `praxis streak`, `praxis export-pdf` — for power users on terminal.

**🟢 Self-host pack**  
Docker compose (Postgres + Express + React static) with seeded demo data. Needed for prosumer self-hosters; widens TAM.

**🟢 Webhooks for third-party integrations**  
Outbound webhooks on key events (streak_broken, goal_completed, bet_won). Users plug into Zapier/Make for custom flows (Slack post, sheet append, etc.).

### 3.8 Growth & Virality

**🟡 Shareable widgets**  
Streak badge + goal-progress card as `<iframe>` or raw SVG (`/widget/streak/:userId.svg`). Already have embeddable streak widget per MEMORY; needs polish + open-graph card for preview.

**🟡 Celebration moments v2**  
`c22a243` shipped Better Celebrations. Next: generative share cards (streak anniversaries, goal completions) auto-generated as OG images, auto-posted to feed + one-tap to Twitter/IG.

**🟢 Annual "Praxis Wrapped"**  
Spotify-style year-in-review: biggest goal, total PP, top domain, streak record, sparring partner — as swipeable cards + PDF + shareable. Run mid-December via cron.

---

## Change Log

- **2026-04-27** — Tracker backfill script + Stripe production hardening. New `scripts/backfill-trackers.ts` (CLI: `npm run backfill-trackers -- --user-id=all`) idempotently fills the per-category structured tables from legacy `tracker_entries` JSONB. Stripe: moved webhook raw-body parsing ahead of `express.json()` (was silently breaking signature verification), added `auditStripe()` startup validation that warns/errors on missing `STRIPE_PRICE_ID*` / `STRIPE_WEBHOOK_SECRET` / `CLIENT_URL` and flags non-`sk_live_*` keys in production. New `scripts/stripe-cli-test.sh` for local end-to-end webhook testing. `.env.example` now documents the full Stripe block; production setup steps in `manual_actions.txt`.
- **2026-04-27** — Profile embeddings for semantic text affinity matching. New `profile_embeddings` table + `match_profiles_by_text` RPC + `TextAnalysisService` for Gemini embedding generation. Composite match score: 50% goal + 35% text affinity + 10% geo + 5% reliability. Admin endpoint: `POST /api/admin/refresh-profile-embeddings`.
- **2026-04-19** — Document created. Removed events from Discover (this session). PDF notebook export shipped.
