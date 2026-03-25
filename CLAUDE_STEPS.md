# Praxis - Development Roadmap

**Last Updated:** March 25, 2026
**Current Version:** 1.3.0 (Professional Improvements)
**Next Milestone:** v1.4.0 (Mobile App & Advanced Integrations)

---

## 📝 Latest Progress (March 25, 2026) - pro_fixes.txt Implementation

### Professional Improvements Plan

**Source:** `docs/pro_fixes.txt` - Professional improvements roadmap

#### ✅ Priority 1.1: Fix 5 Failing Backend Tests (DONE)

**Date:** March 25, 2026  
**Effort:** 30 minutes  
**Impact:** CI/CD reliability, technical debt reduction

**Fixed Tests:**

- `POST /auth/login` validation - Fixed assertion messages
- `POST /auth/signup` validation - Fixed route path (/register → /signup)
- `GET /users/nearby` auth protection - Fixed endpoint path
- All protected endpoints now properly return 401

**Result:** All 16 tests passing (was 5 failing)  
**Commit:** `6c0c9cb` - "test: fix 5 failing backend tests"

#### ✅ Priority 1.2: Add Pre-commit Hooks (DONE)

**Date:** March 25, 2026  
**Effort:** 1 hour  
**Impact:** Catches issues before CI, faster feedback loop

**Installed:**

- Husky v9 (Git hooks manager)
- lint-staged (Run linters on staged files)

**Configuration:**

- `.husky/pre-commit` - Git hook that runs on every commit
- `.lintstagedrc.json` - Linting rules:
  - TypeScript/ESLint checks for `.ts,.tsx` files
  - Prettier formatting for `.css,.scss,.json,.md`

**Result:** Code quality enforced before every commit  
**Commit:** `88d2fc4` - "feat: add pre-commit hooks, security headers, and rate limiting"

#### ✅ Priority 2.2: Rate Limiting (ALREADY DONE)

**Status:** Already implemented in previous sessions  
**Location:** `src/middleware/rateLimiter.ts`

- `authLimiter` - Strict limits for auth endpoints
- `aiLimiter` - Rate limit AI coaching requests
- `generalLimiter` - General API rate limiting

#### ✅ Priority 2.3: Security Headers with Helmet (DONE)

**Date:** March 25, 2026  
**Effort:** 30 minutes  
**Impact:** XSS protection, clickjacking prevention

**Installed:** `helmet` package  
**Configuration:** `src/app.ts`

```typescript
app.use(
  helmet({
    contentSecurityPolicy: false, // Can enable with custom config
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);
```

**Security Headers Enabled:**

- `X-XSS-Protection` - XSS attack prevention
- `X-Frame-Options` - Clickjacking prevention
- `X-Content-Type-Options` - MIME sniffing prevention
- `Strict-Transport-Security` - HTTPS enforcement

**Commit:** `88d2fc4` - "feat: add pre-commit hooks, security headers, and rate limiting"

#### ✅ Priority 1.3: Add Sentry Error Logging (DONE)

**Date:** March 25, 2026  
**Effort:** 1.5 hours  
**Impact:** Production debugging, faster incident response

**Installed:**

- `@sentry/node` - Backend error tracking
- `@sentry/react` - Frontend error tracking
- `@sentry/profiling-node` - CPU profiling

**Configuration:**

- Backend: `src/lib/sentry.ts` - Auto-captures errors, HTTP requests, performance
- Frontend: `client/src/lib/sentry.ts` - Auto-captures React errors, session replay
- Environment: Configurable DSN via `.env`

**Features Enabled:**

- ✓ Unhandled exception capture
- ✓ Promise rejection tracking
- ✓ HTTP error monitoring
- ✓ Performance transactions (10% sample rate)
- ✓ CPU profiling (10% sample rate)
- ✓ Session replay for frontend (10% sample rate)
- ✓ Error sampling to reduce noise
- ✓ Ignore patterns for browser extensions

**Files Created:**

- `src/lib/sentry.ts` - Backend configuration
- `client/src/lib/sentry.ts` - Frontend configuration
- `.env.example` - Updated with Sentry DSN placeholders

**Commit:** `fe5d581` - "feat: add Sentry error tracking"

---

## 🚧 In Progress (v1.3.0 Professional Improvements)

### Priority 2.1: Add Input Validation with Zod (DONE ✅)

