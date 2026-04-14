# ✅ Offline & Calendar Enhancements - COMPLETE

## Summary

All phases have been successfully implemented! The Praxis webapp now supports:

1. **Offline tracker logging** with auto-sync
2. **Combined calendar view** showing trackers + notes + goal updates
3. **Filter toggles** to customize calendar display
4. **Service Worker** for full offline PWA support
5. **Database migrations** for journal and goal history tracking

---

## 📁 Files Modified/Created

### Frontend Changes

#### 1. **IndexedDB Extension** (`client/src/lib/db.ts`)

- ✅ Added `LocalTrackerEntry` interface
- ✅ Upgraded database to version 2
- ✅ Added `trackerEntries` table with sync status

#### 2. **Offline Sync Hook** (`client/src/hooks/useOfflineSync.ts`)

- ✅ Added `syncTrackerEntries()` function
- ✅ Syncs both journal and tracker entries
- ✅ Shows toast notifications on successful sync
- ✅ Handles auth errors gracefully

#### 3. **Tracker Widget** (`client/src/features/trackers/TrackerWidget.tsx`)

- ✅ Added offline-first logging
- ✅ Tries online first, falls back to IndexedDB
- ✅ Shows "Saved offline 📡" message
- ✅ Includes offline entries in today's count
- ✅ Imports `db` and `axios` for offline support

#### 4. **Analytics Page** (`client/src/features/analytics/AnalyticsPage.tsx`)

- ✅ Updated `DayData` interface with `notes`, `goalUpdates`, `activities`
- ✅ Added filter state (`trackers`, `notes`, `goals`)
- ✅ Fetches from new `/api/trackers/calendar` endpoint
- ✅ Added filter toggle chips UI
- ✅ Enhanced tooltips with activity breakdown
- ✅ Applies filters to calendar data

#### 5. **Service Worker** (`client/public/service-worker.js`)

- ✅ Network-first caching strategy
- ✅ Caches static assets on install
- ✅ Cleans up old caches on activate
- ✅ Falls back to cache when offline
- ✅ Handles navigation requests

#### 6. **Service Worker Utils** (`client/src/utils/serviceWorker.ts`)

- ✅ `registerServiceWorker()` - Registers SW
- ✅ `unregisterServiceWorker()` - For debugging
- ✅ `isOffline()` - Check connection status
- ✅ `onOnlineStatusChange()` - Listen for changes

#### 7. **Main App** (`client/src/index.tsx`)

- ✅ Imports and calls `registerServiceWorker()`
- ✅ Enables offline PWA support

### Backend Changes

#### 1. **Tracker Controller** (`src/controllers/trackerController.ts`)

- ✅ Added `getCalendarData()` function
- ✅ Fetches trackers + notes + goal updates
- ✅ Builds combined day-by-day map
- ✅ Returns structured calendar data with summary

#### 2. **Tracker Routes** (`src/routes/trackerRoutes.ts`)

- ✅ Added `GET /calendar` endpoint
- ✅ Protected with `authenticateToken` middleware

#### 3. **Database Migration** (`migrations/add_journal_and_goal_history.sql`)

- ✅ Creates `journal_entries` table
- ✅ Creates `goal_progress_history` table
- ✅ Adds indexes for performance
- ✅ Creates trigger for auto-logging goal changes
- ✅ Sets up RLS policies
- ✅ Grants permissions

---

## 🎯 Features Implemented

### 1. Offline Tracker Logging

**How it works:**

```
User logs tracker → Try API call → Network error? → Save to IndexedDB → Show "Saved offline 📡"
                                                                 ↓
When online: IndexedDB entry → Auto-sync → API success → Mark as synced → Toast notification
```

**User Experience:**

- No disruption when network drops
- Clear feedback ("Saved offline")
- Automatic sync when connection restored
- Entries preserve original timestamp

### 2. Combined Calendar View

**Before:**

```typescript
interface DayData {
  date: string;
  count: number;
  trackers: string[];
}
```

**After:**

```typescript
interface DayData {
  date: string;
  count: number; // Total activities
  trackers: string[]; // Tracker types logged
  notes?: number; // Journal entries count
  goalUpdates?: number; // Goal progress updates
  activities?: Array<{
    // Detailed activity list
    type: "tracker" | "note" | "goal";
    description: string;
    timestamp: string;
  }>;
}
```

### 3. Filter Toggles

**UI:**

```
┌────────────────────────────────────────────────┐
│ [📊 Trackers] [📓 Notes] [🎯 Goals]           │
└────────────────────────────────────────────────┘
```

**Behavior:**

- Click to toggle on/off
- Updates calendar in real-time
- Filters both display count and tooltips
- Persists during session

### 4. Enhanced Tooltips

**Before:**

```
3 logs · Jan 15
```

**After:**

```
📊 2 trackers · 📓 1 note · 🎯 1 goal update · Jan 15
```

### 5. Service Worker Caching

**Strategy:** Network First, Fallback to Cache

```
Request → Try Network → Success? → Cache response → Return
                         ↓
                    Failed? → Try Cache → Found? → Return cached
                                           ↓
                                      Not found? → Return offline page (navigation)
                                                ↓
                                           Return 503 error
```

---

## 🗄️ Database Schema

### New Tables

#### `journal_entries`

```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  node_id UUID,
  note TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `goal_progress_history`

```sql
CREATE TABLE goal_progress_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  node_id UUID NOT NULL,
  node_name TEXT,
  domain TEXT,
  old_progress INTEGER,
  new_progress INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Trigger

Auto-logs goal progress changes:

