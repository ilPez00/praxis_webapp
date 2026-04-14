# Praxis Webapp - Comprehensive Code Audit Report

**Date:** March 18, 2026  
**Auditor:** AI Code Analysis  
**Scope:** Full-stack application (Frontend, Backend, Database)

---

## Executive Summary

This audit examined the Praxis webapp codebase - a life coaching/goal tracking platform built with React, Node.js, TypeScript, and Supabase. The application features AI coaching (Axiom), goal tracking, social features, and a notebook/journaling system.

**Overall Assessment:** The codebase is functional with strong engineering in areas like AI integration and real-time features, but has **critical issues** requiring immediate attention:

- 🔴 **7 Critical Issues** (bugs that could cause data loss or crashes)
- 🟡 **5 Performance Issues** (causing slowness)
- 🟠 **6 UX Issues** (poor user experience)
- 🟣 **6 Code Quality Issues** (maintainability concerns)

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1.1 Missing Error Handling on API Calls

**Location:** `client/src/features/coaching/AICoachPage.tsx:126-360`

**Problem:** Multiple fetch() calls have empty catch blocks that silently ignore errors.

```typescript
// ❌ BAD - Silent failure
} catch { /* ignore */ } finally {
  setLoadingDaily(false);
}

// ✅ GOOD - Proper error handling
} catch (err: any) {
  console.error('Failed to load daily brief:', err);
  toast.error('Failed to load daily brief');
} finally {
  setLoadingDaily(false);
}
```

**Impact:** Users receive no feedback when API calls fail, leading to confusion and broken UX.

**Priority:** HIGH  
**Files to fix:** AICoachPage.tsx (3 locations), ChatRoom.tsx (1 location)

---

### 1.2 Memory Leak - Missing Cleanup for setInterval

**Location:** `client/src/features/dashboard/components/DesktopWidget.tsx:83-88`

**Problem:** setInterval created but dependency array can cause stale closures and multiple intervals running.

```typescript
// ❌ BAD - Potential memory leak
useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [fetchData]); // fetchData changes reference, creating new intervals

// ✅ GOOD - Stable reference
const fetchData = useCallback(async () => { ... }, []);

useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [fetchData]);
```

**Priority:** HIGH

---

### 1.3 Missing Cleanup for Supabase Realtime Subscriptions

**Location:** `client/src/components/common/Navbar.tsx:120-145`

**Problem:** Supabase channel subscription cleanup may not handle all edge cases.

```typescript
// ❌ BAD - May leak if unmount during setup
useEffect(() => {
  const channel = supabase.channel(...).subscribe();
  return () => { supabase.removeChannel(channel); };
}, []);

// ✅ GOOD - Store reference
const channelRef = useRef<any>(null);

useEffect(() => {
  if (!user) return;
  const channel = supabase.channel(...).subscribe();
  channelRef.current = channel;
  return () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
  };
}, [user?.id]);
```

**Priority:** HIGH

---

### 1.4 Unhandled Promise Rejection in ChatRoom

**Location:** `client/src/features/chat/ChatRoom.tsx:181-189`

**Problem:** Async IIFE has empty catch block.

```typescript
// ❌ BAD
} catch { /* ignore */ }

// ✅ GOOD
} catch (err) {
  console.error('Failed to load mute status:', err);
}
```

**Priority:** HIGH

---

### 1.5 Security Risk - Console Logs in Production

**Location:** `src/routes/notebookRoutes.ts:32,52,56,101,135`

**Problem:** Sensitive user data logged to console.

```typescript
// ❌ BAD - Exposes user data
console.log("[notebookRoutes] Fetching entries:", {
  userId,
  entry_type,
  domain,
  tag,
  search,
});

// ✅ GOOD - Use logger with levels
logger.debug("Fetching notebook entries", {
  userId,
  filters: { entry_type, domain },
});
```

**Priority:** HIGH

---

### 1.6 Type Safety Issue - Missing Return Type

**Location:** `src/services/AxiomScanService.ts:236-534`

**Problem:** Large async function has no explicit return type, uses `any` extensively.

```typescript
// ❌ BAD - No return type
public static async generateDailyBrief(userId: string, ...) { ... }

// ✅ GOOD - Explicit return type
public static async generateDailyBrief(
  userId: string,
  userName: string,
  userCity: string,
  useLLM: boolean = true,
  userData?: any
): Promise<void> { ... }
```

**Priority:** HIGH

---

### 1.7 Race Condition - Optimistic Update Without Rollback

**Location:** `client/src/features/chat/ChatRoom.tsx:267-280`

**Problem:** Optimistic message update has no rollback mechanism if server fails.