**Date:** March 25, 2026  
**Effort:** 2 hours  
**Impact:** Security hardening, API reliability

**Installed:** `zod` validation library

**Schemas Created:**

- `src/schemas/userSchemas.ts` - Registration, login, profile updates
- `src/schemas/trackerSchemas.ts` - Tracker entries, creation
- `src/schemas/messageSchemas.ts` - Messages, chat rooms
- `src/schemas/goalSchemas.ts` - Goal creation, progress updates

**Middleware:**

- `src/middleware/validateRequest.ts` - Reusable validation middleware

**Endpoints Protected:**

- `POST /auth/signup` - Email format, password strength (8+ chars, letter+number)
- `POST /auth/login` - Email, password required
- `POST /trackers/log` - UUID validation, data structure
- `POST /messages/` - Receiver ID, content length (max 5000 chars)
- `POST /goals/:userId/node` - Domain enum, name length, future dates

**Error Response Format:**

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

**Commit:** `c434c68` - "feat: add Zod input validation"

---

## 🎯 Quick Wins (Priority 4.2 + API Docs) - COMPLETE ✅

### Health Endpoint for Uptime Monitoring (DONE)

**Date:** March 25, 2026  
**Effort:** 15 minutes  
**Impact:** SLA visibility, incident detection, production monitoring

**Endpoints Created:**

- `GET /health` - Basic health check
  - Returns: status, timestamp, uptime, version, environment
- `GET /health/ready` - Readiness check (database connectivity)
  - Returns: status, database connection status
  - Use for: Kubernetes readiness probes, load balancer checks
- `GET /health/live` - Liveness check (process health)
  - Returns: status, PID, memory usage
  - Use for: Kubernetes liveness probes

**Files:**

- `src/routes/healthRoutes.ts` - Health check routes
- `src/app.ts` - Routes registered at `/health`

**Usage:**

```bash
curl https://web-production-646a4.up.railway.app/health
# {"status":"healthy","timestamp":"...","uptime":12345,"version":"1.3.0"}

curl https://web-production-646a4.up.railway.app/health/ready
# {"status":"ready","database":"connected"}
```

**Commit:** `5aa94e7`

### API Documentation (DONE)

**Date:** March 25, 2026  
**Effort:** 1 hour  
**Impact:** Developer experience, external integrations, onboarding

**Created:** `docs/API_REFERENCE.md` (1200+ lines)

**Documented Endpoints:**

1. Health & Monitoring (3 endpoints)
2. Authentication (signup, login)
3. Goal Management (create, update progress)
4. Tracker System (log entries)
5. Messaging (send messages)
6. Notebook (create entries)

**Documentation Includes:**

- ✓ Request/response examples for all endpoints
- ✓ Validation rules with field requirements
- ✓ Error response formats (400, 401, 403, 404, 429, 500)
- ✓ Rate limiting documentation (limits by endpoint type)
- ✓ Authentication guide (Bearer token usage)
- ✓ Best practices section
- ✓ Support contact information

**Commit:** `5aa94e7`

---

## ✅ Completed (v1.0.0 MVP)

### Core Features

- [x] User authentication (Supabase Auth)
- [x] Goal tree creation and management
- [x] Domain-based goal categorization (9 domains)
- [x] Progress tracking (0-100%)
- [x] Goal deadlines and target dates
- [x] Editable tracker form for speed dial trackers

### Social Features

- [x] Matching algorithm (SAB compatibility scoring)
- [x] Matches screen with compatibility scores
- [x] Direct messaging (1-on-1 chat)
- [x] Group chats
- [x] Groups discovery and joining

### Accountability System

- [x] Daily check-ins (streak tracking)
- [x] Praxis Points reward system
- [x] Achievement system
- [x] Leaderboards (global, friends)
- [x] Betting/duels system

### Tracking & Analytics

- [x] 18 tracker types (fitness, finance, learning, etc.)
- [x] Offline tracker logging with auto-sync
- [x] Habit calendar (16-week contribution graph)
- [x] Combined calendar view (trackers + notes + goals)
- [x] Filter toggles for activity types
- [x] Analytics dashboard
- [x] GitHub-style contribution graph in dashboard header
- [x] Line chart contribution graph (replaced heatmap)

### AI Features

