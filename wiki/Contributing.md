# Contributing

## Development Workflow

1. Work on `main` branch (or feature branches for large changes)
2. Run both type checkers before committing:
   ```bash
   npx tsc --noEmit          # backend
   npx tsc --noEmit          # run from client/ for frontend
   ```
3. Update `claude_steps.txt` dev log at the end of each session

---

## Key Conventions

### MUI v7 Grid
```tsx
// ✅ Correct (MUI v7 API)
<Grid size={{ xs: 12, md: 6 }}>

// ❌ Wrong (old API, removed in v7)
<Grid item xs={12} md={6}>
```

### theme.spacing
```tsx
// ✅ Correct
sx={{ padding: theme.spacing(level * 2) }}

// ❌ Wrong (returns string × number)
sx={{ padding: level * theme.spacing(2) }}
```

### API calls
Always use the `API_URL` constant — never hardcode `localhost:3001`:
```ts
import { API_URL } from '../../lib/api';
axios.get(`${API_URL}/endpoint`);
```

### Supabase column names
Use snake_case to match the database schema:
- `sender_id`, `receiver_id`, `avatar_url`, `created_at`
- NOT `senderId`, `receiverId`, `avatarUrl`

### Array safety
Always guard API responses with `Array.isArray()`:
```ts
setItems(Array.isArray(response.data) ? response.data : []);
```

### Set iteration
```ts
// ✅ Correct (TypeScript downlevel compat)
Array.from(mySet).map(...)

// ❌ Wrong (breaks on older TS targets)
for (const item of mySet) ...
```

### Onboarding guard
```ts
// ✅ Correct — strict check, undefined doesn't trigger redirect
if (user.onboarding_completed === false) redirect('/onboarding');

// ❌ Wrong — undefined would also trigger
if (!user.onboarding_completed) redirect('/onboarding');
```

---

## File Structure Conventions

### Import paths
Files in `features/*/components/` need three levels up to reach `src/models/`:
```ts
import { Domain } from '../../../models/Domain';
```

### New feature modules
Create a directory under `client/src/features/yourFeature/`:
```
features/
  yourFeature/
    YourFeaturePage.tsx     # Main page component
    components/             # Sub-components
    hooks/                  # Feature-specific hooks
```

Add the route to `client/src/config/routes.tsx`.

### New API endpoints
1. Create controller in `src/controllers/yourController.ts`
2. Create router in `src/routes/yourRoutes.ts`
3. Mount in `src/index.ts`: `app.use('/api/your-resource', yourRouter)`

---

## Environment Variables Reference

### Backend (`/.env`)
```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # service_role JWT — NOT anon
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
GEMINI_API_KEY=
CLIENT_URL=
ADMIN_SECRET=
PORT=3001
```

### Frontend (`client/.env`)
```env
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
REACT_APP_STRIPE_PUBLISHABLE_KEY=
REACT_APP_API_URL=http://localhost:3001/api   # local only
```

---

## Updating the Wiki

The wiki source files live in `wiki/` in the main repo. To publish updates:

```bash
# Clone the wiki repo (separate from main repo)
git clone https://github.com/ilPez00/praxis_webapp.wiki.git wiki-repo
cd wiki-repo

# Copy updated files
cp ../wiki/*.md .

# Commit and push
git add .
git commit -m "Update wiki"
git push
```

---

## Committing

- Backend + frontend TypeScript must both be 0 errors before committing
- Update `claude_steps.txt` with a session summary
- No `--no-verify` bypasses
- Prefer specific file staging over `git add .`
