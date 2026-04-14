# Praxis Runbook

Operational reference for anyone taking over this codebase cold. Kept intentionally terse — if a section gets long, move detail into `docs/` and link from here.

---

## 1. Architecture at a glance

| Layer    | Stack                                                  | Source                                | Deploys to              |
| -------- | ------------------------------------------------------ | ------------------------------------- | ----------------------- |
| Backend  | Express 5 + TypeScript, Node ≥ 20                      | `src/`                                | Railway (`/api`)        |
| Frontend | React 19 + MUI v7 + Vite                               | `client/src/`                         | Vercel (static)         |
| Database | Supabase (Postgres) + RLS                              | `migrations/`                         | Supabase hosted project |
| Auth     | Supabase JWT (anon on client, service-role on backend) | —                                     | —                       |
| Payments | Stripe (subscription + one-off PP)                     | `src/controllers/stripeController.ts` | Stripe dashboard        |

Backend calls Supabase with the **service-role key** (bypasses RLS). Frontend uses the **anon key** (subject to RLS). Never expose service-role in frontend code.

---

## 2. First-time bring-up (clone → running in ~5 min)

```bash
git clone https://github.com/ilPez00/praxis_webapp.git && cd praxis_webapp

# 1. Install
npm install
(cd client && npm install)

# 2. Environment — see §3 for each variable
cp .env.example .env
(cd client && cp .env.example .env)
# then edit both .env files with real keys

# 3. Database — apply migrations (see §4)

# 4. Start dev
npm run dev            # backend on :3001 (nodemon)
(cd client && npm run dev)   # frontend on :5173 (vite)
```

Health probe: `curl http://localhost:3001/health` → `{"status":"ok"}`.

---

## 3. Environment variables

### Backend `.env`

| Var                                      | Purpose                         | Where to get it                                         |
| ---------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| `SUPABASE_URL`                           | Project URL                     | Supabase dashboard → Project Settings → API             |
| `SUPABASE_SERVICE_ROLE_KEY`              | Bypasses RLS for backend writes | Same page. **Never commit.**                            |
| `STRIPE_SECRET_KEY`                      | Server-side Stripe              | Stripe dashboard → Developers → API keys                |
| `STRIPE_WEBHOOK_SECRET`                  | Verifies webhook signatures     | Stripe dashboard → Webhooks → endpoint → Signing secret |
| `STRIPE_PRICE_ID`                        | Default subscription price      | Stripe dashboard → Products                             |
| `RESEND_API_KEY`                         | Transactional email             | resend.com → API keys                                   |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push                        | `npx web-push generate-vapid-keys`                      |
| `GOOGLE_AI_API_KEY`                      | Axiom daily briefs              | Google AI Studio                                        |
| `PORT`                                   | Default 3001                    | —                                                       |
| `NODE_ENV`                               | `development` / `production`    | —                                                       |

### Frontend `client/.env`

| Var                           | Purpose                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- |
| `REACT_APP_API_URL`           | Backend base URL (e.g. `https://web-production-646a4.up.railway.app/api`) |
| `REACT_APP_SUPABASE_URL`      | Same as backend                                                           |
| `REACT_APP_SUPABASE_ANON_KEY` | Public anon key — safe in bundle                                          |
| `REACT_APP_STRIPE_PUBLIC_KEY` | `pk_live_...` or `pk_test_...`                                            |

⚠️ `client/src/lib/api.ts` has a **hardcoded Railway fallback** for when Vercel fails to bake `REACT_APP_API_URL` into the build. See asset-prep plan P1 — this is load-bearing and should be removed only with env-var reliability confirmed.

---

## 4. Database migrations

All migrations live in `migrations/` as timestamped `.sql` files. There is **no automated runner yet** (P1 item). Apply in order via Supabase SQL editor.

| When                      | Action                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| New migration added       | Run it once in Supabase SQL editor, note file name in `manual_actions.txt`                                    |
| Full rebuild from scratch | Apply files in `ls migrations/*.sql` alphabetical order                                                       |
| Rollback                  | No automated rollback. Fixes live as new migration files (look for `fix-` or `revert-` prefix in the history) |

