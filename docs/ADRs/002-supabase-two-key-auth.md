# ADR 002 — Two Supabase clients: anon on frontend, service-role on backend

## Context

Supabase exposes two keys per project:

- **anon key** (publishable): safe to ship in a client bundle. Every query is subject to Row-Level Security (RLS) policies.
- **service_role key** (secret): bypasses RLS entirely. Anyone holding it can read/write any row.

Praxis needs both behaviors:

- Users should only be able to read their own `notebook_entries` (RLS).
- The backend needs to credit points, issue admin actions, and write system-authored rows that no user "owns" (bypass RLS).

## Decision

- **Frontend** (`client/src/lib/supabase.ts`) uses the **anon key**. All queries from the browser hit RLS. This means RLS policies are the real authorization boundary, not the Express middleware.
- **Backend** (`src/lib/supabase.ts` or similar) uses the **service_role key**. Express routes are protected by `authenticateToken` (JWT check), and after that the backend is trusted to write whatever it needs.
- **Service-role key never leaves the backend.** It lives in Railway env as `SUPABASE_SERVICE_ROLE_KEY`. The frontend bundle has no reference to it.

## Consequences

- ✅ Defense in depth: even if a malicious client bypasses the Express API and hits Supabase directly with the anon key, RLS blocks them.
- ✅ Backend controllers can write cross-user data (points to a peer, system messages, etc.) without needing per-row admin claims.
- ❌ RLS policies and Express route guards are two separate authorization systems — easy to drift out of sync. A new backend endpoint that forgets to re-check `req.user.id === row.user_id` can leak data.
- ❌ If the service-role key leaks, an attacker has full DB access. Rotation procedure is in `RUNBOOK.md §6`.

## Gotchas for maintainers

- `authenticateToken` middleware is non-optional on any route that touches user-scoped data. See `src/middleware/authenticateToken.ts`.
- When the Railway `SUPABASE_SERVICE_ROLE_KEY` is accidentally set to the _publishable_ key (historical incident noted in `MEMORY.md` session 34), every write endpoint 500s with RLS violations. Symptom is the first thing to check on production write failures.
- Points-spending controllers use `req.user.id` (set by middleware), **not** `req.body.userId` — to prevent a client from spending another user's points.
