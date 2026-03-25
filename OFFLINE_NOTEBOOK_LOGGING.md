# Offline Notebook Logging

**Date:** March 25, 2026  
**Feature:** Offline-first notebook logging with automatic sync  
**Status:** ✅ Complete

---

## 📋 Overview

Praxis now supports **full offline logging** for notebook entries. When users install the PWA (Progressive Web App) on their device, they can:

- ✅ Create notebook entries offline
- ✅ Log tracker entries offline
- ✅ Add mood and location data offline
- ✅ View previously synced entries offline
- ✅ Automatic sync when connection restored
- ✅ Visual indicators for offline/pending state

---

## 🎯 How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User Creates Entry                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Check Online Status (useOffline)           │
└─────────────────────────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
    ┌───────────────┐           ┌───────────────┐
    │    ONLINE     │           │    OFFLINE    │
    │               │           │               │
    │ POST to API   │           │ Save to DB    │
    │               │           │ (IndexedDB)   │
    └───────────────┘           └───────────────┘
            │                           │
            │                           ▼
            │                  ┌───────────────┐
            │                  │ Show "Pending"│
            │                  │   Indicator   │
            │                  └───────────────┘
            │                           │
            │                           ▼
            │                  ┌───────────────┐
            │                  │  Wait for     │
            │                  │   "online"    │
            │                  └───────────────┘
            │                           │
            └─────────────┬─────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │ Sync Manager   │
                 │                │
                 │ POST to API    │
                 │ Mark as synced │
                 │ Clean up DB    │
                 └────────────────┘
```

---

## 🔧 Implementation Details

### 1. IndexedDB Storage (`client/src/lib/offlineDB.ts`)

**Purpose:** Store notebook entries locally when offline

**Database Schema:**

```typescript
interface OfflineEntry {
  id: string; // Unique ID (offline-{timestamp}-{random})
  entry_type: string; // 'note', 'goal_progress', etc.
  content: string; // Entry content
  mood?: string; // Mood emoji
  goal_id?: string; // Associated goal
  domain?: string; // Goal domain
  location_lat?: number; // GPS latitude
  location_lng?: number; // GPS longitude
  occurred_at: string; // When entry occurred
  created_at: string; // When created
  synced: boolean; // Sync status
  sync_attempted: number; // Number of sync attempts
}
```

**Key Methods:**

- `saveEntry(entry)` - Save entry to offline storage
- `getUnsyncedEntries()` - Get all entries waiting to sync
- `markAsSynced(id)` - Mark entry as synced
- `clearSynced()` - Remove synced entries (cleanup)

---

### 2. Sync Manager (`client/src/lib/offlineSyncManager.ts`)

**Purpose:** Manage offline sync queue and automatic synchronization

**Features:**

- Listens to browser `online`/`offline` events
- Automatically syncs when connection restored
- Retry logic (max 3 attempts per entry)
- Progress tracking and notifications
- React hook for component integration

**Sync Flow:**

```javascript
1. User comes online → 'online' event fires
2. Sync manager detects connection
3. Fetches all unsynced entries from IndexedDB
4. For each entry:
   a. Check if max attempts reached
   b. POST to /api/notebook/entries
   c. Mark as synced on success
   d. Increment attempt counter on failure
5. Show summary toast notification
6. Clean up synced entries from IndexedDB
```

---

### 3. useOffline Hook (`client/src/hooks/useOffline.ts`)

**Purpose:** React hook for offline status and sync utilities

**Usage:**

```typescript
import { useOffline } from '../../hooks/useOffline';

