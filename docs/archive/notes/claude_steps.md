# Praxis Development Session - Complete Progress Log

**Date:** March 15, 2026
**Developer:** AI Assistant
**Repository:** praxis_webapp + praxis-backend

---

## 📋 Session Overview

This session focused on:

1. Fixing Service Worker registration errors
2. Restoring Axiom's LLM-powered daily messages
3. Creating Smart Notebook with automatic content aggregation
4. Adding comprehensive database migrations
5. Fixing rate limiting issues with Gemini API
6. Adding admin panel controls for Axiom brief generation
7. Fixing various bugs (achievements endpoint, UUID validation, etc.)

---

## 🔧 Issues Fixed

### 1. Service Worker Registration Failed ✅

**Error:** `TypeError: ServiceWorker script ... threw an exception`

**Cause:** TypeScript syntax in plain `.js` file

**Fix:**

- Converted service-worker.js to ES5 syntax (regular functions)
- Added eslint-disable for no-restricted-globals
- Added HTTPS check in registration
- Changed error logging to warning (non-critical feature)

**Files:**

- `client/public/service-worker.js`
- `client/src/utils/serviceWorker.ts`

**Commit:** `8a8ba9f`, `b7fd18b`

---

### 2. Invalid UUID Error ✅

**Error:** `invalid input syntax for type uuid: "e7umodc"`

**Cause:** GoalNotesPanel fetching notes with invalid node ID

**Fix:**

- Added UUID regex validation before fetching notes
- Gracefully handles invalid node IDs

**Files:**

- `client/src/features/notes/GoalNotesPanel.tsx`

**Commit:** `0376647`

---

### 3. Axiom Messages Using Algorithm Instead of LLM ✅

**Problem:** All Axiom messages were template-based, not Gemini-powered

**Root Cause Analysis:**

```
[AxiomScan] LLM FAILED for gio: Axiom Offline. Tried 11 keys. Status:
[K10:AIzaSy|gemini-2.0-flash-lite] 429 |
[K0:AIzaSy|gemini-2.0-flash-lite] 429 |
...all keys returning 429 (Rate Limited)
```

**Solution:**

1. Changed model priority to use higher rate limit models first:
   - `gemini-2.5-flash` (newest, highest limits)
   - `gemini-2.0-flash` (standard, good limits)
   - `gemini-2.5-pro` (pro tier)
   - `gemini-1.5-flash` (older)
   - `gemini-1.5-flash-8b` (cheap)
   - `gemini-2.0-flash-lite` (last resort - lowest limits)

2. Added 150ms delay between API calls to avoid hammering API

3. Added comprehensive logging to track LLM success/failure:
   - Log when LLM generation starts
   - Log response length
   - Log success with message preview
   - Log full stack trace on errors
   - Store `source` ('llm' or 'algorithm') in brief
   - Store `llm_error` message for debugging

**Files:**

- `src/services/AICoachingService.ts`
- `src/services/AxiomScanService.ts`

**Commits:** `5fdaf5f`, `eda06fa`, `043e1db`

---

### 4. Axiom Midnight Scan Always Generates Fresh Briefs ✅

**Before:** Free users limited to 1 brief per 7 days

**After:** ALL active users (last 30 days) get fresh brief daily

**Changes:**

- Removed frequency limits
- Always uses LLM for all users
- Increased concurrency to 5 for better throughput
- Better logging with success/fail counts

**Files:**

- `src/services/AxiomScanService.ts`

**Commit:** `f1fa0fc`

---

### 5. Smart Notebook - Automatic Content Aggregation ✅

**Feature:** Unified notebook that automatically aggregates ALL user activity

**Database Schema:**

- `notebook_entries` table (unified feed for all content)
- `notebook_tags` table (user-defined tags)
- Automatic triggers for posts, trackers, checkins, journals
- Helper functions: `get_notebook_entries()`, `get_notebook_stats()`
- Polymorphic references (source_table, source_id)
- Full-text search support
- GIN indexes for tags and content

**Content Types Supported:**

- note (manual journal entries)
- tracker (fitness, finance, etc.)
- goal_progress (goal updates)
- post (public posts)
- event (events attended)
- message (important conversations)
- checkin (daily check-ins)
- achievement (unlocked achievements)
- bet (challenges placed/completed)
- match (new connections)
- verification (goal verifications)
- comment (comments)

**Backend API:**

- `GET /api/notebook/entries` (with filters: type, domain, tag, search)
- `GET /api/notebook/stats` (usage statistics)
- `POST /api/notebook/entries` (create new entry)
- `PATCH /api/notebook/entries/:id` (update entry)
- `PATCH /api/notebook/entries/:id/pin` (pin/unpin)
- `DELETE /api/notebook/entries/:id` (delete entry)
- `GET/POST/DELETE /api/notebook/tags` (tag management)

**Frontend UI:**

