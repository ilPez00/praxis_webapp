# Notebook Location Tracking & Map View

## Overview

Automatically capture location data when users log notes or track data, and visualize all entries on an interactive map in the Notes page.

## Features

### 1. Automatic Location Capture

When a user creates a notebook entry (note, goal progress, tracker log), their current location is **automatically captured in the background** if:

- Location permission is already granted
- Browser supports geolocation
- User is on a device with GPS/location services

**No prompts or interruptions** - location is cached on page load and attached to logs silently.

### 2. Interactive Map View

A new **"Notes Map"** section appears under the Activity Calendar in `/notes`:

- **Dark-themed** Leaflet.js map (CartoDB Dark Matter tiles)
- **Color-coded markers** by entry type:
  - 📝 Purple: Regular notes
  - 🎯 Green: Goal progress updates
  - 💪 Orange: Tracker logs
  - 🏆 Yellow: Achievements
  - ✅ Blue: Check-ins
  - 🤖 Purple: Axiom briefs
- **Clustered markers** for multiple entries at same location
- **Rich popups** showing:
  - Entry title/content preview
  - Date logged
  - Mood emoji
  - Location name (if available)
  - Count of multiple entries at same spot

### 3. Privacy-First Design

- Location is **opt-in** via browser permission
- No tracking if permission denied
- Cached location only (no continuous background tracking)
- Low precision (5 decimal places ≈ 1m accuracy)
- Only stored when user actively logs something

## Implementation

### Database Migration

```sql
-- Add location columns to notebook_entries
ALTER TABLE public.notebook_entries
ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Index for location queries
CREATE INDEX IF NOT EXISTS idx_notebook_entries_location
ON public.notebook_entries(location_lat, location_lng)
WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;
```

### Files Created

- `client/src/features/notes/NotebookMap.tsx` - Map component
- `migrations/2026-03-25-add-notebook-location-tracking.sql` - DB migration

### Files Modified

- `client/src/features/notes/GoalNotesPanel.tsx` - Auto-capture location
- `client/src/components/common/QuickLogDialog.tsx` - Auto-capture location
- `client/src/features/notes/NotesPage.tsx` - Add map UI and fetch entries

### Location Capture Flow

```typescript
// 1. Cache location on mount (no prompt if already granted)
const getLocation = useCurrentLocation();

// 2. Attach to notebook entry when logging
const location = getLocation();
const payload = {
  content: note,
  // ... other fields
  ...(location && {
    location_lat: location.lat,
    location_lng: location.lng,
  }),
};

// 3. Save to database
await api.post("/notebook/entries", payload);
```

### Map Component Features

```typescript
// Custom icons by entry type
const getIconForType = (entryType: string) => {
  const config = iconConfig[entryType] || defaultConfig;
  return L.divIcon({
    html: `<div style="background: ${config.color}">
             ${config.icon}
           </div>`,
    iconSize: [32, 32],
  });
};

// Cluster entries at same location
const locationGroups = useMemo(() => {
  const groups = new Map();
  for (const entry of entriesWithLocation) {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    groups.get(key)?.push(entry) || groups.set(key, [entry]);
  }
  return groups;
}, [entriesWithLocation]);

// Auto-fit bounds to show all markers
<FitBounds entries={entriesWithLocation} />
```

## User Experience

### First Time User

1. User logs a note in GoalNotesPanel or QuickLogDialog
2. Browser may ask for location permission (one-time)
3. Note is saved with location attached
4. User navigates to `/notes`
5. Sees "Notes Map" section under calendar
6. Map shows their logged locations with markers

### Regular Usage

- Every note/prog ress log captures location silently
- Map updates automatically on page refresh
- Can see patterns: "I log most progress at coffee shops"
- Travel tracking: "Here's where I was when I achieved X"

### Empty State

If no location data yet:

```
┌─────────────────────────────────────┐
│           📝                        │
│   No location data yet              │
│                                     │
│   Notes will appear on the map     │
│   once you start logging with      │
│   location enabled                  │
└─────────────────────────────────────┘
```