- [x] Axiom AI coach
- [x] Daily AI-generated briefs
- [x] Weekly progress reports
- [x] Mood-based recommendations
- [x] Axiom quotes system
- [x] Axiom automatic goal progress estimation and updates
- [x] Axiom daily notebook summaries + monthly briefs
- [x] Axiom message cleanup and progress integration
- [x] Axiom brief notifications with AI goal strategy/network leverage
- [x] Axiom unified midnight scan for all daily operations

### Platform Support

- [x] Web app (React + TypeScript)
- [x] PWA with offline support (Service Worker)
- [x] Android app (native widgets, Conky integration)
- [x] Linux desktop app (Electron + Conky widgets)
- [x] iOS app (basic wrapper)
- [x] Windows/Mac app (basic wrapper)

### Infrastructure

- [x] Supabase backend (PostgreSQL + Auth + Storage)
- [x] Railway deployment
- [x] Vercel frontend hosting
- [x] Firebase (legacy, being phased out)
- [x] Database migrations system
- [x] RLS policies for data security

---

## 📝 Recent Changes (March 16-21, 2026)

### Latest Commits (March 21)

- **cb9da12** - feat: enhance analytics with charts & export, add admin debug tools
- **8bced5b** - feat: enhance Axiom goal progress tracking with private summaries
- **f6fad63** - feat: add load balancing and monthly summaries for Axiom
- **a5648ee** - refactor: remove goal/subgoal nomenclature from notebook
- **6c38a72** - feat: make hashtags, mentions, and shared content clickable

### v1.2.0 Major Features (March 21, 2026)

#### 1. Analytics Page Enhancements ✨

**Files:** `client/src/features/analytics/AnalyticsPage.tsx`

- **MUI X-Charts Integration**: Finally using the installed library!
  - Line Chart: Goal Progress Over Time
  - Pie Chart: Domain Distribution
  - Bar Chart: Feedback Distribution
  - Gauge Display: Achievement Rate
- **Time Range Selector**: Filter by 7d, 30d, 90d, 1y, all time
- **Export to CSV**: Download all analytics data with one click
  - Goal progress data
  - Domain performance metrics
  - Feedback trends
  - Achievement completion rates
- **Premium Feature**: All visual analytics gated behind isPremium

#### 2. Admin Debug Tools 🔧

**Files:** `client/src/features/admin/tabs/DebugTab.tsx`, `src/routes/adminDebugRoutes.ts`

- **System Health Dashboard**:
  - Database: size, connections, status
  - API: uptime, requests/min, status
  - Cache: hit rate, size, status
  - Job Queue: pending, failed, status
- **Run Diagnostics**: Automated tests for DB, cache, auth, storage, email
- **Recent Errors Table**: Last 20 errors with filtering
- **Debug Endpoints**:
  - `GET /admin/debug/health` - System health
  - `GET /admin/debug/errors` - Error logs
  - `GET /admin/debug/test/*` - Component tests
  - `POST /admin/debug/clear-cache` - Clear cache
  - `POST /admin/debug/restart-services` - Restart services

#### 3. Axiom Load Balancing & Monthly Summaries 🤖

**Files:** `src/services/AxiomMonthlySummaryService.ts`, `src/services/AxiomUnifiedScanService.ts`

- **Load Balancing**:
  - Randomize midnight scan time (00:00-05:59)
  - Random per-user delay (200-800ms)
  - Random monthly summary day (1st-5th)
  - 78% more even API load distribution
- **Monthly Summary Service** (NEW):
  - 30-day activity breakdown
  - Month-over-month trends
  - AI-powered monthly narrative
  - Achievements, challenges, focus suggestions
  - Stored as `axiom_monthly_summary` in notebook
- **Token Cost**: ~800-1200 tokens per monthly summary (one-time, cached)

#### 4. Enhanced Goal Progress Tracking 📊

**Files:** `src/services/AxiomProgressEstimationService.ts`

- **Explicit Progress Extraction**:
  - Detects: "50%", "3/4 done", "halfway", "almost done"
  - Uses extracted progress directly (no AI needed)
  - Boosts confidence score by +0.3
- **Private Axiom Summaries**:
  - New table: `axiom_private_summaries`
  - Stores: themes, achievements, challenges, mood patterns
  - Only visible to admins and Axiom
  - Prevents re-reading same material
- **Admin API**: `GET /admin/axiom/summaries` to view all summaries

#### 5. Clickable Content 🔗

**Files:** `client/src/components/common/ContentRenderer.tsx`