```sql
CREATE TRIGGER on_goal_progress_change
  AFTER UPDATE ON goal_trees
  FOR EACH ROW
  EXECUTE FUNCTION log_goal_progress_change();
```

---

## 📊 API Endpoints

### New Endpoint

**`GET /api/trackers/calendar?days=112`**

**Request:**

```http
GET /api/trackers/calendar?days=112
Authorization: Bearer <token>
```

**Response:**

```json
{
  "days": 112,
  "calendar": [
    {
      "date": "2026-03-15",
      "count": 5,
      "trackers": ["lift", "meal"],
      "notes": 2,
      "goalUpdates": 1,
      "activities": [
        {
          "type": "tracker",
          "description": "lift entry",
          "timestamp": "2026-03-15T10:30:00Z"
        },
        {
          "type": "note",
          "description": "Journal: Good",
          "timestamp": "2026-03-15T14:00:00Z"
        },
        {
          "type": "goal",
          "description": "Career: 65%",
          "timestamp": "2026-03-15T18:00:00Z"
        }
      ]
    }
  ],
  "summary": {
    "totalActiveDays": 45,
    "totalTrackerLogs": 120,
    "totalNotes": 35,
    "totalGoalUpdates": 8
  }
}
```

---

## 🧪 Testing Checklist

### Offline Tracker Logging

- [ ] Log tracker while online → Should save immediately
- [ ] Log tracker while offline → Should save to IndexedDB with "pending" status
- [ ] Go offline, log 3 trackers → Go online → Should auto-sync all 3
- [ ] Check toast notifications appear
- [ ] Verify today's count includes offline entries

### Calendar View

- [ ] Open Analytics page → Should show combined data
- [ ] Toggle "Notes" off → Calendar should update
- [ ] Toggle "Goals" off → Calendar should update
- [ ] Toggle all off → Should show empty calendar
- [ ] Hover over day with mixed activity → Tooltip should show breakdown

### Service Worker

- [ ] Load app → Check console for "SW registered"
- [ ] Disconnect network → Reload app → Should load from cache
- [ ] Modify service-worker.js → Reload → Should prompt for update
- [ ] Check Application tab → Service Worker should be active

### Database

- [ ] Run migration SQL in Supabase
- [ ] Create journal entry → Check table
- [ ] Update goal progress → Check goal_progress_history
- [ ] Verify RLS policies work (can only see own data)

---

## 🚀 Deployment Steps

### 1. Run Database Migration

```sql
-- Copy contents of migrations/add_journal_and_goal_history.sql
-- Paste into Supabase SQL Editor
-- Run
```

### 2. Deploy Backend

```bash
cd /home/gio/Praxis/praxis_webapp
# Verify new endpoint works
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/trackers/calendar?days=7
```

### 3. Deploy Frontend

```bash
cd /home/gio/Praxis/praxis_webapp/client
npm run build
# Deploy dist/ to hosting
```

### 4. Test Offline Mode

1. Open app in browser
2. Open DevTools → Application → Service Workers
3. Check "Offline"
4. Try logging a tracker
5. Uncheck "Offline"
6. Wait for auto-sync toast

---

## 📈 Metrics to Track

After deployment, monitor:

1. **Offline Usage**
   - Number of offline tracker entries
   - Sync success rate
   - Average sync delay

2. **Calendar Engagement**
   - Filter toggle usage
   - Time spent on Analytics page
   - Return visits to calendar

3. **Service Worker**
   - Cache hit rate
   - Offline session duration
   - Update adoption rate

---

## 🔧 Troubleshooting

### Issue: Trackers not syncing offline

**Check:**

```javascript
// In browser console
const db = await caches.open("praxis-cache-v1");
const keys = await db.keys();
console.log(keys);
```

### Issue: Calendar shows no data

**Check:**

1. Backend logs for `/api/trackers/calendar` errors
2. Browser console for API errors
3. Supabase RLS policies allow read access

### Issue: Service Worker not registering

**Check:**

1. `/service-worker.js` exists and is served
2. No CORS errors in console
3. Browser supports service workers

---

## 🎉 Next Steps

### Phase 4: Advanced Features (Future)

1. **Push Notifications**
   - Remind to log trackers
   - Goal deadline reminders
   - Streak warnings

2. **Background Sync API**
   - More reliable offline sync
   - Retry failed syncs automatically

3. **IndexedDB Query UI**
   - View pending offline entries
   - Manual sync trigger
   - Export offline data

4. **Advanced Calendar Features**
   - Click day to view details
   - Week/month view toggle
   - Export calendar data
   - Share progress with accountability partner

---

## 📝 Commit Messages

```
feat: Add offline support for tracker logging

- Extend IndexedDB with trackerEntries table
- Update useOfflineSync hook to sync trackers
- Modify TrackerWidget to save offline when network fails
- Show "Saved offline 📡" toast for offline entries
- Include offline entries in today's count

feat: Add combined calendar endpoint

- New GET /api/trackers/calendar endpoint
- Fetches trackers + notes + goal updates
- Returns structured day-by-day data
- Includes summary statistics

feat: Enhance calendar with filters

- Add filter toggles for Trackers/Notes/Goals
- Update DayData interface with new fields
- Enhance tooltips with activity breakdown
- Apply filters in real-time

feat: Add service worker for offline PWA

- Network-first caching strategy
- Cache static assets on install
- Clean up old caches on activate
- Fallback to cache when offline

feat: Add database migrations

- Create journal_entries table
- Create goal_progress_history table
- Add trigger for auto-logging goal changes
- Set up RLS policies and permissions
```

---

**Implementation Complete!** ✅

All features are ready for testing and deployment.
