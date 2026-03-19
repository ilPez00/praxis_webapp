# 🚀 Deployment Guide - Maslow Domain System

**Date:** March 18, 2026  
**Version:** 1.0.0  
**Status:** Ready for Production

---

## Pre-Deployment Checklist

- [ ] Backup database (Supabase → Backups → Create backup)
- [ ] Test migration on staging environment (if available)
- [ ] Notify users of upcoming maintenance (if needed)
- [ ] Have rollback plan ready

---

## Option 1: Deploy via Supabase Dashboard (Recommended)

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com
2. Select your Praxis project
3. Navigate to **SQL Editor** (left sidebar)

### Step 2: Run Migration

1. Open `migrations/2026-03-18-domain-rework-maslow.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click **Run** (or Ctrl+Enter / Cmd+Enter)

### Step 3: Verify Success

You should see:
```
✅ Migration completed successfully!
```

If there are errors, they will be shown in the results panel.

### Step 4: Verify Data

Run these verification queries:

```sql
-- Check domain distribution
SELECT domain, COUNT(*) as count 
FROM goal_trees 
GROUP BY domain 
ORDER BY domain;

-- Test Maslow level function
SELECT get_maslow_level('Gaming & Esports'); -- Should return 4
SELECT get_maslow_level('Body & Fitness'); -- Should return 1

-- Check user domain balance
SELECT * FROM user_domain_balance LIMIT 10;
```

---

## Option 2: Deploy via CLI (Advanced)

### Prerequisites

```bash
# Install PostgreSQL client if not already installed
# Ubuntu/Debian:
sudo apt-get install postgresql-client

# Fedora:
sudo dnf install postgresql

# Arch:
sudo pacman -S postgresql-libs
```

### Step 1: Get Database URL

1. Go to Supabase Dashboard
2. Settings → Database
3. Copy **Connection string** (URI mode)
4. Format: `postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres`

### Step 2: Create .env File

```bash
cp .env.example .env
# Edit .env and add:
DATABASE_URL="your_supabase_connection_string"
```

### Step 3: Run Deployment Script

```bash
chmod +x deploy_domains.sh
./deploy_domains.sh
```

---

## Post-Deployment Steps

### 1. Restart Application

```bash
# If using PM2
pm2 restart praxis

# If using Railway/Railway
# Redeploy from GitHub

# If running manually
npm restart
```

### 2. Clear Frontend Cache

Instruct users to:
- Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- Or clear cache completely

### 3. Test Critical Flows

#### Goal Creation
- [ ] Create new goal → verify all 14 domains appear
- [ ] Select "Gaming & Esports" → save → verify stored correctly
- [ ] Edit goal → change domain → verify update works

#### Tracker Auto-Assignment
- [ ] Create "Gaming & Esports" goal → verify gaming trackers enabled
- [ ] Create "Body & Fitness" goal → verify lift/cardio enabled
- [ ] Log gaming session → verify notebook entry created

#### Filters
- [ ] Matches page → filter by domain → verify all 14 domains shown
- [ ] Places page → filter by domain → verify working
- [ ] Events page → filter by domain → verify working

#### Analytics
- [ ] View goal tree → verify domain colors correct
- [ ] Check domain icons → verify emoji display correctly

---

## Rollback Plan

If issues occur, run this rollback SQL:

```sql
-- Rollback: Restore old domain column
ALTER TABLE goal_trees RENAME COLUMN domain TO domain_new;
ALTER TABLE goal_trees RENAME COLUMN domain_old TO domain;

-- Drop new enum type
DROP TYPE IF EXISTS goal_domain_new CASCADE;

-- Restore old check constraint
ALTER TABLE goal_trees 
  ADD CONSTRAINT goal_trees_domain_check 
  CHECK (domain IN (
    'Career', 'Investing / Financial Growth', 'Fitness', 'Academics',
    'Mental Health', 'Philosophical Development', 
    'Culture / Hobbies / Creative Pursuits', 
    'Intimacy / Romantic Exploration', 
    'Friendship / Social Engagement', 'Personal Goals'
  ));