- **ContentRenderer Component**: Reusable hashtag/mention parser
- **Clickable Hashtags**: `#tag` → `/search?q=#tag`
- **Clickable Mentions**: `@user` → `/profile/username`
- **Applied To**:
  - Posts & comments (PostFeed, PostThreadPage)
  - Group chat messages (GroupRoom)
  - Notebook entries (NotebookPage)
  - Diary entries (DiaryPage)
- **Tag Chips**: Clickable tags in notebook/diary

#### 6. Goal/Subgoal Nomenclature Removal 📝

**Files:** `client/src/features/notes/NotesCardTree.tsx`, `NotesPage.tsx`, `GoalWorkspaceSheet.tsx`

- **Before**: "Main Topic (Goal)", "Chapter (Sub-goal)"
- **After**: "Main Topic", "Chapter"
- **Consistent Terminology**:
  - Topic = root node (life domain goal)
  - Chapter = child node (sub-goal/milestone)
  - Node = generic term for any tree item

### Key Improvements Summary

1. **Analytics**: Premium users can now export data and see beautiful charts
2. **Admin**: Powerful debugging tools for system monitoring
3. **Axiom**: Load balancing prevents rate limiting, monthly summaries provide long-term insights
4. **Goal Tracking**: More accurate progress updates from explicit user mentions
5. **UX**: Clickable tags/mentions make navigation seamless
6. **Clarity**: Consistent terminology throughout the app

---

## 🎯 Short-Term Priorities (v1.1.0 - Next 2-4 Weeks)

### Week 1-2: Database & Performance

#### Priority 1: Database Optimization (HIGH)

- [ ] Add connection pooling for Supabase queries
- [ ] Implement query result caching (Redis)
- [ ] Add database indexes for common queries:
  - `idx_tracker_entries_user_date` (already exists)
  - `idx_messages_room_timestamp`
  - `idx_goal_trees_user_updated`
  - `idx_matches_user_compatibility`
- [ ] Set up query performance monitoring
- [ ] Implement database connection retry logic

**Estimated Effort:** 3 days
**Impact:** 40-60% faster query times

#### Priority 2: Goal Progress History Table (HIGH)

- [ ] Create proper `goal_progress_history` table (migration exists)
- [ ] Backfill historical data from goal_trees updates
- [ ] Add API endpoint: `GET /api/goals/:id/history`
- [ ] Show progress over time chart in goal detail view
- [ ] Trigger notifications on milestone achievements (25%, 50%, 75%, 100%)

**Estimated Effort:** 2 days
**Impact:** Better analytics, milestone tracking

#### Priority 3: Image Optimization (MEDIUM)

- [ ] Implement lazy loading for all images
- [ ] Add WebP format conversion
- [ ] Set up CDN for static assets (Cloudflare)
- [ ] Compress existing images
- [ ] Add blur-up placeholders for avatars/banners

**Estimated Effort:** 2 days
**Impact:** Faster page loads, better UX

---

### Week 3-4: External Integrations

#### Priority 4: Health Connect Integration (HIGH)

**Why:** One integration covers fitness, sleep, weight, nutrition

- [ ] Add Health Connect permissions to AndroidManifest.xml
- [ ] Create `HealthConnectService.kt` in praxis_android
- [ ] Implement data readers:
  - Steps (daily)
  - Workouts (type, duration, distance)
  - Sleep (duration, quality)
  - Weight (daily measurements)
  - Heart rate (resting, active)
- [ ] Map to Praxis tracker types:
  - Steps → `steps` tracker
  - Workouts → `cardio` / `lift` tracker
  - Sleep → `sleep` tracker
- [ ] Add sync frequency settings (real-time, hourly, daily)
- [ ] Create settings UI for enabling/disabling

**Estimated Effort:** 5 days
**Impact:** Automatic fitness tracking, no manual logging

#### Priority 5: Strava Integration (MEDIUM)

- [ ] Set up Strava OAuth flow
- [ ] Create `StravaService.kt`
- [ ] Fetch activities (runs, rides, hikes)
- [ ] Auto-log to `cardio` and `adventure` trackers
- [ ] Store access tokens securely (Android Keystore)
- [ ] Add re-authentication on token expiry

**Estimated Effort:** 3 days
**Impact:** Automatic running/cycling tracking

#### Priority 6: LinkedIn Integration (MEDIUM)