function MyComponent() {
  const {
    isOnline,
    isOffline,
    isSyncing,
    hasPendingSync,
    pendingCount,
    saveForLater,
    forceSync,
  } = useOffline();

  return (
    <div>
      {isOffline && <span>You're offline</span>}
      {hasPendingSync && <span>{pendingCount} pending sync</span>}
    </div>
  );
}
```

**Return Values:**

- `isOnline` (boolean) - Currently connected
- `isOffline` (boolean) - Currently disconnected
- `isSyncing` (boolean) - Currently syncing entries
- `hasPendingSync` (boolean) - Has entries waiting to sync
- `pendingCount` (number) - Number of pending entries
- `saveForLater(entry)` - Save entry for later sync
- `forceSync()` - Manually trigger sync

---

### 4. Service Worker (`client/public/service-worker.js`)

**Purpose:** Cache API responses and static assets for offline access

**Cached Routes:**

```javascript
const CACHEABLE_API_ROUTES = [
  "/api/notebook/entries",
  "/api/notebook/stats",
  "/api/notebook/tags",
  "/api/dashboard",
  "/api/checkins",
];
```

**Caching Strategy:**

- **Static assets:** Cache-first, network fallback
- **API GET requests:** Cache-first, network fallback, background refresh
- **API POST requests:** Network-only (not cacheable)
- **Offline responses:** Return 503 with offline message

---

### 5. Updated Components

#### GoalNotesPanel (`client/src/features/notes/GoalNotesPanel.tsx`)

**Offline Features:**

- Detects offline status
- Shows offline indicator chip
- Displays pending sync count
- Saves entries to IndexedDB when offline
- Shows offline alert banner
- Auto-syncs when connection restored

**UI Indicators:**

```
┌────────────────────────────────────────────────┐
│ 📓 Free Notes              [🔄 3 pending]     │
│ Standalone thoughts • Working offline          │
├────────────────────────────────────────────────┤
│ ⚠️ You're offline. Notes will sync when       │
│    you're back online.                         │
└────────────────────────────────────────────────┘
```

**Status Chips:**

- **Orange "3 pending"** - Entries waiting to sync (clickable to force sync)
- **Gray "Offline"** - No connection, no pending entries
- **Blue "Syncing..."** - Currently syncing entries

---

## 📱 User Experience

### Scenario 1: Logging Offline

1. **User opens app** (no internet)
   - Sees "Offline" chip in header
   - Sees offline alert banner

2. **User creates note**
   - Types content, selects mood
   - Clicks "Save to Notebook"
   - Sees toast: "📭 Saved offline - will sync when online"
   - Note appears in list immediately (from IndexedDB)
   - Header shows "1 pending" chip

3. **User creates more notes** (still offline)
   - Each note saved to IndexedDB
   - Counter increases: "2 pending", "3 pending"

4. **User regains connection**
   - Automatic sync starts
   - Header shows "Syncing..." chip
   - Toast: "📬 Synced 3 offline entries!"
   - Pending counter disappears

---

### Scenario 2: Intermittent Connection

1. **User on subway** (spotty connection)
   - Creates note → saves offline
   - Connection returns → auto-syncs
   - Connection lost → queues next note
   - Seamless experience throughout

---

### Scenario 3: Sync Failure

1. **User offline for extended period**
   - Creates 10 notes offline
   - Comes online
   - Sync starts automatically
   - 8 entries sync successfully
   - 2 entries fail (server error)
   - After 3 attempts, entries marked as failed
   - User notified: "Failed to sync 2 entries"

---

## 🎨 UI Components

### Offline Status Chip

```tsx
{
  hasPendingSync && (
    <Chip
      label={`${pendingCount} pending`}
      size="small"
      onClick={() => forceSync()}
      sx={{
        bgcolor: "rgba(245, 158, 11, 0.2)",
        color: "#F59E0B",
        fontWeight: 700,
      }}
      icon={<SyncIcon />}
    />
  );
}
```

### Offline Alert Banner

```tsx
{
  isOffline && (
    <Alert severity="warning" icon={<CloudOffIcon />}>
      You're offline. Notes will sync when you're back online.
    </Alert>
  );
}
```

---

## 🔒 Data Integrity

### Conflict Resolution

Currently, offline entries are treated as **source of truth**. If the same entry was modified online and offline:

1. Offline entry syncs to server
2. Server creates new entry with new ID
3. Both entries exist (no data loss)
4. User sees both in notebook

**Future Enhancement:** Add conflict detection and resolution UI.

---

### Retry Logic

- **Max attempts:** 3 per entry
- **Backoff:** None (immediate retry on reconnect)
- **After max attempts:** Entry marked as failed, user notified
- **Manual retry:** User can click pending chip to force sync

---

## 📊 Storage Limits

### IndexedDB Quotas

| Device/Platform | Typical Quota     |
| --------------- | ----------------- |
| Desktop Chrome  | 60% of disk space |
| Mobile Chrome   | 20% of disk space |
| Safari iOS      | ~1GB              |
| Firefox         | 50% of disk space |

**Estimated Entry Size:** ~1-2KB per entry

**Practical Limit:** Thousands of entries before hitting quota

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Create note while offline
- [ ] Verify note appears in list immediately
- [ ] Verify "pending" chip shows
- [ ] Go online
- [ ] Verify automatic sync
- [ ] Verify success toast
- [ ] Verify pending chip disappears
- [ ] Create note with poor connection
- [ ] Verify retry on failure
- [ ] Verify max attempts handling

### Browser DevTools Testing

1. **Chrome DevTools → Application → Service Workers**
   - Check service worker status
   - Check cache storage
   - Check IndexedDB entries

2. **Chrome DevTools → Network**
   - Set to "Offline"
   - Create note
   - Set to "Online"
   - Watch sync requests

3. **Chrome DevTools → Application → IndexedDB**
   - Inspect `praxis-offline-db`
   - Check `notebook-entries` store
   - Verify `synced` field

---

## 🚀 Future Enhancements

### Planned Features

1. **Background Sync API** (Chrome/Edge only)
   - Sync even if app is closed
   - Better reliability

2. **Conflict Resolution UI**
   - Detect conflicting edits
   - Let user choose which to keep

3. **Manual Sync Control**
   - "Sync Now" button
   - View pending entries
   - Delete pending entries

4. **Sync Status Page**
   - List all pending entries
   - Show sync history
   - Show failed entries

5. **Compression**
   - Compress entries before storage
   - Reduce IndexedDB size

6. **Encryption**
   - Encrypt sensitive entries
   - Decrypt on sync

---

## 📞 Troubleshooting

### Issue: Entries Not Syncing

**Check:**

1. Browser console for errors
2. Service worker status (DevTools → Application)
3. IndexedDB entries exist
4. Network connection stable

**Solution:**

```javascript
// Force sync manually
import { offlineSyncManager } from "./lib/offlineSyncManager";
await offlineSyncManager.forceSync();
```

---

### Issue: IndexedDB Full

**Symptoms:**

- Can't save new offline entries
- Error: "QuotaExceededError"

**Solution:**

```javascript
// Clear synced entries
import { offlineDB } from "./lib/offlineDB";
await offlineDB.clearSynced();
```

---

### Issue: Service Worker Not Registering

**Check:**

1. HTTPS or localhost (SW requirement)
2. Browser supports service workers
3. No console errors

**Solution:**

```javascript
// Check registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}
```

---

## 📚 Related Files

- `client/src/lib/offlineDB.ts` - IndexedDB helper
- `client/src/lib/offlineSyncManager.ts` - Sync manager
- `client/src/hooks/useOffline.ts` - React hook
- `client/public/service-worker.js` - Service worker
- `client/src/features/notes/GoalNotesPanel.tsx` - Updated component

---

**Implementation Status:** ✅ Complete  
**Tested:** Manual testing required  
**Browser Support:** All modern browsers with IndexedDB support
