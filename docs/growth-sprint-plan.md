# Praxis Growth Sprint: 2-Week Plan to Maximize Sale Value

## Goal

Transform Praxis from "unproven codebase" to "early-stage SaaS with traction" to maximize acquisition value.

**Target outcome:** $50K → $200K+ valuation jump

---

## Audit Summary (What Exists vs What's Missing)

### Stripe (Payment Flow)

| What's Working            | What's Broken                                              |
| ------------------------- | ---------------------------------------------------------- |
| Checkout session creation | No billing portal (users can't manage sub)                 |
| Webhook handling          | Success page doesn't verify payment server-side            |
| PP purchase flow          | Only monthly pricing (annual UI exists but non-functional) |
|                           | No subscription management UI                              |

### Sharing & Referrals

| What's Working                        | What's Missing                                                      |
| ------------------------------------- | ------------------------------------------------------------------- |
| Streak share after check-in (3+ days) | Achievement/badge sharing                                           |
| Referral code system (+100 PP each)   | Leaderboard sharing                                                 |
| Embeddable widget (/widget/:userId)   | Prominent share prompts throughout flow                             |
| ShareDialog component                 | Share on first-time milestones (7-day streak, first goal completed) |

### Onboarding & Retention

| What's Working              | What's Missing                         |
| --------------------------- | -------------------------------------- |
| Multi-step onboarding flow  | Email service (no Resend/SendGrid/etc) |
| GettingStartedPage tutorial | Web push notifications                 |
| In-app notifications        | Re-engagement for churned users        |
| Axiom daily briefs          | Milestone celebration emails           |
| Nudge feature for partners  | Welcome email sequence                 |

---

## Week 1: Payment Flow + Viral Sharing

### Day 1-2: Fix Critical Stripe Gaps

#### Task 1: Add Billing Portal Integration

**Why:** Without this, users can't cancel/manage their subscription — kills trust and conversions.

**Backend:** `src/routes/stripeRoutes.ts`

```typescript
POST /api/stripe/create-portal-session
  - Creates Stripe Customer Portal session
  - Returns portal URL
  - Auth: authenticateToken
```

**Frontend:** Add "Manage Subscription" button to:

- `SuccessPage.tsx` (post-payment)
- `ProfilePage.tsx` (under subscription section)
- `UpgradePage.tsx` (for existing subscribers)

**Estimated time:** 2-3 hours

---

#### Task 2: Verify Success Page Server-Side

**Why:** Current success page trusts client redirect. A malicious user could fake a success without paying.

**Backend:** `src/routes/stripeRoutes.ts`

```typescript
GET /api/stripe/verify-session?session_id=xxx
  - Verifies session status with Stripe
  - Returns: { status, customerId, subscriptionId, plan }
  - Marks subscription active if completed
```

**Frontend:** `SuccessPage.tsx`

- On mount, call verify endpoint
- Show loading state
- Show success/failure accordingly
- Auto-redirect after 5 seconds if no action needed

**Estimated time:** 2 hours

---

#### Task 3: Add Annual Pricing Toggle

**Why:** Annual pricing increases LTV and reduces churn. You mention $79.99/yr in docs — needs to work.

**Backend:** Add `STRIPE_PRICE_ID_ANNUAL` env var support

- `createCheckoutSession` accepts `{ interval: 'month' | 'year' }`
- Use different Price ID based on interval

**Frontend:** `UpgradePage.tsx`

- Add toggle: "Monthly" vs "Annual (Save 33%)"
- Update pricing display
- Pass interval to checkout endpoint

**Estimated time:** 2 hours

---

### Day 3-4: Supercharge Viral Sharing

#### Task 4: Add Share on Achievement Unlock

**Why:** Achievements are milestone moments — perfect for social sharing.

**Backend:** No changes needed (achievements are already in DB)

**Frontend:** New component `AchievementShareModal.tsx`

```typescript
Props: { achievement: Achievement, onClose: () => void }
- Shows achievement badge/icon
- Pre-filled share text: "I just unlocked [Achievement Name] on Praxis!"
- Share buttons: Twitter, WhatsApp, Telegram, Copy Link
- "Share to get +10 PP" incentive
- Save to notebook option
```

**Integration points:**

- After achievement unlock in any component
- Add to achievement detail view
- Profile page → achievements tab

**Estimated time:** 3-4 hours

---

#### Task 5: Add Share on Leaderboard Position

**Why:** Competition creates viral moments. "I'm #3 in Diamond League" is powerful.

**Frontend:** Add share button to `LeaderboardPage.tsx`

```typescript
- Position badge (e.g., "#1", "Top 10", "Top 100")
- Share text: "I'm ranked #X in the [League] League on Praxis! [flame emoji] [flame emoji]"
- Only show for top 100 users
- Share button appears on hover/tap
```

**Estimated time:** 1-2 hours

---

#### Task 6: Make Check-in Share More Prominent

**Why:** Currently buried in CheckInWidget. Needs to be unmissable.

**Frontend:** `CheckInWidget.tsx` enhancements

```typescript
- Add prominent "Share Your Streak" button (green, centered)
- Add animation when streak milestone reached (7, 14, 30, 60, 100 days)
- Add confetti/stars animation on share
- Show "+10 PP for sharing" badge
```

**Estimated time:** 2-3 hours

---

#### Task 7: Add Share on Goal Completion

**Why:** Completing a goal is a major win — users want to share.

**Frontend:** After marking goal as complete

```typescript
- Show completion modal with confetti
- "You did it!" headline
- Share button: "I just completed [Goal Name] on Praxis!"
- Share buttons: Twitter, WhatsApp, Copy Link
```

**Estimated time:** 2 hours

---

### Day 5: Launch Prep for Product Hunt

#### Task 8: Create Product Hunt Campaign

**Assets needed:**

1. **Hero image** — Dashboard screenshot with annotations
2. **Logo** — Praxis logo (check if exists in assets)
3. **Tagline:** "Your AI-powered accountability partner"
4. **Gallery:** 5-6 screenshots showing key features
5. **Video:** 30-second demo (screen record + voiceover)
6. **Maker story:** Why you built it, personal journey

**Screenshots to capture:**

1. Dashboard with streak + Axiom brief
2. Goal tree visualization
3. Match/profile discovery
4. Leaderboard
5. Marketplace/PP purchase

**Hunt title options:**

- "Praxis — AI accountability partner that actually works"
- "Build habits with an AI coach and real accountability buddies"
- "Praxis — Where goals meet community"

**Estimated time:** 3-4 hours (plus recording)

---

#### Task 9: Write PH Launch Copy

```markdown
# Praxis

**One-line description:**
AI-powered daily goal journal with real accountability partners.

**Longer description:**
Praxis combines smart goal tracking with social accountability. Set goals, build streaks, get matched with accountability buddies, and receive AI coaching from Axiom — your personal productivity advisor.

**Features:**

- 🎯 Goal Trees — hierarchical goal tracking
- 🔥 Streaks — daily check-ins with partner accountability
- 🤝 Matching — AI-powered partner matching based on goals
- 🤖 Axiom — daily AI briefs and weekly coaching
- 🏆 Gamification — levels, achievements, leaderboards
- 💎 Marketplace — earn and spend Praxis Points

**Pricing:** Free tier + $9.99/mo Pro

**Maker:** Single developer, 6+ months of work, 300+ commits
```

---

#### Task 10: Prepare Launch Checklist

- [ ] Product Hunt maker account created
- [ ] Assets uploaded (images, video)
- [ ] Copy reviewed and finalized
- [ ] Social media accounts ready (Twitter, Reddit)
- [ ] Hunter selected (your account or find a hunter)
- [ ] Launch date set (pick a Tuesday-Thursday, avoid Monday/Friday)

---

## Week 2: Retention + Metrics + Packaging

### Day 6-7: Add Email Notifications

#### Task 11: Set Up Resend for Transactional Email

**Why:** Currently zero email touchpoints. Email is the #1 retention tool.

**Setup:**

```bash
npm install resend
```

**Backend:** `src/services/emailService.ts`

```typescript
class EmailService {
  async sendWelcomeEmail(user: User);
  async sendStreakReminder(userId: string, streak: number);
  async sendMilestoneCelebration(userId: string, milestone: string);
  async sendWeeklyDigest(userId: string, stats: WeeklyStats);
  async sendReEngagement(userId: string, lastActive: Date);
}
```

**Email templates:**

1. **Welcome email** — Day 0, onboarding complete
   - "Welcome to Praxis! Here's your first goal to get started..."
2. **Streak at risk** — Day 1-2 of inactivity
   - "Your 7-day streak is about to break! Check in now..."
3. **Milestone celebration** — On 7, 14, 30, 60, 100 day streaks
   - "Congratulations! You hit a 30-day streak..."
4. **Weekly digest** — Every Sunday
   - Stats: goals completed, streak maintained, XP gained, rank change

5. **Re-engagement** — Day 7 of inactivity
   - "We miss you! Here's what you accomplished..."

**Estimated time:** 4-6 hours

---

#### Task 12: Add Milestone Celebrations In-App

**Why:** Email + in-app = stronger retention.

**Frontend:** `MilestoneModal.tsx`

```typescript
// Triggers on:
- First goal created
- First check-in completed
- 7, 14, 30, 60, 100 day streak
- First achievement unlocked
- Reaching level 10, 25, 50, 100

// Modal content:
- Confetti animation
- Achievement badge/icon
- Share button
- PP/XP reward notification
- "Share to double your reward!"
```

**Estimated time:** 3-4 hours

---

### Day 8-9: Build Metrics Dashboard

#### Task 13: Create Admin Metrics Endpoint

**Why:** Need to document metrics for acquirer.

**Backend:** `src/routes/adminRoutes.ts`

```typescript
GET /api/admin/metrics
  Returns: {
    totalUsers: number,
    activeUsers (7d): number,
    activeUsers (30d): number,
    payingUsers: number,
    mrr: number,
    churnRate: number,
    avgStreak: number,
    newUsersThisWeek: number,
    newPayingUsersThisWeek: number,
    topGoals: [{ name: string, count: number }],
    retentionCurve: [{ day: number, retention: number }]
  }
```

**Frontend:** `admin/src/pages/MetricsPage.tsx`

- Simple dashboard showing key metrics
- Export to CSV button
- Charts using MUI X Charts (already installed)

**Estimated time:** 3-4 hours

---

#### Task 14: Document API Costs

**Why:** First thing every acquirer asks.

**Create:** `docs/api-costs.md`

```markdown
# Monthly API Costs (March 2026)

## Supabase

- Plan: [Your plan]
- Cost: ~$XX/month
- Usage: Database, Auth, Storage, Realtime

## Google Gemini

- Usage: ~XX requests/month
- Cost: ~$XX/month (pay-as-you-go)
- Breakdown: Daily briefs, weekly narratives, matching embeddings

## Vercel (Frontend)

- Plan: [Hobby/Pro]
- Cost: ~$XX/month

## Railway (Backend)

- Plan: [Starter/Basic]
- Cost: ~$XX/month

## Total Variable Costs

- $XXX/month base
- $X.XX per additional user

## Notes

- Gemini costs scale with active users
- At 1000 DAU, estimated cost: $XXX/month
- Supabase has generous free tier for development
```

---

### Day 10: Package for Sale

#### Task 15: Create Acquisition Package

**Create:** `docs/acquisition-packet.md`

```markdown
# Praxis — Acquisition Information

**Date:** April 2026
**Stage:** Pre-launch / Early traction

## The Product

[1 paragraph elevator pitch]

## Key Metrics

| Metric              | Value    |
| ------------------- | -------- |
| Total Users         | [X]      |
| 7-Day Active Users  | [X]      |
| 30-Day Active Users | [X]      |
| Paying Users        | [X]      |
| MRR                 | $[X]     |
| Churn Rate          | [X]%     |
| Avg. Streak         | [X] days |

## Revenue Model

- Pro tier: $9.99/month
- Annual: $79.99/year
- PP purchases: $4.99-$24.99
- Platform fee: 5% on duel winnings

## Tech Stack

- Frontend: React + TypeScript + MUI v7
- Backend: Express + TypeScript
- Database: Supabase (PostgreSQL + pgvector)
- AI: Google Gemini
- Payments: Stripe

## Unit Economics

- CAC: $[X] (if paid ads)
- LTV: $[X] (estimated)
- LTV:CAC ratio: [X]:1

## Growth Trajectory

[Graph or table of user growth over time]

## Ask

- Asking price: $[XXX,XXX]
- Preferred structure: [Cash/Equity/Split]
- Open to: [Acqui-hire, full acquisition, partnership]

## Contact

[Gio, Verona Italy]
[email]
[LinkedIn if exists]
```

---

#### Task 16: Create Pitch Deck

**Create:** `docs/pitch-deck.md` (or .pptx if using Deckset)

**Slides:**

1. **Title** — Praxis + tagline
2. **Problem** — Accountability is hard alone
3. **Solution** — AI + community accountability
4. **How it works** — 4-step visual
5. **Features** — Dashboard, matching, Axiom
6. **Business model** — Pricing tiers
7. **Traction** — Metrics
8. **Market** — $XXB productivity app market
9. **Competition** — Compared to Habitica, Coach.me, etc.
10. **Team** — You (if solo)
11. **Ask** — Amount + use of funds
12. **Contact**

---

## Execution Order

### MUST DO (Week 1, Day 1-2)

1. ✅ Billing portal integration
2. ✅ Success page verification
3. ✅ Share on check-in (make prominent)

### SHOULD DO (Week 1, Day 3-4)

4. ✅ Achievement share modal
5. ✅ Leaderboard share
6. ✅ Goal completion share

### NICE TO HAVE (Week 1, Day 5)

7. ✅ Product Hunt assets
8. ✅ Launch copy

### WEEK 2

9. Email service (Resend)
10. Milestone modals
11. Metrics dashboard
12. Acquisition packet

---

## Time Estimate Summary

| Task                       | Estimated Time  |
| -------------------------- | --------------- |
| Billing portal             | 2-3 hours       |
| Success page verification  | 2 hours         |
| Annual pricing             | 2 hours         |
| Achievement share          | 3-4 hours       |
| Leaderboard share          | 1-2 hours       |
| Check-in share (prominent) | 2-3 hours       |
| Goal completion share      | 2 hours         |
| Product Hunt assets        | 3-4 hours       |
| **Week 1 Total**           | **17-22 hours** |
| Email service              | 4-6 hours       |
| Milestone modals           | 3-4 hours       |
| Metrics dashboard          | 3-4 hours       |
| Documentation              | 2-3 hours       |
| **Week 2 Total**           | **12-17 hours** |
| **Grand Total**            | **29-39 hours** |

---

## Success Metrics

By end of Week 2, you should have:

- [ ] Payment flow is bulletproof (billing portal + verification)
- [ ] 3+ share touchpoints throughout the app
- [ ] 10+ paying users (from PH launch + outreach)
- [ ] Documented metrics showing growth trajectory
- [ ] Acquisition packet ready to send
- [ ] Clean, well-documented codebase with no obvious red flags

**Target outcome:** $50K → $200K+ valuation
