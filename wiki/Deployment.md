# Deployment

Praxis uses a split deployment:

| Layer | Platform | URL |
|-------|----------|-----|
| Frontend (primary) | Vercel | `https://praxis-webapp.vercel.app` |
| Frontend (mirror) | GitHub Pages | `https://ilpez00.github.io/praxis_webapp` |
| Backend API | Railway | `https://web-production-646a4.up.railway.app` |

---

## Backend — Railway

### Environment Variables (set in Railway dashboard)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # Long service_role JWT
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
GEMINI_API_KEY=AIza...
CLIENT_URL=https://praxis-webapp.vercel.app
ADMIN_SECRET=your-secret
PORT=3001
```

### Deploy Process

Railway auto-deploys on push to `main`. The `railway.toml` specifies:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
```

`npm start` runs `node dist/index.js` (pre-compiled TypeScript).

### Health Check

```bash
curl https://web-production-646a4.up.railway.app/api/health
```

---

## Frontend Primary — Vercel

### `vercel.json`

```json
{
  "installCommand": "npm install && npm install --prefix client",
  "buildCommand": "npm run build --prefix client",
  "outputDirectory": "client/build",
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://web-production-646a4.up.railway.app/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The second rewrite (`/(.*) → /index.html`) enables React Router client-side navigation.
The first rewrite proxies `/api/*` to Railway as a backup (frontend already calls Railway directly).

### Vercel Environment Variables

No environment variables are strictly required — `client/src/lib/api.ts` hardcodes Railway as the production fallback. Optionally set:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_STRIPE_PUBLISHABLE_KEY`

---

## Frontend Mirror — GitHub Pages

The app is also deployable to GitHub Pages using the `gh-pages` package.

### One-time setup

GitHub Pages is configured to serve from the `gh-pages` branch. The app is deployed there automatically with:

```bash
cd client
npm run deploy
```

This runs `npm run build` then pushes `build/` to the `gh-pages` branch.

### How SPA routing works on GitHub Pages

GitHub Pages serves a static 404 page for unknown paths. The app uses a `404.html` redirect trick:

1. When a user navigates directly to `/dashboard`, GitHub Pages serves `404.html`
2. `404.html` encodes the requested path into `?p=/dashboard` and redirects to `/`
3. `index.html` reads `?p=` and calls `history.replaceState` to restore the real URL
4. React Router then picks up the correct route

This preserves clean URLs (no `#/`) on GitHub Pages.

### GitHub Pages URL

```
https://ilpez00.github.io/praxis_webapp
```

API calls always go directly to Railway regardless of which frontend URL is used.

---

## Stripe Webhook Setup

1. Go to Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://web-production-646a4.up.railway.app/api/payments/webhook`
3. Events to listen for: `checkout.session.completed`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` on Railway

---

## Supabase Row-Level Security

RLS policies are defined in `migrations/setup.sql`. Key policies:
- `messages`: users can only read messages where they are sender or receiver
- `profiles`: anyone can read, only owner can update
- `goal_trees`: anyone can read (for public profiles), only owner can write
- `chat_room_members`: only room members can read group messages