- Timeline view grouped by date
- Filters: type, domain, tag, search
- Stats cards (total entries, streak, tags)
- Entry type icons and colors
- Pin/unpin entries
- Edit/delete entries
- Tag display with #hashtag format
- Responsive design

**Files:**

- `migrations/migrations.notebook.sql`
- `src/routes/notebookRoutes.ts`
- `client/src/features/notebook/NotebookPage.tsx`

**Commit:** `4019cca`

---

### 6. Comprehensive Database Migrations ✅

**File:** `migrations/migrations.final.sql`

**Features:**

- IDEMPOTENT (safe to run multiple times)
- Won't delete data
- All tables use `CREATE TABLE IF NOT EXISTS`
- All policies use `DROP POLICY IF EXISTS` before `CREATE`
- All indexes use `CREATE INDEX IF NOT EXISTS`
- Adds missing columns to existing tables with `DO $$` blocks

**Tables Included:**

- profiles (with emoji support)
- goal_trees (JSONB storage)
- node_journal_entries (UTF-8 emoji support)
- journal_entries (legacy fallback)
- trackers + tracker_entries (JSONB data)
- axiom_daily_briefs (with GIN index on brief)
- checkins (streak tracking)
- posts (UTF-8 emoji support, soft delete)
- goal_notes (retroactive goal editing)
- notebook_entries (unified feed)
- notebook_tags (tag system)
- system_config (key-value store)

**Helper Functions:**

- `get_top_axiom_users()` for admin stats
- `get_notebook_entries()` for filtered queries
- `get_notebook_stats()` for usage statistics
- `create_notebook_entry()` trigger function

**Commit:** `d0f575f`

---

### 7. Admin Panel - Generate All Briefs Button ✅

**Feature:** Allow admins to immediately push fresh LLM-powered Axiom briefs

**New Endpoint:** `POST /admin/axiom/generate-all-briefs`

- Synchronously generates LLM briefs for ALL active users
- Waits for completion and returns detailed results
- Shows LLM vs Algorithm breakdown
- Processes in batches of 3 to avoid rate limiting

**Response:**

```json
{
  "message": "Generated 27 briefs in 45.23s",
  "total_users": 30,
  "generated": 27,
  "failed": 3,
  "llm_briefs": 25,
  "algorithm_briefs": 2,
  "duration_seconds": "45.23"
}
```

**UI Components:**

- New "Generate All Briefs Now" button
- Results display with colored chips:
  - Total users (gray)
  - Generated count (green ✓)
  - LLM briefs count (purple 💜)
  - Algorithm briefs count (gray)
  - Failed count (red ❌)
  - Duration in seconds (gray)

**Files:**

- `src/controllers/adminController.ts`
- `src/routes/adminRoutes.ts`
- `client/src/features/admin/AdminPage.tsx`

**Commit:** `e9b28cd`

---

### 8. Achievements Endpoint 500 Error ✅

**Error:** `GET /api/achievements?userId=xxx` returning 500

**Cause:** Query selecting specific columns that don't exist in schema

**Fix:** Changed `select('id, user_id, ...')` to `select('*')`

**Files:**

- `src/controllers/achievementController.ts`

**Commit:** `163ee0b`

---

## 📊 Statistics

**Total Commits:** 15+
**Files Created:** 10+
**Files Modified:** 25+
**Lines Added:** ~2000+
**Database Tables:** 12+
**API Endpoints:** 20+

---

## 🎯 Key Features Delivered

### Axiom AI System

- ✅ LLM-powered daily messages for ALL users
- ✅ Full protocol: message, routine, challenge, resources, match, event, place
- ✅ Midnight automated scan (cron at 0 0 \* \* \*)
- ✅ Manual trigger from admin panel
- ✅ Generate All Briefs button (synchronous)
- ✅ Rate limit handling with model fallback
- ✅ Comprehensive logging and debugging

### Smart Notebook

- ✅ Automatic content aggregation from all sources
- ✅ Unified timeline view
- ✅ Tagging system
- ✅ Search and filters
- ✅ Stats and analytics
- ✅ Pin important entries
- ✅ Edit/delete functionality

### Database

- ✅ Comprehensive idempotent migrations
- ✅ UTF-8/emoji support everywhere
- ✅ RLS policies on all tables
- ✅ Proper indexes for performance
- ✅ Helper functions for common queries

### Admin Panel

- ✅ Axiom usage statistics
- ✅ Top users by brief count
- ✅ Recent brief generation activity
- ✅ Manual scan trigger
- ✅ Generate all briefs button
- ✅ Real-time results display

### Mobile UI

- ✅ Larger fonts and touch targets
- ✅ Proper scrolling (no zoom issues)
- ✅ Goal notes panel visible
- ✅ Emoji picker for quick notes
- ✅ Edit functionality for diary entries

---

## 🐛 Bugs Fixed

1. Service Worker registration failed (TypeScript in .js file)
2. Invalid UUID errors in GoalNotesPanel
3. Axiom using algorithm instead of LLM (rate limiting)
4. Achievements endpoint 500 (column mismatch)
5. Progress bar server errors (missing columns)
6. Emoji support in notes (UTF-8 columns)
7. Missing columns in existing tables

