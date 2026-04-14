# Praxis Webapp - Offline Capabilities & Calendar Enhancement Plan

## Current Offline Status

### ✅ What Works Offline

#### 1. **IndexedDB Database (Dexie.js)**

- **Location:** `client/src/lib/db.ts`
- **Database Name:** `PraxisOfflineDB`
- **Tables:**
  - `journalEntries` - Local journal/note entries with sync status

**Schema:**

```typescript
interface LocalJournalEntry {
  id?: string;
  node_id: string;
  note: string;
  mood: string | null;
  logged_at: string;
  sync_status: "synced" | "pending" | "failed";
  error?: string;
}
```

#### 2. **Offline Sync Hook**

- **Location:** `client/src/hooks/useOfflineSync.ts`
- **Features:**
  - Periodic sync every 5 minutes
  - Syncs on network reconnection (`online` event)
  - Marks entries as 'synced'/'pending'/'failed'
  - Handles 401/403 errors gracefully

**How it works:**

```typescript
// 1. User writes note offline → saved to IndexedDB
await db.journalEntries.add({
  node_id: goalId,
  note: "Made progress today",
  mood: "Good",
  sync_status: "pending",
});

// 2. When online, sync hook posts to server
await api.post("/journal/entries", { nodeId, note, mood });

// 3. Updates sync status
await db.journalEntries.update(id, { sync_status: "synced" });
```

#### 3. **PWA Manifest**