```

---

## Migration Mapping Reference

### Old → New Domain Mapping

| Old Domain | New Domain | Notes |
|------------|------------|-------|
| Fitness | Body & Fitness | Direct mapping |
| Body & Health | Body & Fitness | Split into Body + Health |
| Mental Health | Mental Balance | Renamed |
| Environment & Gear | Environment & Home | Renamed |
| Investing / Financial Growth | Financial Security | Level 2 focus |
| Money & Assets | Financial Security | Consolidated |
| Friendship / Social Engagement | Friendship & Social | Simplified |
| Intimacy / Romantic Exploration | Romance & Intimacy | Simplified |
| Career | Career & Craft | Expanded |
| Academics | Career & Craft | Merged |
| Philosophical Development | Spirit & Purpose | Renamed |
| Personal Goals | Impact & Legacy | Focused |
| Culture / Hobbies / Creative Pursuits | Gaming & Esports | Modern focus |

### New Domains (No Predecessor)

- 😴 Rest & Recovery (split from Health)
- 🛡️ Health & Longevity (split from Fitness)
- 💰 Financial Security (new categorization)
- 🏛️ Community & Contribution (elevated)
- 🎮 Gaming & Esports (modern addition)
- 🎯 Impact & Legacy (split from Personal)

---

## Troubleshooting

### Issue: "type goal_domain_new does not exist"

**Solution:** The enum type wasn't created. Re-run the first part of the migration:

```sql
DO $$ BEGIN
  CREATE TYPE goal_domain_new AS ENUM (
    'Body & Fitness', 'Rest & Recovery', 'Mental Balance',
    'Environment & Home', 'Health & Longevity', 'Financial Security',
    'Friendship & Social', 'Romance & Intimacy', 'Community & Contribution',
    'Career & Craft', 'Wealth & Assets', 'Gaming & Esports',
    'Impact & Legacy', 'Spirit & Purpose'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
```

### Issue: "column domain does not exist"

**Solution:** Check if column was renamed. Run:

```sql
\d goal_trees
```

Look for `domain`, `domain_old`, or `domain_new` columns.

### Issue: Frontend shows old domains

**Solution:** Clear browser cache and rebuild:

```bash
# Frontend
cd client
npm run build

# Or for dev mode
npm run dev
```

### Issue: Gaming trackers not showing

**Solution:** Verify tracker types were added:

```sql
SELECT * FROM tracker_domain_mapping WHERE domain = 'Gaming & Esports';
```

Should return 4 rows (gaming, achievements, rank, streaming).

---

## Success Metrics

After deployment, verify:

1. ✅ All 14 domains visible in dropdowns
2. ✅ Gaming trackers available (gaming, achievements, rank, streaming)
3. ✅ Domain colors match new scheme (purple for gaming)
4. ✅ Maslow level function works: `SELECT get_maslow_level('Gaming & Esports');`
5. ✅ User domain balance view returns data
6. ✅ No console errors in browser
7. ✅ Existing goals still accessible

---

## Communication Template

If notifying users:

```
🎉 Praxis Update: Enhanced Goal System!

We've upgraded our goal categorization based on Maslow's Hierarchy of Needs!

What's New:
✨ 14 focused domains (was 9)
🎮 NEW: Gaming & Esports domain for achievement hunters
😴 NEW: Rest & Recovery for work-life balance
🏛️ NEW: Community & Contribution for giving back

Your existing goals have been automatically migrated to the new system.

Try creating a new goal to see the improved categorization!

— The Praxis Team
```

---

## Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Review migration SQL for errors
3. Check Supabase logs (Dashboard → Logs)
4. Contact: [Your support contact]

---

*Last Updated: March 18, 2026*
