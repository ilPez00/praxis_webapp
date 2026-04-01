# 🚀 PRAXIS GAMIFICATION — DEPLOYMENT GUIDE

### _Phase 1 & 2 Complete — Production Ready_

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### ✅ Code Status

- [x] All commits pushed to GitHub (`main` branch)
- [x] TypeScript build passes (0 errors)
- [x] Vercel auto-deploy triggered
- [x] No console errors in development

### 📦 Files to Deploy

**Already pushed:**

- Backend controllers, routes, schemas
- Frontend components, hooks, pages
- Database migrations

---

## 🗄️ DATABASE MIGRATIONS (REQUIRED)

### Step 1: Run Phase 1 Migration

**File:** `migrations/2026-03-28-gamification-phase1.sql`

**What it creates:**

- 6 new tables (`daily_quests`, `user_daily_quests`, `achievements_master`, `user_achievements`, `social_rewards_tracking`, `level_rewards`)
- 7 database functions (`update_user_level`, `add_xp_to_user`, `get_daily_quests_for_user`, `progress_user_quest`, `check_user_achievements`, `update_user_leagues`, `reset_daily_quests`)
- Modifies `profiles` table (adds `total_xp`, `level`, `league`, `equipped_title`, `profile_theme`, `reputation_score`)

**How to run:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy entire SQL file content
3. Paste and run
4. Verify: Check that tables exist in Table Editor

**Expected output:**

```
SUCCESS: 6 tables created
SUCCESS: 7 functions created
SUCCESS: profiles table altered
SUCCESS: 27 achievements seeded
SUCCESS: 10 quest templates seeded
```

---

### Step 2: Run Phase 2 Migration

**File:** `migrations/2026-03-28-gamification-events.sql`

**What it creates:**

- 1 new table (`gamification_events`)
- 4 functions (`emit_level_up_event`, `emit_achievement_event`, `emit_quest_complete_event`, `cleanup_gamification_events`)
- 1 trigger (`trg_emit_level_up`)

**How to run:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy entire SQL file content
3. Paste and run
4. Verify: Check that `gamification_events` table exists

**Expected output:**

```
SUCCESS: 1 table created
SUCCESS: 4 functions created
SUCCESS: 1 trigger created
```

---

## ⚙️ BACKEND DEPLOYMENT (Railway)

### Automatic Deployment

If Railway is connected to GitHub:

1. Push is already done ✅
2. Railway will auto-deploy on push
3. Wait for deployment to complete (~2-3 minutes)

### Manual Deployment (if needed)

```bash
# SSH into Railway instance or use Railway CLI
railway up
```

### Environment Variables to Verify

```bash
# Required for gamification
DATABASE_URL=postgresql://...  # Supabase connection string
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Service role key
```

### Verify Backend Deployment

```bash
# Test gamification endpoints
curl -X GET https://your-railway-url.up.railway.app/api/gamification/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: 200 OK with profile data
```

---

## 🌐 FRONTEND DEPLOYMENT (Vercel)

### Automatic Deployment

Vercel auto-deploys on push to `main`:

1. ✅ Push already done
2. Check Vercel dashboard for build status
3. Build time: ~3-4 minutes
4. Preview URL will be available

### Verify Frontend Deployment

1. Go to deployed URL: `https://praxis-webapp.vercel.app`
2. Login with test account
3. Navigate to Dashboard
4. Check for:
   - Daily Quests Widget (should show 3 quests)
   - Level badge in navbar (should show level 1)
   - PP/XP toast on check-in

---

## 🧪 TESTING CHECKLIST

### Core Gamification Flow

**1. Level System**

- [ ] Login → Check navbar (level badge visible)
- [ ] Visit profile → See XP progress bar
- [ ] Complete check-in → See level increase (if XP earned)
- [ ] Level up → See celebration dialog

**2. Daily Quests**

- [ ] Dashboard → See 3 daily quests
- [ ] Complete check-in → Quest progress updates
- [ ] Create post → Quest progress updates
- [ ] Comment → Quest progress updates
- [ ] Claim reward → Receive XP+PP

**3. Achievements**

- [ ] Complete goal → Achievement unlocked toast
- [ ] Win bet → Achievement unlocked toast
- [ ] Visit profile → See unlocked achievements

**4. Social Rewards**

- [ ] Create post → +2 PP, +4 XP
- [ ] Comment → +1 PP, +2 XP
- [ ] Check daily limit not exceeded

**5. Notifications**

- [ ] Level up → Toast notification appears
- [ ] Achievement unlock → Toast with XP/PP
- [ ] Quest complete → Toast notification

**6. Leaderboard**

- [ ] Visit /leaderboard
- [ ] See level badges next to names
- [ ] See league badges next to names
- [ ] Filter by league (Diamond/Platinum/Gold/Silver/Bronze)
- [ ] Filter by aligned/all users

---

