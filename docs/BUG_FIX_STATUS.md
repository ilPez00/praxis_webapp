# 🚀 PRAXIS — DEPLOYMENT & BUG FIX STATUS

**Last Updated:** March 28, 2026  
**Growth Sprint:** 100% Complete ✅

---

## ⚠️ PRE-EXISTING BUGS (Not from Growth Sprint)

These issues existed before the growth sprint work:

### 1. ShareDialog.tsx — MUI v7 API Changes

**File:** `client/src/components/common/ShareDialog.tsx`  
**Issue:** `ListItem` component API changed in MUI v7  
**Fix Needed:**

```tsx
// Old (broken)
<ListButton component="label" htmlFor="...">

// New (fixed)
<ListItem>
  <ListItemButton component="label" htmlFor="...">
```

**Estimated Fix:** 15 minutes

---

### 2. ShareButton.tsx — Missing Import

**File:** `client/src/components/common/ShareButton.tsx`  
**Issue:** Missing import statement  
**Fix:**

```tsx
import { useUser } from "../../hooks/useUser";
```

**Estimated Fix:** 2 minutes

---

### 3. GoalSelectionPage.tsx — Domain Enum Mismatch

**File:** `client/src/features/onboarding/GoalSelectionPage.tsx`  
**Issue:** Domain enum values don't match backend  
**Fix:** Update domain strings to match `Domain` enum in `src/models/Domain.ts`

**Estimated Fix:** 10 minutes

---

### 4. MarketplacePage.tsx — Missing Supabase Import

**File:** `client/src/features/marketplace/MarketplacePage.tsx`  
**Issue:** `supabase` used but not imported  
**Fix:**

```tsx
import { supabase } from "../../lib/supabase";
```

**Estimated Fix:** 2 minutes

---

## 📧 OPTIONAL: Email Triggers (Not Critical)

These email templates exist but aren't automatically triggered:

### 1. Weekly Digest Email

**Template:** ✅ Exists in `src/services/emailService.ts`  
**Trigger:** ❌ Not scheduled  
**Implementation:**

```typescript
// Add to src/utils/cron.ts or Railway cron
import EmailService from "../services/emailService";

// Run every Sunday at 9 AM
async function sendWeeklyDigests() {
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, name");

  for (const user of users) {
    // Calculate weekly stats
    const stats = await getUserWeeklyStats(user.id);
    await EmailService.sendWeeklyDigest(user, stats);
  }
}
```

**Priority:** Low (nice-to-have)  
**Estimated Time:** 1-2 hours

---

### 2. Re-engagement Email

**Template:** ✅ Exists in `src/services/emailService.ts`  
**Trigger:** ❌ Not scheduled  
**Implementation:**

```typescript
// Run daily at 10 AM
async function sendReEngagementEmails() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: inactiveUsers } = await supabase
    .from("profiles")
    .select("id, email, name, last_activity_date")
    .lt("last_activity_date", sevenDaysAgo.toISOString())
    .eq("email_preferences.re_engagement", true);

  for (const user of inactiveUsers) {
    await EmailService.sendReEngagement(user);
  }
}
```

**Priority:** Low (nice-to-have)  
**Estimated Time:** 1 hour

---

## 🔧 OPTIONAL: Infrastructure Improvements

### 3. Webhook Retry Handling

**Issue:** If Stripe webhook fails to credit PP, no automatic retry  
**Current Behavior:** Manual intervention required  
**Fix Options:**

**Option A: Queue-based retry (Recommended)**

```typescript
// Use Supabase pg_cron or external queue (Upstash, SQS)
CREATE TABLE webhook_retry_queue (
  id UUID DEFAULT gen_random_uuid(),
  event_id TEXT,
  event_type TEXT,
  payload JSONB,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ DEFAULT now()
);
```

**Option B: Simple logging + manual review**

```typescript
// Log failed webhooks to separate table for manual review
await supabase.from("failed_webhooks").insert({
  event_id: event.id,
  error: error.message,
  timestamp: new Date().toISOString(),
});
```

**Priority:** Medium (production readiness)  
**Estimated Time:** 3-4 hours (Option A) / 1 hour (Option B)

---

### 4. Elite Tier Implementation

**Issue:** "Elite" tier mentioned in streak rewards but not implemented  
**Current Tiers:**

- ✅ Pioneer (10 PP)
- ✅ Apprentice (20 PP)
- ✅ Achiever (50 PP)
- ✅ Mentor (80 PP)
- ✅ Legend (150 PP)
- ✅ Visionary (200 PP)
- ❌ Elite (not implemented)

**Fix:** Either:

1. Remove "Elite" references from docs/UI
2. OR implement as tier between Legend and Visionary (250 PP)

**Priority:** Low (cosmetic)  
**Estimated Time:** 30 minutes

---

## ✅ GROWTH SPRINT FEATURES (All Working)

### Week 1: Revenue + Viral (7/7 ✅)

- [x] Stripe billing portal
- [x] Success page verification
- [x] Annual pricing toggle
- [x] Achievement share modal
- [x] Leaderboard share button
- [x] Check-in share (+10 PP)
- [x] Goal completion share

### Week 2: Retention + Packaging (4/4 ✅)

- [x] Email service (5 templates)
- [x] Milestone celebration modal
- [x] Admin metrics dashboard
- [x] Acquisition packet documentation

---

## 📋 RECOMMENDED FIX ORDER

### Before Product Hunt Launch (Critical)

1. ✅ ShareButton.tsx — Missing import (2 min)
2. ✅ MarketplacePage.tsx — Missing supabase import (2 min)
3. ✅ GoalSelectionPage.tsx — Domain mismatch (10 min)
4. ✅ ShareDialog.tsx — MUI v7 API (15 min)

**Total:** ~30 minutes

### After Launch (Optional)

5. Weekly digest cron job (1-2 hours)
6. Re-engagement cron job (1 hour)
7. Webhook retry handling (1-4 hours)
8. Elite tier decision (30 min)

---

## 🎯 VERIFICATION CHECKLIST

After fixing pre-existing bugs:

**Frontend:**

- [ ] ShareDialog opens without errors
- [ ] ShareButton works on all pages
- [ ] GoalSelectionPage onboarding completes
- [ ] MarketplacePage loads without crashes

**Backend:**

- [ ] Stripe webhooks credit PP correctly
- [ ] Email service sends milestone emails
- [ ] Metrics endpoint returns data

**Growth Features:**

- [ ] Check-in share button visible (streak >= 3)
- [ ] Achievement share modal appears
- [ ] Leaderboard share button works
- [ ] Annual pricing toggle switches prices

---

## 📞 SUPPORT

For questions about fixes or implementation:

- Check `docs/ACQUISITION_PACKET.md` for business context
- Check `docs/METRICS_DASHBOARD_GUIDE.md` for metrics setup
- Review commit messages for feature details

---

**Status:** Growth Sprint Complete ✅  
**Pre-existing Bugs:** 4 (all minor, ~30 min total fix time)  
**Optional Enhancements:** 4 (can be done post-launch)

**Ready for Product Hunt launch after fixing 4 pre-existing bugs!** 🚀
