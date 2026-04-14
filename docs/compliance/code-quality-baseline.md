# Code Quality Baseline

**Generated:** 2026-04-14
**Purpose:** Snapshot for tracking improvement toward asset-grade quality.

## TypeScript discipline

| Metric                            | Backend (`src/`) | Frontend (`client/src/`) | Notes                                                       |
| --------------------------------- | ---------------- | ------------------------ | ----------------------------------------------------------- |
| `: any` occurrences               | **413**          | **254**                  | Target: < 50 in auth/money paths, < 200 total per workspace |
| `@ts-ignore` / `@ts-expect-error` | 0                | 0                        | ✅ Clean — no suppressed errors                             |

**Interpretation:** 667 `any` is high for a codebase this size, but zero ts-ignore means no known errors are being hidden — the `any`s are laziness, not unfixable problems. Chipping away at `any` in controllers touching Stripe, auth, and points is the highest-value diligence move.

## Tests

| Type                     | Count                      | Location          |
| ------------------------ | -------------------------- | ----------------- |
| Backend unit/integration | 4                          | `tests/*.test.ts` |
| Frontend unit            | 0                          | —                 |
| Playwright E2E           | see `playwright.config.ts` | `tests/`          |

**Interpretation:** A buyer's technical diligence will grep for `describe(` and value the codebase ~30% lower if the count is near zero. Priority tests to add (see asset-prep plan P1):

- Stripe webhook idempotency
- Auth login failure modes
- Check-in double-submit
- Points `spend` insufficient-balance path

## Secrets scan

- ✅ No `.env` files tracked (only `.env.example`).
- ✅ No JWT-looking or `sk_live_` / `rk_live_` patterns in tracked source files.
- False positives in docs/README (template env var names) only.

## Deprecated transitive deps (from npm warnings)

Both workspaces carry the usual `inflight@1.0.6`, `glob@7.x`, `read-installed`, `osenv`, `readdir-scoped-modules` via `license-checker`. These are dev-tool transitive dependencies, not production. Safe to ignore; disappear when `license-checker` bumps.

## Next baseline refresh

Re-run after each `any` cleanup sprint or dependency bump. Commands:

```bash
grep -rn ": any" src --include="*.ts" | wc -l
grep -rn ": any" client/src --include="*.ts" --include="*.tsx" | wc -l
grep -rnE "@ts-(ignore|expect-error)" src client/src | wc -l
```
