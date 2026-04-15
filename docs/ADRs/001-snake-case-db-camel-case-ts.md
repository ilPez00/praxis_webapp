# ADR 001 — snake_case DB columns, camelCase TS types

## Context

Praxis uses Supabase (Postgres). Postgres convention is `snake_case` for columns, but JavaScript/TypeScript convention is `camelCase`. Every query crosses that boundary. The codebase has to pick one convention per side.

## Decision

- **Database columns are always `snake_case`** (`sender_id`, `receiver_id`, `avatar_url`, `praxis_points`, `onboarding_completed`, `created_at`).
- **TypeScript types and React props are `camelCase`** (`senderId`, `avatarUrl`, `praxisPoints`).
- **The mapping is manual, per-controller.** Each controller that reads or writes a row does its own rename. There is no centralized ORM or schema-driven transformer.
- Exception: `goal_trees.userId` is stored quoted-camelCase in the DB for historical reasons (Gemini-era migration). All `.eq('userId', ...)` calls in `src/controllers/goalController.ts` are intentionally camelCase and correct.

## Consequences

- ✅ Each side follows its native convention. No lint fights with ecosystem tooling (Supabase's JS client accepts either, but errors from the DB quote columns in snake_case, which stays legible).
- ✅ Performance-critical paths can select only the fields they need without a normalizer pass.
- ❌ Every new controller that touches a new table pays the rename cost again. Bugs manifest as `undefined` on the frontend when someone forgets to rename.
- ❌ A buyer doing diligence has to learn this by reading code — it's not enforced by a type system.

## When this might get revisited

When `any` count in controllers drops below 50 (see `docs/compliance/code-quality-baseline.md`), consider introducing a lightweight row-type codegen from Supabase (e.g. `supabase gen types typescript`) so the rename becomes type-checked. Not urgent until the `any` debt is lower — otherwise you'd be mapping `any` to `any`.