---

## 📝 Migration Instructions

**Run on Supabase SQL Editor:**

```sql
-- 1. Run comprehensive migrations
-- Copy contents of: migrations/migrations.final.sql

-- 2. This will create/update:
-- - All core tables (profiles, goal_trees, etc.)
-- - Notebook system (notebook_entries, notebook_tags)
-- - Axiom system (axiom_daily_briefs)
-- - Helper functions
-- - RLS policies
-- - Indexes

-- 3. Safe to run multiple times (idempotent)
```

---

## 🚀 Deployment Status

**Backend (Railway):** ✅ Deployed
**Frontend (Vercel):** ✅ Deployed
**Wait Time:** 2-3 minutes for full deployment

---

## 🔍 Monitoring & Debugging

### Axiom LLM Success Detection

Check server logs for:

```
[AxiomScan] Starting LLM generation for User (streak: 5, archetype: achiever)
[AxiomScan] LLM response received for User (1234 chars)
[AxiomScan] LLM SUCCESS for User - message: Good morning User. I see...
[AxiomScan] Generated LLM protocol for User (archetype: achiever)
```

### Axiom LLM Failure Detection

```
[AxiomScan] LLM FAILED for User: Axiom Offline. Tried 11 keys. Status: ... 429
[AxiomScan] Stack trace: Error: ...
[AxiomScan] Using ALGORITHM fallback for User
```

### Database Debugging

Check `axiom_daily_briefs.brief` JSON:

```json
{
  "message": "...",
  "source": "llm", // or "algorithm"
  "llm_error": null // or error message if failed
}
```

---

## 🎨 UI/UX Improvements

### Notes Page

- Mobile: Larger fonts (1.1rem base)
- Mobile: Larger touch targets (48px buttons, 40px chips)
- Mobile: Goal notes panel always visible below widget
- Emoji picker (12 quick-insert emojis)
- Mood selection (😊 Good, 😐 Okay, etc.)
- Edit dialog for diary entries
- Retroactive editing (updates everywhere)

### Admin Panel

- Axiom stats dashboard
- Top users table with rankings
- Recent activity feed
- Manual scan trigger
- Generate all briefs button
- Real-time results display

### Coaching Page

- Last Axiom message display at top
- Beautiful card with avatar
- Updates when daily brief refreshed

---

## 📚 Files Reference

### Backend

```
src/
├── app.ts (route registration)
├── services/
│   ├── AICoachingService.ts (LLM integration)
│   ├── AxiomScanService.ts (midnight scan)
│   └── EngagementMetricService.ts (user metrics)
├── routes/
│   ├── adminRoutes.ts
│   ├── adminAxiomRoutes.ts
│   ├── notebookRoutes.ts
│   ├── axiomRoutes.ts
│   └── achievementRoutes.ts
├── controllers/
│   ├── adminController.ts
│   └── achievementController.ts
└── migrations/
    ├── add_axiom_stats_function.sql
    └── add_journal_entries_table.sql
```

### Frontend

```
client/src/
├── features/
│   ├── admin/AdminPage.tsx
│   ├── coaching/AICoachPage.tsx
│   ├── notebook/NotebookPage.tsx
│   ├── notes/
│   │   ├── NotesPage.tsx
│   │   ├── NoteGoalDetail.tsx
│   │   ├── GoalNotesPanel.tsx
│   │   ├── DiaryFeed.tsx
│   │   └── NoteEditDialog.tsx
│   └── dashboard/
│       ├── DesktopWidget.tsx
│       ├── AxiomDailyProtocol.tsx
│       └── AxiomMorningBrief.tsx
├── utils/
│   └── serviceWorker.ts
└── public/
    └── service-worker.js
```

### Migrations

```
migrations/
├── migrations.final.sql (comprehensive)
└── migrations.notebook.sql (notebook system)
```

---

## 🎯 Next Steps (Future Work)

1. **Health Connect Integration** (Android)
2. **Push Notifications**
3. **Premium Subscription Features**
4. **Advanced Analytics Dashboard**
5. **Group Challenges**
6. **AI-Powered Goal Recommendations**

---

## 📞 Support & Troubleshooting

### If Axiom Still Shows Algorithm Messages:

1. Check Railway logs for LLM errors
2. Verify Gemini API keys are valid
3. Check if keys have billing enabled
4. Monitor rate limit errors (429)
5. Consider getting more API keys

### If Notebook Not Aggregating:

1. Run migrations on Supabase
2. Check triggers are created
3. Verify RLS policies allow inserts
4. Check notebook_entries table exists

### If Admin Panel Stats Empty:

1. Run `get_top_axiom_users()` function migration
2. Verify axiom_daily_briefs has data
3. Check RLS policies for admin access

---

**Session Complete!** ✅
All features implemented, tested, and deployed.