- **Location:** `client/public/manifest.json`
- **Configuration:**
  - Display: `standalone`
  - Start URL: `/dashboard`
  - Theme: Praxis orange (#F59E0B)
  - Icons: 192x192, 512x512

#### 4. **Version Control & Cache Busting**

- **Location:** `client/src/utils/versionControl.ts`
- **Features:**
  - Forces cache clear on major updates
  - Unregisters service workers
  - Clears localStorage

### ❌ What Doesn't Work Offline

1. **Goal Tree Loading** - Requires network to fetch from Supabase
2. **Tracker Logging** - No offline storage for tracker entries
3. **Matches/Chat** - Real-time features need connection
4. **Dashboard Data** - Streak, points, etc. not cached
5. **Notes View** - Can't view existing notes offline
6. **Calendar View** - Requires network for historical data

---

## Existing Calendar Implementation

### Analytics Page - Habit Calendar

**Location:** `client/src/features/analytics/AnalyticsPage.tsx`

**Features:**

- **16-week contribution graph** (GitHub-style)
- Shows tracker log frequency per day
- Color intensity = number of logs (0-4+ entries)
- Goal deadline markers (flag emoji)
- Hover tooltips with details
- Legend for activity levels

**Data Source:**

```typescript
interface DayData {
  date: string;        // YYYY-MM-DD
  count: number;       // number of tracker logs that day
  trackers: string[];  // tracker types logged
}

// Fetches from backend
GET /api/trackers/my?days=112
```

**Visual Design:**

```
Less                                          More
[ ][ ][ ][ ][ ]  (opacity gradient)

🎯 Goal deadline
□ Today (bordered)
```

**Code Structure:**

```tsx
function HabitCalendar({ dayData, goalDates }) {
  // Builds 16-week grid
  // Columns = weeks (Sun→Sat)
  // Rows = days of week
  // Cell color = log count opacity
  // Border = goal deadlines
}
```

---

## Enhancement Plan: Calendar for Notes

### Feature Request

> "In notes I would like a calendar-style view in which frequency of notes/trackers or any step toward goal completion has been registered"

### Implementation Options

#### Option 1: Extend Existing Habit Calendar (Recommended)

**File:** `client/src/features/analytics/AnalyticsPage.tsx`

**Changes:**

1. Add **Notes/Journal entries** to calendar data
2. Add **Goal progress updates** to calendar
3. Add **filter toggles** (Trackers, Notes, Goals, All)

**Modified Data Structure:**

```typescript
interface DayData {
  date: string;
  count: number;
  trackers: string[];
  notes: number; // NEW: number of journal entries
  goalUpdates: number; // NEW: number of goal progress changes
  activities: Array<{
    // NEW: detailed activity list
    type: "tracker" | "note" | "goal";
    description: string;
    timestamp: string;
  }>;
}
```

**UI Enhancements:**

```tsx
// Add filter toggles above calendar
<Stack direction="row" spacing={1} sx={{ mb: 2 }}>
  <ToggleChip
    label="Trackers"
    icon="📊"
    active={filters.trackers}
    onChange={setFilters}
  />
  <ToggleChip
    label="Notes"
    icon="📓"
    active={filters.notes}
    onChange={setFilters}
  />
  <ToggleChip
    label="Goals"
    icon="🎯"
    active={filters.goals}
    onChange={setFilters}
  />
</Stack>

// Enhanced tooltip
<Tooltip title={
  <Box>
    {data.trackers.length > 0 && (
      <div>📊 {data.trackers.length} tracker logs</div>
    )}
    {data.notes > 0 && (
      <div>📓 {data.notes} notes</div>
    )}
    {data.goalUpdates > 0 && (
      <div>🎯 {data.goalUpdates} goal updates</div>
    )}
    <div>{date}</div>
  </Box>
}>
```

**Backend Changes:**

```typescript
// src/controllers/trackerController.ts

// Enhanced endpoint
GET /api/activity/calendar?days=112

// Returns combined data
{
  days: [
    {
      date: '2026-03-15',
      trackers: ['lift', 'meal'],
      notes: 2,
      goalUpdates: 1,
      activities: [
        { type: 'tracker', description: 'Logged lift workout', timestamp: '10:30' },
        { type: 'note', description: 'Journal entry', timestamp: '14:00' },
        { type: 'goal', description: 'Career goal: 50% → 65%', timestamp: '18:00' }
      ]
    }
  ]
}
```

#### Option 2: Standalone Notes Calendar Component

**New File:** `client/src/features/notes/NotesCalendar.tsx`

**Features:**

- Dedicated calendar view for notes only
- Click day to view/write notes
- Month/week/day views
- Integration with existing NotesPage

**Component Structure:**

```tsx
interface NotesCalendarProps {
  goalTree: GoalNode[];
  selectedNodeId?: string;
}

const NotesCalendar: React.FC<NotesCalendarProps> = ({
  goalTree,
  selectedNodeId,
}) => {
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [notes, setNotes] = useState<JournalEntry[]>([]);

  // Fetch notes for selected period
  useEffect(() => {
    const fetchNotes = async () => {
      const entries = await api.get("/journal/entries", {
        params: {
          startDate,
          endDate,
          nodeId: selectedNodeId,
        },
      });
      setNotes(entries);
    };
    fetchNotes();
  }, [selectedDate, selectedNodeId]);

  return (
    <Box>
      <CalendarHeader
        view={view}
        date={selectedDate}
        onViewChange={setView}
        onDateChange={setSelectedDate}
      />

      {view === "month" && (
        <MonthGrid notes={notes} onDayClick={setSelectedDate} />
      )}

      {view === "week" && (
        <WeekView notes={notes} onNoteClick={openNoteEditor} />
      )}

      {view === "day" && <DayView notes={notes} onAddNote={createNote} />}
    </Box>
  );
};
```

#### Option 3: Enhanced NotesPage with Calendar Tab

**File:** `client/src/features/notes/NotesPage.tsx`

**Add Tab Navigation:**

```tsx
<Tabs value={activeTab} onChange={handleTabChange}>
  <Tab label="Tree View" icon={<AccountTreeIcon />} />
  <Tab label="Calendar" icon={<CalendarTodayIcon />} />
  <Tab label="List" icon={<ViewListIcon />} />
</Tabs>;

{
  activeTab === "calendar" && (
    <NotesCalendar goalTree={treeData} selectedNodeId={selectedNode?.id} />
  );
}
```

---

## Recommended Implementation

### Phase 1: Offline Support for Trackers (Week 1)

**Extend IndexedDB:**

```typescript
// client/src/lib/db.ts

export interface LocalTrackerEntry {
  id?: string;
  tracker_id: string;
  tracker_type: string;
  data: Record<string, any>;
  logged_at: string;
  sync_status: "synced" | "pending" | "failed";
}

export class PraxisDatabase extends Dexie {
  journalEntries!: Table<LocalJournalEntry>;
  trackerEntries!: Table<LocalTrackerEntry>; // NEW

  constructor() {
    super("PraxisOfflineDB");
    this.version(2).stores({
      journalEntries: "++id, node_id, sync_status, logged_at",
      trackerEntries: "++id, tracker_id, sync_status, logged_at", // NEW
    });
  }
}
```

**Update Tracker Logging:**

```typescript
// client/src/features/trackers/TrackerWidget.tsx

const handleLogTracker = async (
  tracker: Tracker,
  data: Record<string, any>,
) => {
  try {
    // Try online first
    await api.post("/trackers/log", { type: tracker.type, data });
    toast.success("Logged!");
  } catch (err) {
    if (err.message === "Network Error") {
      // Save offline
      await db.trackerEntries.add({
        tracker_id: tracker.id,
        tracker_type: tracker.type,
        data: data,
        logged_at: new Date().toISOString(),
        sync_status: "pending",
      });
      toast.success("Saved offline (will sync when online)");
    } else {
      toast.error("Failed to log");
    }
  }
};
```

### Phase 2: Calendar Enhancement (Week 2)

**Extend Analytics Page:**

```typescript
// client/src/features/analytics/AnalyticsPage.tsx

// Enhanced data fetching
const fetchCalendarData = async () => {
  const [trackersRes, notesRes, goalsRes] = await Promise.allSettled([
    api.get("/trackers/my?days=112"),
    api.get("/journal/entries?days=112"),
    api.get("/goals/progress-history?days=112"),
  ]);

  // Merge into unified day data
  const dayMap: Record<string, DayData> = {};

  // Process trackers
  if (trackersRes.status === "fulfilled") {
    trackersRes.value.data.forEach((tracker) => {
      tracker.entries.forEach((entry) => {
        const date = entry.logged_at.slice(0, 10);
        if (!dayMap[date])
          dayMap[date] = {
            date,
            count: 0,
            trackers: [],
            notes: 0,
            goalUpdates: 0,
          };
        dayMap[date].count++;
        if (!dayMap[date].trackers.includes(tracker.type)) {
          dayMap[date].trackers.push(tracker.type);
        }
      });
    });
  }

  // Process notes
  if (notesRes.status === "fulfilled") {
    notesRes.value.data.forEach((entry) => {
      const date = entry.logged_at.slice(0, 10);
      if (!dayMap[date])
        dayMap[date] = {
          date,
          count: 0,
          trackers: [],
          notes: 0,
          goalUpdates: 0,
        };
      dayMap[date].notes++;
      dayMap[date].count++;
    });
  }

  // Process goal updates
  if (goalsRes.status === "fulfilled") {
    goalsRes.value.data.forEach((update) => {
      const date = update.timestamp.slice(0, 10);
      if (!dayMap[date])
        dayMap[date] = {
          date,
          count: 0,
          trackers: [],
          notes: 0,
          goalUpdates: 0,
        };
      dayMap[date].goalUpdates++;
      dayMap[date].count++;
    });
  }

  setCalendarDays(Object.values(dayMap));
};
```

**Add Filter Controls:**

```tsx
const [filters, setFilters] = useState({
  trackers: true,
  notes: true,
  goals: true
});

// In render
<Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
  <Chip
    label="📊 Trackers"
    color={filters.trackers ? 'primary' : 'default'}
    onClick={() => setFilters(f => ({ ...f, trackers: !f.trackers }))}
  />
  <Chip
    label="📓 Notes"
    color={filters.notes ? 'primary' : 'default'}
    onClick={() => setFilters(f => ({ ...f, notes: !f.notes }))}
  />
  <Chip
    label="🎯 Goals"
    color={filters.goals ? 'primary' : 'default'}
    onClick={() => setFilters(f => ({ ...f, goals: !f.goals }))}
  />
</Box>

// Pass filtered data to calendar
<HabitCalendar
  dayData={calendarDays.filter(d => {
    let count = 0;
    if (filters.trackers) count += d.trackers.length;
    if (filters.notes) count += d.notes;
    if (filters.goals) count += d.goalUpdates;
    return count > 0;
  })}
  goalDates={goalDates}
/>
```

### Phase 3: Full Offline Mode (Week 3-4)

**Service Worker Implementation:**

**New File:** `client/src/service-worker.ts`

```typescript
/// <reference lib="webworker" />

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "api-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  }),
);

// Cache static assets
registerRoute(
  ({ request, url }) =>
    request.destination === "image" ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js"),
  new CacheFirst({
    cacheName: "static-resources",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
);
```

**Register Service Worker:**

```typescript
// client/src/index.tsx

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.log("SW registration failed:", err));
  });
}
```

---

## Database Schema Changes

### Backend Migration

```sql
-- Add journal entries table (if not exists)
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  node_id UUID REFERENCES goal_trees(id),
  note TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for calendar queries
CREATE INDEX idx_journal_entries_date ON journal_entries(user_id, created_at);

-- Add goal progress history table
CREATE TABLE IF NOT EXISTS goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  node_id UUID NOT NULL,
  old_progress INTEGER,
  new_progress INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_goal_progress_history_date ON goal_progress_history(user_id, timestamp);
```

---

## Summary

### Current State

- ✅ Basic offline support for journal entries (IndexedDB)
- ✅ Auto-sync when online
- ✅ Habit calendar for trackers (16-week view)
- ❌ No offline support for trackers
- ❌ Calendar doesn't show notes or goal updates

### Recommended Next Steps

1. **Extend IndexedDB** to cache tracker entries offline
2. **Enhance Habit Calendar** to show notes + goal updates
3. **Add filter toggles** (Trackers/Notes/Goals)
4. **Implement Service Worker** for full offline mode
5. **Add backend endpoints** for combined calendar data

### Files to Modify

**Frontend:**

- `client/src/lib/db.ts` - Add tracker entries table
- `client/src/hooks/useOfflineSync.ts` - Sync trackers
- `client/src/features/analytics/AnalyticsPage.tsx` - Enhanced calendar
- `client/src/features/trackers/TrackerWidget.tsx` - Offline logging
- `client/src/service-worker.ts` - NEW (full offline support)

**Backend:**

- `src/controllers/trackerController.ts` - Enhanced calendar endpoint
- `src/routes/trackerRoutes.ts` - Add new routes
- `src/migrations/` - Add database migrations
