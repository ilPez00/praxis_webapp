# ADR 005 — Matching is pure rule-based, never LLM

## Context

Praxis matches users to accountability partners. The obvious modern move is "throw GPT at it" — embed each user's goal tree, cosine-similarity in a vector space, let the LLM write the rationale. We deliberately do not.

## Decision

The matching engine (`src/services/MatchingEngineService.ts`, called from `src/controllers/matchingController.ts`) is pure deterministic math:

- **Domain overlap** — intersection over union of the two users' active goal domains (`FITNESS`, `LEARNING`, etc.)
- **Progress similarity** — distance between average completion rates across shared domains
- **Honor/reliability score** — `R = 0.65 × C + 0.25 × V + 0.10 × S` where `C` is check-in rate, `V` is verification rate, `S` is streak stability
- **Proximity** (when available) — Haversine distance on `profiles.latitude/longitude`

These are combined into a compatibility score in `[0, 1]`. No embeddings, no LLM call, no external ML API.

## Why not LLM

1. **Cost.** Matching runs on every `/discover` pageview. Per-request LLM calls would be $X/user/month. Rule-based is $0.
2. **Determinism.** A user who reloads the page expects the same match list. Non-deterministic LLM output erodes trust.
3. **Debuggability.** When a user asks "why am I matched with X?", the explanation is a deterministic score decomposition, not a hallucination risk.
4. **Legal surface.** If matching causes harm (stalking, harassment), "we explicitly scored X against Y" is a defensible posture. "The AI decided" is not.
5. **Speed.** Pure SQL/JS math runs in ~5ms. LLM round-trips are 500–3000ms.

## Where LLM _is_ used in Praxis

- **Axiom daily briefs** — once per user per day, falls back to deterministic template on failure (`GOOGLE_AI_API_KEY` → Gemini). Cached.
- **Nowhere else in the matching, scoring, streak, leaderboard, or betting paths.**

This separation is a policy in `CLAUDE.md`:

> AI Policy: Matching = pure rule-based. No LLM calls.
> Grading, streaks, weights, analytics = local math / simple backend functions.
> Betting, streaks, leaderboard, goal tree visualization = 100% AI-free, always.

## Consequences

- ✅ Zero per-match AI cost. Scales to millions of users without OpenAI/Anthropic bills.
- ✅ Deterministic, explainable, cacheable.
- ✅ The codebase stays inspectable — any engineer can read the weights and trace a match.
- ❌ Match quality is bounded by the handful of features the engine knows about. Adding richer signals (bio text similarity, interest tags) requires new deterministic features, not a magic LLM step.
- ❌ Cannot write a natural-language rationale for a match without an LLM pass. Currently we don't try.

## When this gets revisited

Never for scoring. Possibly for _explanation generation_ — once matching has run and picked top-K, a low-frequency LLM call to write "here's why Alice is a good match for Bob" could improve conversion without affecting the scoring policy. Cache aggressively.