## 🔧 CRON JOBS SETUP (Optional but Recommended)

### Daily Quest Reset (Midnight UTC)

**Option A: Supabase pg_cron**

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'reset-daily-quests',
  '0 0 * * *',  -- Midnight UTC
  $$SELECT reset_daily_quests()$$
);
```

**Option B: Railway Cron**
Create `scripts/reset-quests.js`:

```javascript
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  const { data, error } = await supabase.rpc("reset_daily_quests");
  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }
  console.log("Success:", data);
}

main();
```

Then add to `package.json`:

```json
{
  "scripts": {
    "reset-quests": "node scripts/reset-quests.js"
  }
}
```

And configure Railway cron:

```bash
railway cron:add "0 0 * * *" "npm run reset-quests"
```

### Monthly League Update (1st of each month)

**Supabase pg_cron:**

```sql
SELECT cron.schedule(
  'update-monthly-leagues',
  '0 0 1 * *',  -- 1st of month
  $$SELECT update_user_leagues()$$
);
```

### Event Cleanup (Weekly)

**Supabase pg_cron:**

```sql
SELECT cron.schedule(
  'cleanup-gamification-events',
  '0 0 * * 0',  -- Sunday midnight
  $$SELECT cleanup_gamification_events()$$
);
```

---

## 📊 MONITORING & ANALYTICS

### Key Metrics to Track

**Engagement:**

- Daily Active Users (DAU)
- Quest completion rate
- Average session duration
- Social actions per user per day

**Economy:**

- Total PP in circulation
- PP inflation rate
- Average XP earned per user
- Level distribution

**Retention:**

- 7-day retention rate
- 30-day retention rate
- Streak maintenance rate

### SQL Queries for Monitoring

**Daily Quest Completion Rate:**

```sql
SELECT
  date,
  COUNT(*) FILTER (WHERE completed) * 100 / COUNT(*) AS completion_rate
FROM user_daily_quests
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date
ORDER BY date DESC;
```

**Level Distribution:**

```sql
SELECT
  level,
  COUNT(*) as user_count
FROM profiles
GROUP BY level
ORDER BY level;
```

**PP Inflation (Weekly):**

```sql
SELECT
  DATE_TRUNC('week', created_at) as week,
  SUM(cost) as pp_spent,
  COUNT(*) as transactions
FROM marketplace_transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY week
ORDER BY week DESC;
```

---

## 🐛 TROUBLESHOOTING

### Issue: Quests not appearing

**Solution:**

```sql
-- Manually trigger quest reset for testing
SELECT reset_daily_quests();

-- Check if quests exist for user
SELECT * FROM user_daily_quests
WHERE user_id = 'YOUR_USER_ID'
AND date = CURRENT_DATE;
```

### Issue: Level not updating

**Solution:**

```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trg_update_user_level';

-- Manually update level if trigger broken
UPDATE profiles
SET level = FLOOR(total_xp / 1000) + 1
WHERE id = 'YOUR_USER_ID';
```

### Issue: Notifications not showing

**Solution:**

1. Check browser console for errors
2. Verify Supabase realtime subscription
3. Check `gamification_events` table for events
4. Verify JWT token is valid

### Issue: Leaderboard empty

**Solution:**

```sql
-- Check if profiles have level data
SELECT id, name, level, league, praxis_points
FROM profiles
ORDER BY praxis_points DESC
LIMIT 10;

-- If empty, run league update
SELECT update_user_leagues();
```

---

## 📈 POST-DEPLOYMENT OPTIMIZATION

### Week 1: Monitor & Adjust

- Watch for exploits (PP farming, etc.)
- Adjust quest difficulty if needed
- Monitor server performance

### Week 2: User Feedback

- Collect user feedback on Discord/feedback form
- Identify pain points
- Prioritize bug fixes

### Week 3-4: Phase 3 Planning

- Review analytics
- Plan Squad system
- Design Battle Pass

---

## 🎉 SUCCESS CRITERIA

**Phase 1 & 2 are successful when:**

- [ ] Migrations run without errors
- [ ] Backend deploys successfully
- [ ] Frontend deploys successfully
- [ ] Users can see level badges
- [ ] Daily quests appear and work
- [ ] XP/PP awards correctly
- [ ] Achievements unlock automatically
- [ ] Notifications appear in real-time
- [ ] Leaderboard filters work
- [ ] No critical bugs in first 48 hours

---

## 📞 SUPPORT

**If you encounter issues:**

1. Check this guide's troubleshooting section
2. Review migration SQL for errors
3. Check Supabase logs for database errors
4. Check Railway logs for backend errors
5. Check Vercel logs for frontend errors
6. Review `GAMIFICATION_PHASE1_COMPLETE.md` for architecture details

---

**🚀 Ready to deploy! Good luck!**

_Generated: March 28, 2026_
_Version: 2.0 (Phase 1 + Phase 2)_
