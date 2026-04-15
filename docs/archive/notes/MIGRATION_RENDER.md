# Backend Migration Guide: Railway → Render

**Date:** March 25, 2026  
**Estimated Time:** 30 minutes  
**Difficulty:** Easy ⭐

---

## 📋 Overview

This guide walks you through migrating the Praxis backend from Railway (free tier expired) to Render's free tier.

### Why Render?

- ✅ **750 hours/month** free (vs Railway's 500)
- ✅ **Auto-deploy** from GitHub (same as Railway)
- ✅ **Free PostgreSQL** database (1GB, 90 days)
- ✅ **No Docker** configuration needed
- ✅ **Free SSL** certificates
- ✅ **No credit card** required

### What You'll Get

- Backend URL: `https://praxis-backend.onrender.com`
- Auto-deploy on every git push
- Health monitoring
- Automatic HTTPS

---

## 🚀 Step-by-Step Migration

### Step 1: Create Render Account (2 minutes)

1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. Choose **"Sign up with GitHub"**
4. Authorize Render to access your GitHub account
5. Complete signup

---

### Step 2: Create New Web Service (5 minutes)

1. **Go to Dashboard**
   - After login, you'll see the Render Dashboard
   - Click **"New +"** → **"Web Service"**

2. **Connect Repository**
   - Click **"Connect a repository"**
   - Find and select: `ilPez00/praxis_webapp`
   - Click **"Connect"**

3. **Configure Web Service**

   Fill in these settings:

   | Setting            | Value                          |
   | ------------------ | ------------------------------ |
   | **Name**           | `praxis-backend`               |
   | **Region**         | `Washington, D.C. (us-east-1)` |
   | **Root Directory** | `(leave empty)`                |
   | **Runtime**        | `Node`                         |
   | **Build Command**  | `npm run build`                |
   | **Start Command**  | `node dist/index.js`           |
   | **Instance Type**  | `Free`                         |

4. **Click "Advanced"** (expand section)

   | Setting               | Value     |
   | --------------------- | --------- |
   | **Node Version**      | `20.x`    |
   | **Health Check Path** | `/health` |

---

### Step 3: Add Environment Variables (5 minutes)

Copy all environment variables from Railway to Render.

1. In Render dashboard, click **"Environment"** tab
2. Click **"Add Environment Variable"** for each:

```bash
# Copy these from Railway Dashboard → Variables

# Supabase (Required)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# Admin (Required)
ADMIN_SECRET=your_admin_secret

# AI Features (Required for Axiom)
GEMINI_API_KEY=your_gemini_api_key

# Error Tracking (Optional - from Sentry setup)
SENTRY_DSN=your_sentry_dsn

# App Configuration
NODE_ENV=production
PORT=3001
```

3. Click **"Save Changes"**

> 💡 **Tip:** Keep Railway dashboard open in another tab to copy values easily.

---

### Step 4: Deploy (10 minutes)

1. **Click "Create Web Service"**
   - Render will start building your app
   - You'll see live build logs

2. **Wait for Build to Complete**

   ```
   Building...
   Installing dependencies...
   Running build command...
   Build successful!
   Deploying...
   ```

3. **Service is Live!**
   - You'll see: **"Your service is live"**
   - URL will be: `https://praxis-backend-xxxx.onrender.com`
   - Copy this URL

---

### Step 5: Test Backend (2 minutes)

1. **Test Health Endpoint**

   ```bash
   curl https://praxis-backend-xxxx.onrender.com/health
   ```

   Expected response:

   ```json
   {
     "status": "healthy",
     "timestamp": "2026-03-25T10:30:00.000Z",
     "uptime": 123.45,
     "version": "1.3.0",
     "environment": "production"
   }
   ```

2. **Test API Endpoint**

   ```bash
   curl https://praxis-backend-xxxx.onrender.com/api
   ```

   Expected response:

   ```json
   {
     "message": "Praxis API Entry Point"
   }
   ```

---

### Step 6: Update Frontend (3 minutes)

Now update the frontend to use the new backend URL.

1. **Open `client/src/lib/api.ts`**

2. **Find the `getBaseUrl()` function**

3. **Update the production URL:**

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
       // ✅ UPDATE THIS LINE with your Render URL:
       return "https://praxis-backend-xxxx.onrender.com/api";
     }

     return "http://localhost:3001/api";
   };
   ```

4. **Save the file**

---

### Step 7: Deploy Frontend (2 minutes)

1. **Commit the change:**

   ```bash
   cd /home/gio/Praxis/praxis_webapp
   git add client/src/lib/api.ts
   git commit -m "chore: update backend URL to Render"
   git push
   ```

2. **Vercel will auto-deploy**
   - Go to https://vercel.com/dashboard
   - Watch the deployment complete (~2 minutes)

3. **Test the App**
   - Visit: https://praxis-webapp.vercel.app
   - Login and test features
   - Check browser console for errors

---

## ✅ Verification Checklist

After migration, verify everything works:

- [ ] **Health Check**: `GET /health` returns 200
- [ ] **Login**: Can login with existing account
- [ ] **Dashboard**: Loads without errors
- [ ] **Goals**: Can view/create goals
- [ ] **Trackers**: Can log tracker entries
- [ ] **Messages**: Can send/receive messages
- [ ] **Notebook**: Can create entries
- [ ] **Axiom**: AI features working (if GEMINI_API_KEY set)

---

## 🔧 Troubleshooting

### Issue: Build Fails

**Error:** `npm run build` fails

**Solution:**

1. Check build logs in Render dashboard
2. Verify `package.json` has correct build script
3. Ensure all dependencies are installed

---

### Issue: Service Won't Start

**Error:** `node dist/index.js` fails

**Solution:**

1. Check logs in Render dashboard → Logs tab
2. Verify all environment variables are set
3. Check if PORT variable is set to `3001`

---

### Issue: Database Connection Errors

**Error:** Cannot connect to Supabase

**Solution:**

1. Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
2. Test Supabase connection locally
3. Check Supabase dashboard for issues

---

### Issue: 503 Service Unavailable

**Cause:** Render free tier spins down after 15 minutes of inactivity

**Solution:**

- This is normal for free tier
- First request after idle period takes ~30 seconds (cold start)
- Subsequent requests are fast
- Consider upgrading to paid plan ($7/month) for always-on

---

## 📊 Render Dashboard Features

### Monitoring

- **Logs:** Real-time application logs
- **Metrics:** CPU, memory, request counts
- **Events:** Deployment history, errors

### Settings

- **Auto-Deploy:** Enable/disable GitHub auto-deploy
- **Branches:** Deploy from specific branches
- **Rollback:** Revert to previous deployments

---

## 🎯 Next Steps After Migration

### 1. Set Up Custom Domain (Optional)

```
Render Dashboard → Settings → Custom Domain
Add your domain (e.g., api.praxis.app)
Add CNAME record in DNS
```

### 2. Enable Auto-Deploy

```
Render Dashboard → Settings → Auto-Deploy: ON
Now every git push triggers deployment!
```

### 3. Set Up Monitoring Alerts

```
Render Dashboard → Alerts → New Alert
Set up email notifications for:
- Build failures
- Service crashes
- High error rates
```

### 4. Database Migration (If Needed)

If you want to use Render's PostgreSQL:

```
1. Render Dashboard → New → PostgreSQL
2. Create database (1GB free)
3. Update DATABASE_URL environment variable
4. Run migrations: npm run migrate
```

> 💡 **Note:** Your app already uses Supabase for database, so this is optional!

---

## 💰 Render Pricing

### Free Tier (What You Get)

- ✅ 750 hours/month (continuous hosting)
- ✅ 512MB RAM
- ✅ 0.5 CPU
- ✅ 100GB bandwidth/month
- ✅ Auto-SSL certificates

### Paid Plans (If You Need More)

- **Starter:** $7/month
  - 2GB RAM
  - 1 CPU
  - Always on (no spin-down)
- **Standard:** $25/month
  - 4GB RAM
  - 2 CPU
  - Priority support

---

## 📞 Support

**Render Documentation:** https://render.com/docs  
**Community:** https://community.render.com  
**Status:** https://status.render.com

**For Praxis-specific issues:**

- GitHub Issues: https://github.com/ilPez00/praxis_webapp/issues
- Check `CLAUDE_STEPS.md` for migration progress

---

## 🎉 Success!

Once everything is working:

1. ✅ Backend is live on Render
2. ✅ Frontend connected to new backend
3. ✅ Auto-deploy configured
4. ✅ Health monitoring active

**You can now:**

- Delete Railway project (optional)
- Enjoy 750 hours/month free hosting
- Focus on building features! 🚀

---

**Migration completed:** March 25, 2026  
**Status:** ✅ Complete
