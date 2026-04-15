# Architecture Decision Records (ADRs)

One-page records of load-bearing decisions in Praxis. Written for a future maintainer (potentially a buyer) who needs to understand _why_ the code looks the way it does without reading every commit.

Format: one file per decision, named `NNN-kebab-case.md`. Each record answers:

- **Context** — what was the problem?
- **Decision** — what did we pick?
- **Consequences** — what do we live with as a result?

| #                                             | Title                                                            |
| --------------------------------------------- | ---------------------------------------------------------------- |
| [001](001-snake-case-db-camel-case-ts.md)     | snake_case DB columns, camelCase TS types                        |
| [002](002-supabase-two-key-auth.md)           | Two Supabase clients: anon on frontend, service-role on backend  |
| [003](003-railway-backend-vercel-frontend.md) | Railway for Express, Vercel for React — split, not unified       |
| [004](004-points-economy-formula.md)          | Points economy — check-in, streak, and completion award formulas |
| [005](005-matching-is-rule-based-not-llm.md)  | Matching is pure rule-based math, never LLM                      |