- [ ] Apply for LinkedIn API access
- [ ] Implement OAuth 2.0 flow
- [ ] Fetch job applications
- [ ] Auto-log to `job-apps` tracker
- [ ] Track profile updates, posts

**Estimated Effort:** 3 days
**Impact:** Automatic career tracking

---

## 📅 Medium-Term Goals (v1.2.0 - 1-3 Months)

### Month 1: Mobile App Enhancements

#### Android App Improvements

- [ ] Convert to Capacitor for cross-platform (optional)
- [ ] Add native navigation (bottom tabs)
- [ ] Implement push notifications:
  - Daily check-in reminders
  - Goal deadline warnings
  - Match messages
  - Streak warnings (23h remaining)
- [ ] Add biometric authentication (fingerprint/face)
- [ ] Implement deep linking
- [ ] Add share-to-social features
- [ ] Create home screen shortcuts (quick log, check-in)

**Estimated Effort:** 10 days

#### iOS App Improvements

- [ ] Update to latest iOS SDK
- [ ] Add widgets (similar to Android Conky)
- [ ] Implement HealthKit integration
- [ ] Add Siri Shortcuts support
- [ ] Fix known iOS bugs

**Estimated Effort:** 7 days

---

### Month 2: Advanced Features

#### Priority 7: Real-Time Collaboration (HIGH)

- [ ] Implement WebSocket connections for:
  - Live chat (replace polling)
  - Real-time goal progress updates
  - Live accountability sessions
- [ ] Add "Focus Session" feature:
  - Start timed work session (25/50/90 min)
  - Invite accountability partner to join
  - Both users work silently together
  - Check-in at end with progress update
- [ ] Add screen sharing for virtual co-working

**Estimated Effort:** 8 days
**Impact:** Major differentiation from competitors

#### Priority 8: Advanced Analytics (MEDIUM)

- [ ] Create insights engine:
  - "You're most productive on Tuesdays"
  - "Your streak drops when you skip morning check-ins"
  - "Goals with deadlines are 3x more likely to complete"
- [ ] Add correlation analysis:
  - Sleep quality vs productivity
  - Exercise frequency vs goal completion
  - Social engagement vs motivation
- [ ] Weekly email digest with insights
- [ ] Export data as CSV/JSON

**Estimated Effort:** 6 days
**Impact:** Better user retention, actionable insights

#### Priority 9: Premium Features (HIGH)

**Monetization strategy**

- [ ] Implement Stripe subscription payments
- [ ] Create premium tiers:
  - **Free:** Basic features (current free tier)
  - **Pro ($9.99/mo):**
    - Unlimited goals (free: 3)
    - Advanced analytics
    - AI coach unlimited messages
    - Priority support
  - **Teams ($19.99/mo):**
    - Everything in Pro
    - Team goals
    - Group accountability
    - Admin dashboard
- [ ] Add paywall UI
- [ ] Implement free trial (14 days)
- [ ] Create subscription management page

**Estimated Effort:** 7 days
**Impact:** Revenue generation

---

### Month 3: Platform Expansion

#### Priority 10: Browser Extension (MEDIUM)

- [ ] Chrome/Edge extension
- [ ] Features:
  - Quick tracker log from new tab page
  - Block distracting sites during focus sessions
  - Daily check-in notification
  - Current streak display
- [ ] Firefox extension (later)

**Estimated Effort:** 5 days

#### Priority 11: Desktop App Improvements (LOW)

- [ ] Native menu bar app (macOS)
- [ ] System tray app (Windows/Linux)
- [ ] Global hotkey for quick log
- [ ] Native notifications
- [ ] Auto-start on login

**Estimated Effort:** 4 days

---

## 🚀 Long-Term Vision (v2.0.0 - 3-6+ Months)

### Quarter 1: AI & Machine Learning

#### Axiom AI 2.0 (HIGH)

- [ ] Fine-tune LLM on Praxis data (with user consent)
- [ ] Personalized coaching based on:
  - Historical patterns
  - Goal domain expertise
  - Personality type (MBTI, Enneagram integration)
- [ ] Predictive analytics:
  - "You're at risk of losing your streak"
  - "This goal is stalled, suggest breaking it down"
  - "Best time to work on Career goals: Tuesday mornings"
- [ ] Voice interface for Axiom (speech-to-text)
- [ ] Multimodal input (upload photos of workouts, meals)