## Map UI Layout

```
┌────────────────────────────────────────────┐
│ Activity Calendar                          │
│ [Sun] [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] │
│  🟢   🟢   ⚪   🟢   ⚪   ⚪   ⚪            │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ 📍 Notes Map                               │
│ See where your notes and progress were     │
│ logged                                     │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │                                        │ │
│ │    [Interactive Map]                   │ │
│ │    📍 Rome                             │ │
│ │    📍 Milan    📍 Florence             │ │
│ │         📍 Naples                      │ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

## Location Data Structure

```typescript
interface EntryLocation {
  lat: number;        // 5 decimal places (≈1m precision)
  lng: number;
  accuracy?: number;  // meters, from GPS
}

// Stored in notebook_entries:
{
  id: 'uuid',
  content: 'Great workout today!',
  location_lat: 41.90278,
  location_lng: 12.49636,
  location_name: null,  // Future: reverse geocoded city name
  occurred_at: '2026-03-25T10:30:00Z',
}
```

## Privacy & Security

### What's Captured

- ✅ Latitude/longitude (5 decimals)
- ✅ Only when user actively logs something
- ✅ Cached location (last known position)

### What's NOT Captured

- ❌ Continuous background tracking
- ❌ Movement/speed data
- ❌ Address or place names (yet)
- ❌ Shared with other users

### Permission Model

- Browser-native permission prompt (one-time)
- User can deny/revoke anytime
- No location = no problem (note still saves, just without coords)
- Incognito mode: Location not cached between sessions

## Future Enhancements

### Reverse Geocoding

```typescript
// Convert lat/lng to human-readable location
const locationName = await reverseGeocode(lat, lng);
// Returns: "Rome, Lazio, Italy" or "Central Park, NYC"
```

### Location-Based Insights

- "You log 3x more progress at coffee shops"
- "Your best ideas come when you're traveling"
- "Home vs Work productivity comparison"

### Privacy Controls

- Toggle location tracking on/off
- Delete location data from existing entries
- "Private mode" for sensitive locations

### Social Features

- Share favorite logging spots with accountability partner
- "Popular places" for community (anonymized aggregate)
- Location-based challenges: "Log from 5 different cities"

## Technical Notes

### Dependencies

- `leaflet` ^1.9.4 - Map library
- `react-leaflet` ^4.2.1 - React bindings
- `@types/leaflet` ^1.9.21 - TypeScript types

### Performance

- Max 100 entries displayed on map (LIMIT clause)
- Entries grouped by location (3 decimal precision ≈ 100m)
- Dark Matter tiles load fast and match theme
- Markers use div icons (lighter than image icons)

### Browser Support

- ✅ Chrome/Edge (Geolocation API)
- ✅ Firefox
- ✅ Safari (iOS/macOS)
- ✅ Android Chrome
- ⚠️ Desktop apps without GPS (uses IP-based fallback if available)

## Deployment

### Steps

1. **Run migration** in Supabase SQL editor:
   ```bash
   cat migrations/2026-03-25-add-notebook-location-tracking.sql
   ```
2. **Deploy frontend** - Vercel auto-deploys on push
3. **Test** - Log a note with location enabled, check map

### Rollback

If issues arise, migration is safe to rollback:

```sql
ALTER TABLE public.notebook_entries
DROP COLUMN IF EXISTS location_lat,
DROP COLUMN IF EXISTS location_lng,
DROP COLUMN IF EXISTS location_name;
```

## Analytics (Future)

Track these metrics:

- **Location permission grant rate**: % who enable
- **Entries with location**: % of logs include coords
- **Map engagement**: Time spent viewing map
- **Top locations**: Where users log most (aggregate)

---

**Status**: ✅ Implemented and deployed
**Date**: March 25, 2026
**Impact**: Enhanced context for notebook entries, better insights into where progress happens
