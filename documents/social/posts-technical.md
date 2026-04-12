# Narrative A — Technical Flex

**Audience:** devs, recruiters, indie hackers, HN crowd
**Goal:** portfolio leverage → job offers, consulting gigs, followers
**Tone:** factual, specific, no hype words ("revolutionary", "disrupting"), numbers over adjectives

---

## X / Twitter

### Announce thread (6 tweets)

**1/**
Over the last 2.5 months I built Praxis — a daily goal-journal + accountability-buddy PWA.

Solo, working alongside three CLI coding agents (Claude, Gemini, Qwen).

Some numbers that surprised me ↓

**2/**

- 820 commits
- ~79,000 lines of TypeScript
- 198 frontend files, 157 backend files
- 36 feature modules
- 74 DB migrations
- 0 TS errors, build in 762ms

The "build in 762ms" is the one I'm proudest of. Vite 8 + Rolldown is unreal.

**3/**
Stack:

- React 18 + MUI v7 + Vite 8 (Rolldown minifier)
- Express + TypeScript on Railway
- Supabase (auth, Postgres, storage, realtime)
- PWA + Electron desktop widget + Android WebView widget
- WebRTC video calls via Supabase Broadcast signaling

**4/**
Hardest part wasn't the code.

It was keeping three CLI agents in sync via a shared `claude_steps.txt` dev log. Every session starts by reading what the last agent did. Every session ends by appending its own block.

Git history ≈ conversation history.

**5/**
What I learned the hard way:

- Feature sprawl is a tax. 36 features = 0 polished features.
- MUI v7 Grid API breakage is a silent killer (`<Grid item>` → `<Grid size={{...}}>`)
- Supabase service-role vs publishable key confusion cost me 2 days
- Multi-agent workflows need shared conventions in CLAUDE.md, not memory

**6/**
Code is not open yet. Deciding between:
a) Portfolio piece + job hunt
b) Sell as a habit-tracker SaaS boilerplate ($149 on Gumroad)
c) Pivot to a niche (fitness accountability in Italian market looks promising)

Which would you do?

---

### Standalone tweets (post 2-3 per week over 3 weeks)

**T1 — The Rolldown shock**

> Upgraded Vite 6 → 8. Build time went from 1m 26s to 7s.
>
> 12× faster. Same codebase. The Rolldown minifier is no joke.
>
> If you're on Vite 6 and haven't upgraded, you're burning CI budget.

**T2 — MUI v7 migration trap**

> MUI v7 quietly removed the old Grid API.
>
> `<Grid item xs={6}>` → dead
> `<Grid size={{ xs: 6, md: 4 }}>` → alive
>
> Zero deprecation warnings. Runtime silently renders nothing. Found it in production, not in tests.

**T3 — Supabase snake_case gotcha**

> Supabase Postgres uses snake_case columns. TypeScript types use camelCase.
>
> `.eq('senderId', ...)` ← fails silently, returns 0 rows
> `.eq('sender_id', ...)` ← works
>
> No error, no log, just wrong data. Always alias at the query boundary.

**T4 — Multi-agent flex**

> Working theory: three weaker agents with a shared log > one top agent with no memory.
>
> Praxis runs on Claude / Gemini / Qwen rotating through `claude_steps.txt`. Each reads the log, does its session, appends. 820 commits later: the log is the single source of truth.

**T5 — Stats graphic prompt**

> 2.5 months.
> 820 commits.
> 79,000 lines of TypeScript.
> 762 ms production build.
> Solo developer.
>
> Next question is whether any of it matters.
>
> [attach: stats-flex.svg]

**T6 — Feature count reality check**

> Built 36 features in Praxis.
>
> 6 are actually polished.
> 12 are usable but rough.
> 18 are "it exists."
>
> Lesson: the number of features you ship is not the number of features users see. Feature sprawl is a debt you pay in attention, not in code.

**T7 — WebRTC in a PWA**

> You can do peer-to-peer video calls in a React PWA with:
>
> - Supabase Broadcast channel (signaling)
> - Google STUN servers (free)
> - `RTCPeerConnection` + `getUserMedia`
>
> No Twilio, no Agora, no $/minute.
>
> Setup took 1 session. Total LOC: ~200.

**T8 — The tree visualization**

> Spent a whole weekend on the goal-tree visualization.
>
> SVG with radial gradients, domain-colored branches, emoji icons, suspend state rendering.
>
> Nobody asked for it. It's the one screen users remember.
>
> [attach: goal-tree-teaser.svg]

---

## LinkedIn

### Post 1 (Italian) — Launch / portfolio

**Titolo:** 79.000 righe di TypeScript in 2 mesi e mezzo. Questo è quello che ho imparato.

Negli ultimi mesi ho costruito Praxis, una PWA per obiettivi giornalieri e accountability buddy, lavorando da solo insieme a tre CLI coding agent (Claude, Gemini, Qwen).

I numeri:
• 820 commit
• ~79.000 righe di TypeScript
• 198 file frontend, 157 file backend
• 36 moduli feature
• 74 migrazioni SQL
• Build di produzione: 762ms

Lo stack è volutamente noioso: React 18 + MUI v7 + Vite 8, Express su Railway, Supabase per auth/DB/storage/realtime. La parte meno noiosa sono le video call peer-to-peer via WebRTC con signaling su Supabase Broadcast — zero costi Twilio, 200 righe di codice.

Le tre cose che mi hanno insegnato di più:

1. **Il feature sprawl è una tassa, non un asset.** 36 feature non sono 36 asset, sono 36 manutenzioni. Ne avessi fatte 8 polished, il prodotto sarebbe più forte.

2. **I multi-agent workflow funzionano solo con convenzioni condivise.** Tre agent diversi ti producono tre stili di codice diversi, a meno che tu non forzi un CLAUDE.md con regole di stile concrete (noi abbiamo finito con conventions su MUI Grid, snake_case DB, guard su `.map()`, import depth).

3. **Vite 8 + Rolldown è un upgrade che va fatto ieri.** Siamo passati da 1m26s di build a 7s. 12× più veloci. Zero breaking change significativi.

Il codice non è ancora pubblico. Sto valutando se farne un portfolio piece, venderlo come boilerplate su Gumroad, o fare pivot su una nicchia verticale (palestra / studenti / recovery).

Se qualcuno di voi sta facendo hiring per ruoli full-stack senior in Italia o Europa remote, felice di fare due chiacchiere.

[hashtag:TypeScript] [hashtag:React] [hashtag:IndieHacker] [hashtag:Supabase] [hashtag:Vercel]

---

### Post 2 (English) — Technical deep-dive on Vite 8

**Title:** Upgraded from Vite 6 to Vite 8. Build time dropped from 86s to 7s. Here's what I changed.

Praxis is a ~53k LOC React TypeScript app. Build times were creeping up and I had some free time, so I tried the Vite 8 upgrade I'd been avoiding.

The result: **1m 26s → 7s**. 12× faster. Same code.

What actually changed:

**1. Rolldown replaced esbuild as the default bundler.**
Rolldown is a Rust-based Rollup-compatible bundler from the Vite team. In this project it's the main source of the speedup. The API is 95% compatible with Rollup config.

**2. `rollupOptions` → `rolldownOptions`**
Config key renamed. Three-line change.

**3. `manualChunks` must be a function, not an object.**
This is the breaking change that bit me. Object form throws at build time now. Function form is actually cleaner:

```ts
manualChunks(id) {
  if (id.includes('node_modules/@mui/x-charts')) return 'charts';
  if (id.includes('node_modules/leaflet')) return 'leaflet';
  if (id.includes('node_modules/@supabase')) return 'supabase';
  return null;
}
```

**4. `minify: 'esbuild'` → `minify: 'oxc'`**
Oxc is the new default minifier. Esbuild is no longer bundled.

**5. Chunk sizes improved for free.**

- `index.js`: 628KB → 150KB (76% smaller)
- `AnalyticsPage`: 291KB → 25KB (charts extracted to vendor chunk)
- `mui`: 469KB → 322KB

Total gzip savings for first-paint users: ~180KB.

The upgrade took one afternoon. The hardest part was realizing `manualChunks` as an object just silently produces the wrong chunks until you read the migration notes.

If you're still on Vite 6, this is the cheapest perf win you can get this quarter.

[hashtag:Vite] [hashtag:React] [hashtag:TypeScript] [hashtag:WebPerf]

---

### Post 3 (English) — The multi-agent workflow

**Title:** I built a 79k-LOC app with three CLI coding agents. Here's what actually works and what doesn't.

Over the last 2.5 months I built a PWA called Praxis using Claude Code, Gemini CLI, and Qwen CLI, rotating sessions. No pair programming, no simultaneous editing — just each agent doing a discrete session and handing off.

**What works:**

1. **A shared dev log is mandatory.** We keep `claude_steps.txt` in the repo root. Every session starts with "read claude_steps.txt." Every session ends with appending a new block (summary, files modified, verification, next steps, signature). This is the single source of truth for what any agent should do next.

2. **A CLAUDE.md with concrete conventions.** Not "write clean code" — actual rules: MUI v7 Grid API is `size={{...}}` not `item xs`, Supabase columns are snake_case, import paths from `features/*/components/` use `../../../`, etc. Generic style guides are ignored; specific gotchas get followed.

3. **Commit early, commit labeled.** Each commit message says what the session accomplished so git log is readable to the next agent. I don't let agents batch 10 changes into one commit.

**What doesn't work:**

1. **Three agents produce three architectures.** Without strong conventions, you end up with three different ways of doing API calls, three different ways of structuring components, three different naming patterns. It looks like the codebase was written by a team with no code review — because it was.

2. **"Remember X for next time" is a lie.** Agents don't remember anything across sessions. Persistent memory requires files. I keep a `~/.claude/memory/` directory per project that Claude appends to, but other agents don't see it.

3. **Handoff errors compound.** If agent A introduces a subtle bug, agent B reads the log and builds on it without re-verifying. A bug can survive 10 sessions before being caught. The fix: E2E tests, which I did not have enough of.

**Would I do it again?** For a solo project under time pressure: yes, net positive. For a production app with users: no, the code inconsistency tax is too high.

If you're experimenting with this, the leverage is real but the discipline requirement is higher than solo work, not lower.

[hashtag:AI] [hashtag:CodingAgents] [hashtag:SoftwareEngineering]

---

## Hacker News — "Show HN" post

**Title:** Show HN: Praxis – A habit tracker I built in 2.5 months with 3 CLI agents

**Body:**

Hi HN,

Praxis is a goal-journal + accountability-buddy PWA I built over ~2.5 months as a solo developer working alongside three CLI coding agents (Claude Code, Gemini CLI, Qwen CLI). It's not yet live to the public — I'm posting for feedback on the tech, the multi-agent workflow, and the honest question of what to do with it next.

Demo: [demo URL if deployed]
Repo: [repo URL or "not yet public, happy to walk through architecture"]

What it is:

- Daily goal tree with domain-colored branches, check-ins, and streaks
- Peer-verified goal completion via DM cards
- WebRTC video calls for accountability sparring (no Twilio, ~200 LOC, Supabase Broadcast signaling)
- Embeddable streak widget (iframe-able, no auth, served from the backend)
- Template-first AI coaching, optional opt-in LLM ("Axiom Boost") for premium users
- Gamification: XP, levels, daily quests, referral PP currency
- 36 feature modules in total — which, in retrospect, is far too many

Stack:

- React 18 + MUI v7 + Vite 8 (Rolldown) on Vercel
- Express + TypeScript on Railway
- Supabase (auth, Postgres, Storage, Realtime)
- PWA + Electron desktop widget + Android WebView widget
- i18n via i18next (IT/EN)

Numbers:

- 820 commits over ~2.5 months
- ~79k LOC total (26k backend, 53k frontend)
- 198 frontend TS/TSX files, 157 backend TS files
- 74 SQL migrations
- 8 test files total (this is my biggest regret)
- 762ms production build (Vite 8 + Rolldown)

The multi-agent workflow is the part I most want feedback on. Every session an agent reads a shared `claude_steps.txt` dev log, does work, and appends a session block before handing off. No simultaneous editing. The log is the memory substrate. After 820 commits I think it works for solo projects but compounds code-quality drift — three agents without a code reviewer produce three architectures.

My biggest regret isn't technical: it's that I built 36 features instead of 8 polished ones. The honest answer to "which feature works best?" is that none of them have been pressure-tested by real users, because I kept shipping instead of testing.

What I'm asking HN:

1. For those who've used multi-agent workflows seriously — does the shared-log pattern scale past ~1k commits, or does it collapse?
2. How would you monetize 79k LOC of habit-tracker code with zero traction? Portfolio piece, boilerplate sale, or niche pivot?
3. What one feature would you kill first?

Happy to dive into the code, the agent-coordination trick, or the ugly bits.

---

## IndieHackers — Build log post

**Title:** 820 commits, 79k LOC, 0 users — what I learned building Praxis in 2.5 months

**Body:**

Hey IH,

This is a post-mortem / public diary, not a launch. I've been building a habit tracker + accountability buddy PWA called Praxis in sprint mode for 2.5 months and I've reached the honest "what now?" moment.

**The stats:**

- 820 commits (94 in Feb, 675 in March, 51 so far in April)
- 79k LOC in TypeScript
- 36 feature folders
- 74 database migrations
- 8 test files (yes, I know)
- 1 developer + 3 CLI coding agents (Claude/Gemini/Qwen)
- 0 users, 0 MRR, 0 waitlist

**What I built:**
Imagine Habitica + Discord + LinkedIn + Stripe marketplace + WebRTC video calls + Electron desktop widget + CLI tool. That's roughly the scope I shipped. Daily check-ins, goal trees with peer verification, a points economy, a services marketplace, team challenges, group chat rooms, a betting/staking feature, and an AI daily brief I eventually scoped down to templates-by-default. I also built an Italian-first i18n layer because I'm based in Italy and thought it'd be a wedge.

**What I learned the expensive way:**

1. **Feature sprawl is the slowest form of failure.** Every feature you add without users is a feature you have to maintain without knowing if it matters. I should have stopped at 8 features and iterated. I stopped at 36 and now have to decide which 28 to kill.

2. **Multi-agent CLI workflows work for code, not for judgment.** Claude / Gemini / Qwen rotated through the same codebase via a shared dev log (`claude_steps.txt`). Code output: 2-3× faster than solo. Architectural judgment: flat. Three agents with no shared product opinion produce three architectures.

3. **Zero tests is the regret you feel later.** I wrote 8 test files for 79k LOC. It felt fine during the sprint because I was manually verifying every feature as I built it. It feels terrible now that I have to refactor anything without a safety net. If you're sprinting, write 3 E2E tests on your critical path BEFORE you start, not after.

4. **The tech stack was the easy part.** Supabase + Vite 8 + MUI v7 + Express worked beautifully. The hard part was product decisions, not technical ones. I was good at "how do I build this feature" and bad at "should I build this feature."

5. **"I'll monetize later" meant "I won't have enough data to know if anyone would pay."** I wired up Stripe (Pro tier $9.99/mo + PP purchase tiers) in week 3. I never charged anyone because I never launched to anyone. The Stripe integration is dead weight without a single customer.

**Where I'm at now:**

I did a brutal honest-valuation exercise (with help from Claude) and the outcome is: as a business, Praxis is worth maybe $2–8k on Flippa. As a code asset (habit-tracker SaaS boilerplate on Gumroad or CodeCanyon), maybe $10–25k spread over a year. As a portfolio piece leading to a senior FE job in the EU market, probably €10–50k/year salary uplift — and that's the highest-EV option by far.

**What I'm doing next:**

- Week 1: polish README, record demo, use Praxis as lead portfolio artifact for job hunting
- Week 2: strip branding and list on Gumroad as a boilerplate for $149
- Week 3: decide whether to pivot to a niche (Italian-market fitness accountability looks promising) or shelf it
- Kill date: end of month. If boilerplate sales are <3 and no job leads materialize from the portfolio, I move on to the next project.

**Question for IH:**

Has anyone here successfully monetized a feature-rich solo project with no users by selling it as a boilerplate/template rather than as SaaS? I know the answer exists because the CodeCanyon "SaaS starter" market exists, but I don't know anyone personally who's done it and I'd love to hear real numbers.

Thanks for reading. The honest post-mortem is more useful than a launch post right now.
