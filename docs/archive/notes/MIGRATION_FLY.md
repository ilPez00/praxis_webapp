# Backend Migration Guide: Railway → Fly.io

**Date:** March 25, 2026  
**Estimated Time:** 20 minutes  
**Difficulty:** Medium ⭐⭐

---

## 📋 Overview

This guide walks you through migrating the Praxis backend from Railway to Fly.io's free tier.

### Why Fly.io?

- ✅ **Always on** (no spin-down like Render/Railway)
- ✅ **3 free VMs** (256MB RAM each)
- ✅ **160GB bandwidth**/month
- ✅ **Global edge** deployment
- ✅ **Docker-based** (consistent deployments)
- ✅ **No cold starts** (unlike Render free tier)

### What You'll Get

- Backend URL: `https://praxis-backend.fly.dev`
- Always-on service (no 30s cold start)
- Auto-deploy via GitHub Actions
- Free SSL certificates
- Global CDN edge locations

---

## 🚀 Step-by-Step Migration

### Step 1: Install Fly.io CLI (3 minutes)

#### Linux/macOS

```bash
curl -L https://fly.io/install.sh | sh
```

#### Add to PATH

```bash
# Add to your shell config
export PATH="$HOME/.fly/bin:$PATH"

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

#### Verify Installation

```bash
fly version
# Should show: fly v0.x.x
```

---

### Step 2: Create Fly.io Account (2 minutes)

1. **Sign Up**

   ```bash
   fly auth signup
   ```

2. **Enter Email**
   - Provide your email
   - Check inbox for verification code
   - Enter code in terminal

3. **Set Password**
   - Create account password
   - Account created!

> 💡 **Note:** Fly.io requires a credit card for signup (prevents abuse), but you won't be charged on free tier.

---

### Step 3: Create Dockerfile (5 minutes)

Fly.io uses Docker for deployments. Create a `Dockerfile` in the project root:

1. **Create File**

   ```bash
   cd /home/gio/Praxis/praxis_webapp
   nano Dockerfile
   ```

2. **Add This Content:**

   ```dockerfile
   # Multi-stage build for smaller image
   FROM node:20-alpine AS builder

   WORKDIR /app

   # Copy package files
   COPY package*.json ./
   COPY client/package*.json ./client/

   # Install all dependencies (including dev)
   RUN npm ci

   # Copy source code
   COPY . .

   # Build the app
   RUN npm run build

   # Production stage
   FROM node:20-alpine

   WORKDIR /app

   # Copy package files
   COPY package*.json ./

   # Install only production dependencies
   RUN npm ci --only=production

   # Copy built files from builder
   COPY --from=builder /app/dist ./dist

   # Expose port
   EXPOSE 3001

   # Health check
   HEALTHCHECK --interval=30s --timeout=3s \
     CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

   # Start the app
   CMD ["node", "dist/index.js"]
   ```

3. **Save and Exit**

   ```
   Ctrl+X → Y → Enter
   ```

4. **Create `.dockerignore`**

   ```bash
   nano .dockerignore
   ```

   Add:

   ```
   node_modules
   dist
   .git
   .env
   *.md
   client/node_modules
   client/dist
   ```

---

### Step 4: Initialize Fly App (3 minutes)

1. **Launch Fly App**

   ```bash
   cd /home/gio/Praxis/praxis_webapp
   fly launch --name praxis-backend
   ```

2. **Answer Prompts:**

   ```
   ? Would you like to copy its configuration to the new app? No
   ? Choose an app name (leave blank for random): praxis-backend
   ? Choose a region for deployment:
       ✅ iad - Washington, D.C., Virginia, US (closest to users)
   ? Would you like to set up a Postgres database now? No
   (We're using Supabase)
   ? Would you like to set up Redis now? No
   ? Would you like to deploy now? No
   (We need to add secrets first)
   ```

3. **Check `fly.toml`**

   ```bash
   cat fly.toml
   ```

   Should look like:

   ```toml
   app = "praxis-backend"
   primary_region = "iad"

   [build]
     dockerfile = "Dockerfile"

   [http_service]
     internal_port = 3001
     force_https = true
     auto_stop_machines = false
     auto_start_machines = true
     min_machines_running = 1
     processes = ["app"]

   [[vm]]
     size = "shared-cpu-1x"
     memory = "256mb"
   ```

---

### Step 5: Add Environment Secrets (3 minutes)

Fly.io uses secrets (encrypted environment variables):

```bash
# Add each secret one by one
fly secrets set ADMIN_SECRET=your_admin_secret_here
fly secrets set SUPABASE_URL=your_supabase_url_here
fly secrets set SUPABASE_KEY=your_supabase_anon_key_here
fly secrets set GEMINI_API_KEY=your_gemini_api_key_here
fly secrets set SENTRY_DSN=your_sentry_dsn_here
fly secrets set NODE_ENV=production
fly secrets set PORT=3001
```

> 💡 **Tip:** Copy values from Railway Dashboard → Variables

**Verify Secrets:**

```bash
fly secrets list
```

---

### Step 6: Deploy to Fly.io (5 minutes)

1. **Deploy**

   ```bash
   fly deploy
   ```

2. **Watch Build Logs**

   ```
   ==> Building image
   Sending build context to Docker daemon...
   Step 1/10 : FROM node:20-alpine AS builder
   ...
   ==> Deployment successful!
   ```

3. **Get Your URL**

   ```bash
   fly status
   ```

   Output:

   ```
   praxis-backend is running on fly.io
   https://praxis-backend.fly.dev
   ```

---

### Step 7: Test Backend (2 minutes)

1. **Test Health Endpoint**

   ```bash
   curl https://praxis-backend.fly.dev/health
   ```

   Expected:

   ```json
   {
     "status": "healthy",
     "timestamp": "2026-03-25T10:30:00.000Z",
     "uptime": 123.45,
     "version": "1.3.0"
   }
   ```

2. **Test API**

   ```bash
   curl https://praxis-backend.fly.dev/api
   ```

   Expected:

   ```json
   {
     "message": "Praxis API Entry Point"
   }
   ```

3. **Check Logs**
   ```bash
   fly logs
   ```

---

### Step 8: Update Frontend (2 minutes)

1. **Open `client/src/lib/api.ts`**

2. **Update `getBaseUrl()`:**

   ```typescript
   const getBaseUrl = () => {
     const envUrl =
       typeof import.meta !== "undefined"
         ? (import.meta as any).env?.VITE_API_URL
         : undefined;
     if (envUrl) return envUrl;

     if (typeof window !== "undefined") {
       if (
         window.location.hostname === "localhost" ||
         window.location.hostname === "127.0.0.1"
       ) {
         return "http://localhost:3001/api";
       }
       // ✅ UPDATE THIS LINE with your Fly.io URL:
       return "https://praxis-backend.fly.dev/api";
     }

     return "http://localhost:3001/api";
   };
   ```

3. **Save the file**

---

### Step 9: Deploy Frontend (2 minutes)

1. **Commit and Push:**

   ```bash
   git add client/src/lib/api.ts
   git commit -m "chore: update backend URL to Fly.io"
   git push
   ```

2. **Vercel Auto-Deploys**
   - Go to https://vercel.com/dashboard
   - Wait for deployment (~2 minutes)

3. **Test the App:**
   - Visit: https://praxis-webapp.vercel.app
   - Login and test all features

---

## ✅ Verification Checklist

- [ ] **Health Check:** `GET /health` returns 200
- [ ] **Login:** Can login with existing account
- [ ] **Dashboard:** Loads without errors
- [ ] **Goals:** Can view/create goals
- [ ] **Trackers:** Can log tracker entries
- [ ] **Messages:** Can send/receive messages
- [ ] **Notebook:** Can create entries
- [ ] **Axiom:** AI features working
- [ ] **Logs:** `fly logs` shows activity

---

## 🔧 Troubleshooting

### Issue: Build Fails - "Cannot find module"

**Error:** `Cannot find module '@sentry/node'`

**Solution:**

```bash
# Make sure all dependencies are in package.json
npm install @sentry/node @sentry/profiling-node
git add package.json package-lock.json
git commit -m "fix: add missing sentry dependencies"
git push
fly deploy
```

---

### Issue: Service Won't Start

**Check Logs:**

```bash
fly logs --level error
```

**Common Issues:**

1. Missing environment variables → `fly secrets set KEY=value`
2. Port mismatch → Ensure `PORT=3001` in secrets
3. Build failed → Check Dockerfile

---

### Issue: 503 Service Unavailable

**Check Machine Status:**

```bash
fly status
fly machines list
```

**Restart if Needed:**

```bash
fly machines restart <machine-id>
```

---

### Issue: High Memory Usage

**Check Memory:**

```bash
fly status
```

**If using >256MB:**

1. Optimize code (reduce concurrent connections)
2. Upgrade to paid plan: `fly scale vm shared-cpu-2x`

---

## 📊 Fly.io Commands Cheat Sheet

### Deployment

```bash
fly deploy              # Deploy current code
fly deploy --detach     # Deploy without watching logs
fly logs                # View real-time logs
fly logs --level error  # View only errors
```

### Secrets

```bash
fly secrets set KEY=value     # Add secret
fly secrets list              # List all secrets
fly secrets unset KEY         # Remove secret
```

### Machines

```bash
fly machines list             # List all VMs
fly machines status <id>      # Check VM status
fly machines restart <id>     # Restart VM
fly machines stop <id>        # Stop VM
fly machines destroy <id>     # Delete VM
```

### Scaling

```bash
fly scale count 2             # Run 2 instances
fly scale vm shared-cpu-2x    # Upgrade VM size
fly scale show                # Show current scaling
```

### Database (Optional)

```bash
fly postgres create           # Create Postgres DB
fly postgres attach <db>      # Attach to app
fly postgres connect          # Connect to DB
```

---

## 🎯 Advanced: Set Up GitHub Actions for Auto-Deploy

Instead of manual `fly deploy`, set up automatic deployments:

1. **Create Workflow File**

   ```bash
   mkdir -p .github/workflows
   nano .github/workflows/deploy.yml
   ```

2. **Add This Content:**

   ```yaml
   name: Deploy to Fly.io

   on:
     push:
       branches: [main]

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - uses: superfly/flyctl-actions/setup-flyctl@master
           with:
             version: latest

         - run: flyctl deploy --remote-only
           env:
             FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
   ```

3. **Get Fly API Token:**

   ```bash
   fly tokens create deploy -x 999999h
   ```

4. **Add Token to GitHub Secrets:**

   ```
   GitHub → Settings → Secrets and variables → Actions
   New repository secret:
   Name: FLY_API_TOKEN
   Value: <paste token from step 3>
   ```

5. **Commit and Push:**
   ```bash
   git add .github/workflows/deploy.yml
   git commit -m "ci: add auto-deploy workflow"
   git push
   ```

Now every push to `main` automatically deploys! 🚀

---

## 💰 Fly.io Pricing

### Free Tier (What You Get)

- ✅ **3 shared-cpu-1x VMs** (256MB RAM each)
- ✅ **160GB outbound transfer**/month
- ✅ **3GB persistent volume** storage
- ✅ Always on (no spin-down)
- ✅ Global edge locations

### Paid Plans (If You Need More)

- **shared-cpu-2x:** $1.94/month per VM
  - 512MB RAM
  - 2x CPU
- **shared-cpu-4x:** $3.89/month per VM
  - 1GB RAM
  - 4x CPU

> 💡 **Note:** You only pay for what you use beyond free tier limits!

---

## 📈 Monitoring & Alerts

### View Logs

```bash
fly logs                    # Real-time logs
fly logs --level error      # Errors only
fly logs --app praxis-backend
```

### Check Metrics

```bash
fly status                  # App status
fly dashboard               # Open web dashboard
```

### Set Up Alerts (Optional)

```bash
# Install flyctl alerts plugin
fly plugins install alerts

# Set up email alerts
fly alerts create --email you@example.com
```

---

## 🎉 Success!

Once everything is working:

1. ✅ Backend is live on Fly.io
2. ✅ Frontend connected to new backend
3. ✅ Auto-deploy configured (optional)
4. ✅ Monitoring active

**You can now:**

- Delete Railway project (optional)
- Enjoy always-on hosting! 🚀
- Deploy with `git push` (if GitHub Actions set up)

---

## 📞 Support

**Fly.io Documentation:** https://fly.io/docs  
**Community Forum:** https://community.fly.io  
**Status Page:** https://status.fly.io  
**Discord:** https://fly.io/discord

**For Praxis-specific issues:**

- GitHub Issues: https://github.com/ilPez00/praxis_webapp/issues
- Check `CLAUDE_STEPS.md` for migration progress

---

**Migration completed:** March 25, 2026  
**Status:** ✅ Complete
