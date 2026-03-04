# Getting Started — Local Development

## Prerequisites

- Node.js 18+
- npm 9+
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account (for payment features)
- A [Google AI Studio](https://aistudio.google.com) API key (for Gemini features)

---

## 1. Clone the Repo

```bash
git clone git@github.com:ilPez00/praxis_webapp.git
cd praxis_webapp
```

---

## 2. Backend Setup

### Install dependencies

```bash
npm install
```

### Create `.env` at project root

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # Must be the SERVICE ROLE key, not anon
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
GEMINI_API_KEY=AIza...
CLIENT_URL=http://localhost:3000
ADMIN_SECRET=your-secret-for-admin-routes
PORT=3001
```

> **Important:** `SUPABASE_SERVICE_ROLE_KEY` must be the **service role** JWT (long key starting with `eyJhbGci`), not the publishable/anon key. Find it in Supabase → Settings → API → `service_role`.

### Run the backend

```bash
npm run dev
```

Backend starts on `http://localhost:3001`.

---

## 3. Frontend Setup

### Install dependencies

```bash
npm install --prefix client
```

### Create `client/.env`

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...   # Anon/public key
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
REACT_APP_API_URL=http://localhost:3001/api
```

### Run the frontend

```bash
npm start --prefix client
```

Frontend starts on `http://localhost:3000`.

---

## 4. Database Setup

Run the migration file in your Supabase SQL Editor:

```bash
# Copy contents of migrations/setup.sql and paste into Supabase SQL Editor
# The file is fully idempotent — safe to run multiple times
```

Then create these Storage buckets in Supabase → Storage:
- `avatars` — **Public: ON**
- `chat-media` — **Public: ON**

---

## 5. Verify Everything Works

```bash
# Check backend health
curl http://localhost:3001/api/health

# Frontend should load at http://localhost:3000
# Sign up → complete onboarding → build your goal tree
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend with nodemon (hot reload) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start --prefix client` | Start React dev server |
| `npm run build --prefix client` | Production build of frontend |
| `npx tsc --noEmit` | Type-check backend |
| `npx tsc --noEmit` (in `client/`) | Type-check frontend |

---

## Common Issues

### `SUPABASE_PUBLISHABLE_KEY` error on startup
The backend requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. If using an old `.env` with `SUPABASE_PUBLISHABLE_KEY`, rename it.

### Goal tree edit blocked
The free tier allows one edit. Reset via Supabase SQL:
```sql
UPDATE profiles SET goal_tree_edit_count = 0 WHERE id = 'your-user-id';
```

### TypeScript reference errors in `src/index.ts`
The file needs a triple-slash reference for global type augmentations:
```typescript
/// <reference path="../node_modules/@types/express/index.d.ts" />
```