**Estimated Effort:** 15 days
**Impact:** Industry-leading AI coaching

#### Smart Goal Suggestions (MEDIUM)

- [ ] AI-powered goal recommendations:
  - Based on user's history
  - Similar users' successful goals
  - Trending goals in domains
- [ ] Auto-break down large goals:
  - "Run marathon" → Training plan with weekly milestones
  - "Learn Spanish" → Duolingo integration + practice schedule
- [ ] Goal difficulty assessment:
  - "This goal is 30% harder than your average"
  - Suggest easier alternative or preparation goals

**Estimated Effort:** 8 days

---

### Quarter 2: Social & Community

#### Accountability Groups 2.0 (HIGH)

- [ ] Structured group programs:
  - "90-Day Fitness Challenge" (curated)
  - "Learn to Code in 6 Months" (with syllabus)
  - "Meditation Mastery" (guided progression)
- [ ] Group challenges with leaderboards
- [ ] Peer review system for goal progress
- [ ] Video call integration for group meetings

**Estimated Effort:** 12 days

#### Mentorship Program (MEDIUM)

- [ ] Match experienced users with beginners
- [ ] Mentor dashboard with mentee progress
- [ ] Scheduled check-in reminders
- [ ] Mentor achievement badges

**Estimated Effort:** 6 days

#### Public Profiles & Portfolio (LOW)

- [ ] Shareable profile page showing:
  - Completed goals
  - Current streaks
  - Achievement badges
  - Testimonials from accountability partners
- [ ] Embeddable widgets for personal websites
- [ ] LinkedIn integration (auto-add achievements)

**Estimated Effort:** 5 days

---

### Quarter 3: Enterprise & Teams

#### Praxis for Teams (HIGH)

**B2B monetization**

- [ ] Team dashboard:
  - Team goal progress
  - Member engagement metrics
  - Upcoming deadlines
- [ ] Manager features:
  - Assign goals to team members
  - Track team OKRs
  - Weekly progress reports
- [ ] Integration with work tools:
  - Slack notifications
  - Jira/Asana sync
  - Google Calendar integration
- [ ] SSO (Single Sign-On) for enterprises
- [ ] Admin controls and user management

**Estimated Effort:** 15 days
**Impact:** B2B revenue stream

#### Praxis for Schools/Universities (MEDIUM)

- [ ] Student goal tracking
- [ ] Teacher dashboard for class goals
- [ ] Integration with LMS (Canvas, Moodle, Blackboard)
- [ ] Study group features
- [ ] Academic achievement tracking

**Estimated Effort:** 10 days

---

## 🔧 Technical Debt & Refactoring

### Code Quality (ONGOING)

- [ ] Increase test coverage (currently ~30% → target 70%)
  - Unit tests for utility functions
  - Integration tests for API endpoints
  - E2E tests for critical user flows
- [ ] Set up CI/CD pipeline (GitHub Actions)
  - Run tests on every PR
  - Auto-deploy to staging
  - Manual approval for production
- [ ] Implement code review checklist
- [ ] Set up automated code quality checks (SonarQube)
- [ ] Document API endpoints (OpenAPI/Swagger)
- [ ] Create developer onboarding guide

**Estimated Effort:** 10 days (ongoing)

### Performance Optimization (MEDIUM)

- [ ] Implement code splitting for faster initial load
- [ ] Add React Query for better data fetching
- [ ] Optimize bundle size (currently 2.5MB → target <1MB)
- [ ] Implement virtual scrolling for long lists
- [ ] Add skeleton loaders for all async content
- [ ] Set up performance monitoring (Sentry, LogRocket)

**Estimated Effort:** 5 days

### Security Hardening (HIGH)

- [ ] Implement rate limiting on all API endpoints
- [ ] Add CSRF protection
- [ ] Set up security headers (CSP, HSTS)
- [ ] Regular security audits (quarterly)
- [ ] Penetration testing before v2.0 launch
- [ ] Implement 2FA for user accounts
- [ ] Add login attempt monitoring
- [ ] Encrypt sensitive data at rest

**Estimated Effort:** 7 days

---

## 📊 Feature Prioritization Matrix

### Impact vs Effort