---

## 5. Deploy

### Frontend (Vercel)

- Auto-deploys on `main` push. No manual action.
- Rollback: Vercel dashboard → Deployments → pick a previous deploy → "Promote to Production".
- Env vars live in Vercel → Project Settings → Environment Variables.

### Backend (Railway)

- Auto-deploys on `main` push via `railway.toml`.
- Healthcheck window: 5 min. If the new deploy fails healthcheck, Railway rolls back automatically.
- Probe: `curl https://web-production-646a4.up.railway.app/health`.
- Rollback: Railway dashboard → Deployments → "Redeploy" an older successful build.
- Env vars live in Railway → Variables tab.

### Stripe webhook

Registered in Stripe dashboard → Webhooks. Endpoint: `https://web-production-646a4.up.railway.app/api/stripe/webhook`. Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`. Signing secret goes into Railway as `STRIPE_WEBHOOK_SECRET`.

---

## 6. Emergency procedures

### "Production write endpoints are 500ing"

Symptom: POSTs return 500 with "permission denied" or RLS violation.
Cause: Railway `SUPABASE_SERVICE_ROLE_KEY` is stale / is actually the publishable key.
Fix: Supabase → Settings → API → copy `service_role` (secret) key → Railway → Variables → update → redeploy.

### "Frontend returns HTML when expecting JSON"

Symptom: `SyntaxError: Unexpected token '<'` in browser console on API calls.
Cause: `REACT_APP_API_URL` missing at Vercel build time → fallback didn't apply or points somewhere wrong.
Fix: Vercel dashboard → Env Vars → confirm `REACT_APP_API_URL` is set for "Production" → trigger redeploy.

### "Stripe webhook events not firing"

Symptom: subscriptions paid but user not upgraded.
Fix: Stripe dashboard → Webhooks → recent deliveries. Check signing secret matches Railway env var. Resend the failed events.

### "I need to rotate the Supabase service-role key"

1. Supabase → Settings → API → "Reset service_role".
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Railway.
3. Redeploy backend.
4. Verify with `curl -X POST https://.../api/checkins ...` using a real user JWT.

---

## 7. Day-to-day commands

```bash
# Backend
npm run dev               # nodemon src/index.ts
npm run build             # tsc → dist/
npm start                 # node dist/index.js
npm test                  # jest
npm run test:e2e          # playwright
npm run lint              # eslint src/**/*.ts

# Frontend
cd client && npm run dev      # vite dev server
cd client && npm run build    # vite build → dist/
cd client && npx tsc --noEmit # type check without emit

# Audits
grep -rn ": any" src client/src --include="*.ts" --include="*.tsx" | wc -l
npx license-checker --production --summary
```

---

## 8. Known operational gotchas

- **Supabase columns are snake_case** everywhere. TS types use camelCase. The mapping is scattered across controllers — search for the column name in `src/controllers/` if unsure.
- **MUI v7 Grid API:** `<Grid size={{ xs: 6 }}>` not `<Grid item xs={6}>`. The old API is gone.
- **`for...of` on a `Set`** won't transpile at this TS target. Use `Array.from(set).forEach(...)`.
- **Railway healthcheck timeout is 5 minutes** from first boot log to `/health` returning 200. Slow cold starts can trigger a rollback — if the build succeeded but healthcheck failed, push an empty commit to retry.
- **Onboarding gate:** `user.onboarding_completed === false` (strict — `undefined` bypasses).

---

## 9. Where the rest lives

- `CLAUDE.md` — agent-facing conventions and session-log rules
- `docs/plans/2026-04-14-asset-prep-plan.md` — the work queue for making this sellable
- `docs/compliance/licenses.md` — dependency license audit
- `docs/compliance/code-quality-baseline.md` — `any` count, test count, secret scan
- `docs/sale-readiness-report.md` + `docs/acquisition-packet.md` — external pitch
- `claude_steps.txt` — canonical dev log (append each session)
- `manual_actions.txt` — one-off Supabase/Stripe setup steps not yet automated