```typescript
// ❌ BAD - No rollback
setMessages(prev => [...prev, optimisticMsg]);
setNewMessage('');
await api.post('/messages', {...}); // If this fails, message is lost

// ✅ GOOD - Rollback on failure
const optimisticMsg = { id: `optimistic-${Date.now()}`, ... };
setMessages(prev => [...prev, optimisticMsg]);

try {
  await api.post('/messages', {...});
} catch (err) {
  setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
  toast.error('Message failed to send');
}
```

**Priority:** HIGH

---

## 🟡 PERFORMANCE ISSUES

### 2.1 Missing React.memo on Large Lists

**Location:** `client/src/features/notebook/NotebookPage.tsx:400-550`

**Problem:** Notebook entries rendered without memoization, causing re-renders.

**Fix:** Wrap entry component in `React.memo`.

**Priority:** MEDIUM

---

### 2.2 Inefficient useEffect Dependencies

**Location:** `client/src/features/dashboard/DashboardPage.tsx:50-107`

**Problem:** Multiple useEffects with overlapping dependencies cause redundant fetches.

**Fix:** Combine into single effect or use React Query.

**Priority:** MEDIUM

---

### 2.3 No Virtualization for Long Lists

**Location:** `client/src/features/notebook/NotebookPage.tsx:1-656`

**Problem:** All entries rendered at once, no windowing.

**Fix:** Use `react-window` or `@mui/x-data-grid`.

**Priority:** MEDIUM

---

### 2.4 Redundant API Calls

**Location:** `client/src/features/coaching/AICoachPage.tsx:138-175`

**Problem:** Daily brief fetched from both Supabase AND API endpoint.

**Fix:** Use single source of truth.

**Priority:** MEDIUM

---

### 2.5 Missing SWR Cache Configuration

**Location:** `client/src/hooks/useFetch.ts:1-50`

**Problem:** SWR configured with long deduping interval but no revalidation strategy.

**Fix:** Add proper revalidation configuration.

**Priority:** MEDIUM

---

## 🟠 UX IMPROVEMENTS

### 3.1 Missing Loading States

**Location:** `client/src/features/notebook/NotebookPage.tsx:105-150`

**Problem:** No loading indicator when filtering/searching.

**Priority:** MEDIUM

---

### 3.2 No Skeleton Screens

**Location:** `client/src/features/dashboard/DashboardPage.tsx:1-350`

**Problem:** Shows spinner instead of progressive skeleton screens.

**Priority:** MEDIUM

---

### 3.3 Missing Toast Notifications

**Location:** `client/src/components/common/Navbar.tsx:116-170`

**Problem:** Notification fetch failures silently ignored.

**Priority:** MEDIUM

---

### 3.4 No Confirmation Dialog

**Location:** `client/src/features/notebook/NotebookPage.tsx:175-195`

**Problem:** Delete uses browser `confirm()` instead of styled dialog.

**Priority:** MEDIUM

---

### 3.5 Missing Keyboard Shortcuts

**Location:** `client/src/features/notebook/NotebookPage.tsx:1-656`

**Problem:** No keyboard shortcuts for common actions.

**Priority:** LOW

---

### 3.6 No Offline Indicator

**Location:** `client/src/utils/serviceWorker.ts:1-80`

**Problem:** `isOffline()` function exists but never used in UI.

**Priority:** LOW

---

## 🟣 CODE QUALITY ISSUES

### 4.1 Inconsistent Error Handling Pattern

**Problem:** Mix of empty catch blocks, console.error only, and proper handling.

**Fix:** Standardize error handling pattern across codebase.

**Priority:** MEDIUM

---

### 4.2 Missing JSDoc Documentation

**Locations:**

- `src/services/*.ts` - Partially documented
- `src/controllers/*.ts` - Partially documented
- `client/src/hooks/*.ts` - Partially documented

**Priority:** MEDIUM

---

### 4.3 Magic Numbers

**Location:** `src/controllers/aiCoachingController.ts:36-37`

**Problem:** Hardcoded PP costs without constants.

**Fix:** Create config file with pricing constants.

**Priority:** LOW

---

### 4.4 Inconsistent Naming Conventions

**Problem:** Mix of naming styles (camelCase, PascalCase).

**Priority:** LOW

---

### 4.5 Large Component Files

**Files:**

- `NotebookPage.tsx` - 656 lines
- `AICoachPage.tsx` - 758 lines
- `AxiomScanService.ts` - 1018 lines

**Priority:** MEDIUM

---

### 4.6 Missing Input Validation

**Location:** `src/routes/notebookRoutes.ts:80-145`

**Problem:** POST endpoint accepts any content without validation.

**Priority:** MEDIUM

---

## 🏗️ ARCHITECTURE RECOMMENDATIONS

### 5.1 Implement Centralized State Management