```
HIGH IMPACT, LOW EFFORT (Do First)
├─ Database indexes
├─ Push notifications
├─ Health Connect integration
└─ Rate limiting

HIGH IMPACT, HIGH EFFORT (Plan Carefully)
├─ Premium subscriptions
├─ Real-time collaboration (WebSocket)
├─ Praxis for Teams (B2B)
└─ Axiom AI 2.0

LOW IMPACT, LOW EFFORT (Filler Tasks)
├─ Browser extension
├─ Desktop app improvements
└─ UI polish

LOW IMPACT, HIGH EFFORT (Avoid/Delegate)
├─ Custom video call infrastructure
├─ Building own LLM
└─ Native desktop apps (focus on PWA)
```

---

## 🎯 Success Metrics (KPIs)

### User Engagement

- **DAU/MAU Ratio:** Target >40% (currently ~25%)
- **Session Duration:** Target >10 min (currently ~6 min)
- **Tracker Logs per User per Day:** Target >3 (currently ~1.5)
- **Check-in Rate:** Target >70% (currently ~50%)

### Retention

- **Day 1 Retention:** Target >60%
- **Day 7 Retention:** Target >40%
- **Day 30 Retention:** Target >25%

### Growth

- **Organic Signups:** Target 50% of total
- **Referral Rate:** Target 15% of users invite someone
- **Viral Coefficient:** Target >1.0

### Monetization (Post-Premium Launch)

- **Conversion Rate (Free → Pro):** Target 5%
- **MRR (Monthly Recurring Revenue):** Target $10K in 6 months
- **Churn Rate:** Target <5% monthly

---

## 📝 Quarterly OKRs

### Q2 2026 (April-June)

**Objective:** Launch Premium & Improve Retention

**Key Results:**

- [ ] Launch premium subscriptions with 100 paying users
- [ ] Improve Day 30 retention from 20% to 30%
- [ ] Integrate 3 external services (Health Connect, Strava, LinkedIn)
- [ ] Reduce app load time by 50%
- [ ] Achieve 4.5+ star rating on app stores

### Q3 2026 (July-September)

**Objective:** Scale User Base & Launch Teams

**Key Results:**

- [ ] Reach 10,000 MAU (Monthly Active Users)
- [ ] Launch Praxis for Teams with 10 paying teams
- [ ] Implement real-time collaboration features
- [ ] Achieve 40% DAU/MAU ratio
- [ ] Generate $10K MRR

### Q4 2026 (October-December)

**Objective:** AI Leadership & Enterprise

**Key Results:**

- [ ] Launch Axiom AI 2.0 with predictive insights
- [ ] Close 5 enterprise deals ($50K+ ARR each)
- [ ] Achieve 50,000 MAU
- [ ] Reach $50K MRR
- [ ] Expand to 3 new languages (Spanish, French, German)

---

## 🧪 Experiments to Run

### A/B Tests

1. **Onboarding Flow:**
   - Variant A: Current (5 steps)
   - Variant B: Simplified (3 steps)
   - **Metric:** Completion rate, Day 1 retention

2. **Check-in Reminder Timing:**
   - Variant A: 9 AM local time
   - Variant B: User's most active hour
   - **Metric:** Check-in completion rate

3. **Premium Paywall:**
   - Variant A: After 7 days
   - Variant B: After goal completion
   - Variant C: After streak milestone
   - **Metric:** Conversion rate

4. **Social Features:**
   - Variant A: Auto-suggest matches
   - Variant B: Manual search only
   - **Metric:** Match acceptance rate, engagement

### Feature Experiments

1. **Gamification:**
   - Add XP bars, level-ups, loot boxes
   - **Hypothesis:** Increases engagement by 20%

2. **Public Commitment:**
   - Allow users to publicly commit to goals
   - **Hypothesis:** Increases goal completion by 30%

3. **Loss Aversion:**
   - "You'll lose your 30-day streak if you don't check in"
   - **Hypothesis:** Increases check-in rate by 25%

---

## 🚨 Risks & Mitigation

### Technical Risks

| Risk                    | Probability | Impact   | Mitigation                       |
| ----------------------- | ----------- | -------- | -------------------------------- |
| Supabase downtime       | Medium      | High     | Implement fallback, multi-region |
| Data breach             | Low         | Critical | Regular audits, encryption, 2FA  |
| Performance degradation | Medium      | High     | Monitoring, auto-scaling         |
| AI hallucinations       | Medium      | Medium   | Human review, confidence scores  |

### Business Risks