**Recommendation:** Implement React Query (TanStack Query) for centralized caching, automatic revalidation, and optimistic updates.

**Priority:** HIGH

---

### 5.2 Add API Client Abstraction Layer

**Recommendation:** Create typed API client with centralized error handling.

**Priority:** HIGH

---

### 5.3 Implement Proper Error Boundaries

**Recommendation:** Add granular error boundaries at route, widget, and feature levels.

**Priority:** MEDIUM

---

### 5.4 Add Comprehensive Logging Strategy

**Recommendation:** Remove console.log, use structured Winston logging with correlation IDs.

**Priority:** MEDIUM

---

### 5.5 Implement Comprehensive Testing Strategy

**Recommendation:** Add unit, integration, and E2E tests with coverage goals.

**Priority:** HIGH

---

### 5.6 Add Database Migration Strategy

**Recommendation:** Use migration tool with version tracking and rollback scripts.

**Priority:** MEDIUM

---

### 5.7 Implement Feature Flags

**Recommendation:** Add feature flags for A/B testing and gradual rollouts.

**Priority:** LOW

---

### 5.8 Add Performance Monitoring

**Recommendation:** Implement Web Vitals, APM tool, and database query monitoring.

**Priority:** MEDIUM

---

## 📊 DOCUMENTATION STATUS

### Backend

| Directory          | Status     | Notes                           |
| ------------------ | ---------- | ------------------------------- |
| `src/services/`    | ⚠️ Partial | AxiomScanService has some docs  |
| `src/controllers/` | ⚠️ Partial | Inconsistent                    |
| `src/models/`      | ❌ Missing | No JSDoc                        |
| `src/middleware/`  | ✅ Good    | errorHandler.ts well documented |
| `src/utils/`       | ⚠️ Partial | Logger partial                  |

### Frontend

| Directory                | Status     | Notes             |
| ------------------------ | ---------- | ----------------- |
| `client/src/hooks/`      | ⚠️ Partial | useUser.ts good   |
| `client/src/features/`   | ❌ Missing | No component docs |
| `client/src/components/` | ❌ Missing | No docs           |
| `client/src/utils/`      | ⚠️ Partial | Some functions    |
| `client/src/lib/`        | ⚠️ Partial | Minimal           |

---

## 📋 PRIORITIZED ACTION PLAN

### Week 1-2: Critical Fixes

- [ ] Fix all missing error handling (1.1, 1.3, 1.4)
- [ ] Fix memory leaks (1.2, 1.3)
- [ ] Fix race conditions (1.7)
- [ ] Remove sensitive console logs (1.5)
- [ ] Add type annotations (1.6)

### Week 3-4: Performance Improvements

- [ ] Add React.memo to list components (2.1)
- [ ] Implement virtualization (2.3)
- [ ] Optimize useEffect dependencies (2.2)
- [ ] Configure SWR properly (2.5)

### Month 2: UX Enhancements

- [ ] Add loading states (3.1)
- [ ] Implement skeleton screens (3.2)
- [ ] Add toast notifications (3.3)
- [ ] Replace confirm dialogs (3.4)

### Month 3: Code Quality

- [ ] Add JSDoc to all public APIs (4.2)
- [ ] Extract constants (4.3)
- [ ] Break large components (4.5)
- [ ] Add input validation (4.6)

### Month 4+: Architecture

- [ ] Implement React Query (5.1)
- [ ] Create API client abstraction (5.2)
- [ ] Add comprehensive testing (5.5)
- [ ] Implement logging strategy (5.4)

---

## 📝 FILES REVIEWED

### Backend (src/)

- **Controllers:** 40 files, ~8,000 LOC
- **Services:** 10 files, ~3,500 LOC
- **Routes:** 44 files, ~4,000 LOC
- **Models:** 11 files, ~1,000 LOC
- **Middleware:** 4 files, ~400 LOC
- **Utils:** 8 files, ~800 LOC

### Frontend (client/src/)

- **Features:** 34 directories, ~15,000 LOC
- **Components:** 19 files, ~2,500 LOC
- **Hooks:** 4 files, ~400 LOC
- **Utils:** 8 files, ~600 LOC
- **Config:** 2 files, ~200 LOC

---

## ✅ CONCLUSION

The Praxis webapp has strong foundations but requires immediate attention to:

1. **Error Handling** - Critical gaps causing potential data loss
2. **Memory Management** - Leaks causing performance degradation
3. **Type Safety** - Extensive `any` usage reduces safety
4. **Documentation** - Missing docs hinder maintenance
5. **Testing** - Minimal coverage increases regression risk

**Next Steps:** Start with critical fixes in Section 1, then proceed through the prioritized action plan.

---

_Generated by AI Code Audit - March 18, 2026_