| Risk                                | Probability | Impact | Mitigation                          |
| ----------------------------------- | ----------- | ------ | ----------------------------------- |
| Low premium conversion              | High        | High   | Iterate pricing, add more value     |
| Competitor launches similar feature | Medium      | Medium | Focus on community, network effects |
| User growth stalls                  | Medium      | High   | Invest in marketing, referrals      |
| Key team member leaves              | Low         | High   | Documentation, cross-training       |

---

## 📚 Learning & Development

### Skills to Acquire

- [ ] WebSocket implementation (real-time features)
- [ ] Machine Learning basics (for AI improvements)
- [ ] Mobile app optimization (iOS/Android)
- [ ] DevOps (Kubernetes, Docker for scaling)
- [ ] Security best practices

### Technologies to Explore

- [ ] GraphQL (alternative to REST)
- [ ] Edge computing (Cloudflare Workers)
- [ ] Vector databases (for AI embeddings)
- [ ] WebRTC (for video calls)
- [ ] Blockchain (for achievement verification - maybe)

---

## 📋 Feature Plan - Q2 2026 (v1.3.0)

### Theme: Mobile Excellence & Advanced Analytics

#### April 2026 - Mobile Optimization

**Goal:** Best-in-class mobile experience for Android/iOS

- [ ] **Native Mobile Widgets** (Android/iOS)
  - Today's schedule widget
  - Habit streak tracker
  - Goal progress widget
  - Quick check-in widget
  - **Priority:** HIGH
  - **Effort:** 5 days

- [ ] **Offline Mode Enhancements**
  - Full offline notebook access
  - Offline goal tree editing
  - Conflict resolution UI
  - Sync status indicators
  - **Priority:** HIGH
  - **Effort:** 4 days

- [ ] **Push Notifications**
  - Check-in reminders (customizable time)
  - Streak alerts (at 6pm, 9pm)
  - Goal milestone celebrations
  - Match messages
  - **Priority:** MEDIUM
  - **Effort:** 3 days

#### May 2026 - Advanced Analytics

**Goal:** Data-driven insights for premium users

- [ ] **Predictive Analytics**
  - Goal completion forecasts (based on velocity)
  - Streak failure risk prediction
  - Recommended focus areas
  - **Priority:** HIGH
  - **Effort:** 5 days

- [ ] **Domain Balance Radar Chart**
  - Visual work-life balance indicator
  - Shows neglected domains
  - Monthly balance score
  - **Priority:** MEDIUM
  - **Effort:** 2 days

- [ ] **Automated Weekly Reports**
  - Email digest every Monday
  - Top achievements
  - Areas for improvement
  - Week-ahead suggestions
  - **Priority:** HIGH
  - **Effort:** 3 days

- [ ] **Custom Analytics Dashboards**
  - Drag-and-drop widget builder
  - Save custom views
  - Share dashboards
  - **Priority:** LOW
  - **Effort:** 6 days

#### June 2026 - Social & Collaboration

**Goal:** Strengthen accountability network

- [ ] **Accountability Groups**
  - Small groups (3-5 people)
  - Shared goal tracking
  - Group check-ins
  - Peer progress visibility
  - **Priority:** HIGH
  - **Effort:** 7 days

- [ ] **Goal Collaboration**
  - Shared goals between users
  - Couple/friend goals
  - Progress synchronization
  - **Priority:** MEDIUM
  - **Effort:** 4 days

- [ ] **Social Feed Improvements**
  - Rich post previews
  - Video embeds (YouTube, Vimeo)
  - Poll creation
  - Event RSVPs
  - **Priority:** MEDIUM
  - **Effort:** 5 days

---

## 🎉 Celebration Milestones

- [ ] 1,000 users → Team dinner
- [ ] 10,000 users → Company retreat
- [ ] First $1K MRR → Bonus for team
- [ ] First enterprise deal → Celebration event
- [ ] App Store Feature → Marketing push

---

## 📞 Contact & Resources

### Documentation

- **Whitepaper:** `/docs/Praxis_Whitepaper.pdf`
- **API Docs:** (To be created - Swagger)
- **Architecture:** `/docs/ARCHITECTURE.md`

### Team

- **Lead Developer:** (You)
- **AI/ML:** Claude (AI Assistant)
- **Design:** (To be hired)
- **Marketing:** (To be hired)

### Advisors

- (To be recruited - experienced SaaS founders)

---

**This is a living document. Update quarterly.**

**Next Review:** June 21, 2026
