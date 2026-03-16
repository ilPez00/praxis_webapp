# Praxis Analytics Dashboard — Google Sheet Template

**Purpose:** Track daily metrics without expensive tools. Copy this structure into a Google Sheet.

---

## Sheet 1: "Daily Metrics"

### Column Structure

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Date | Day # | Total Users | Active Users (DAU) | New Signups | Churned Users | Check-ins Logged | Mutual Streaks Active | Pro Users | MRR (€) | Annual Plans Sold | Notes |

### Example Rows

```
| Date       | Day # | Total Users | DAU | New Signups | Churned | Check-ins | Streaks | Pro Users | MRR (€) | Annual | Notes                    |
|------------|-------|-------------|-----|-------------|---------|-----------|---------|-----------|---------|--------|--------------------------|
| 2026-03-16 |   1   |     10      |  8  |      10     |    0    |     23    |    5    |     0     |    0    |   0    | Launch day               |
| 2026-03-17 |   2   |     15      | 12  |       5     |    0    |     34    |    8    |     0     |    0    |   0    | Twitter thread posted    |
| 2026-03-18 |   3   |     23      | 18  |       8     |    0    |     51    |   12    |     0     |    0    |   0    | Reddit post went small   |
| 2026-03-19 |   4   |     28      | 19  |       5     |    0    |     47    |   14    |     0     |    0    |   0    |                          |
| 2026-03-20 |   5   |     35      | 25  |       7     |    0    |     68    |   18    |     0     |    0    |   0    | First partnership (IT)   |
| 2026-03-21 |   6   |     42      | 28  |       7     |    0    |     72    |   22    |     0     |    0    |   0    |                          |
| 2026-03-22 |   7   |     50      | 35  |       8     |    0    |     89    |   28    |     0     |    0    |   0    | Week 1 complete          |
| 2026-03-23 |   8   |     53      | 38  |       3     |    0    |     94    |   30    |     2     |   20    |   0    | First Pro conversions!   |
```

### Formulas to Add

**Row 52 (Week 1 Totals):**
- `C52`: `=SUM(C2:C8)` — Total user-weeks
- `D52`: `=AVERAGE(D2:D8)` — Avg DAU
- `G52`: `=SUM(G2:G8)` — Total check-ins

**Calculated Metrics (add in columns M-Q):**

| M | N | O | P | Q |
|---|---|---|---|---|
| DAU/MAU Ratio | Week 1 Retention | Pro Conversion % | ARPU (€) | Burn Rate (€) |
| `=D2/C2` | `=D8/C2` | `=I2/C2` | `=J2/C2` | `=-K2` |

---

## Sheet 2: "User Cohorts"

### Purpose: Track retention by signup week

### Column Structure

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Cohort Week | Users at Start | Day 1 Active | Day 3 Active | Day 7 Active | Day 14 Active | Day 30 Active | Retention D7 | Retention D30 |

### Example Rows

```
| Cohort Week | Start | D1  | D3  | D7  | D14 | D30 | Ret D7 | Ret D30 |
|-------------|-------|-----|-----|-----|-----|-----|--------|---------|
| Mar 16-22   |  50   | 45  | 38  | 35  |  -- |  -- |  70%   |   --    |
| Mar 23-29   |  75   | 68  | 52  |  -- |  -- |  -- |   --   |   --    |
| Mar 30-05   |  100  | 89  |  -- |  -- |  -- |  -- |   --   |   --    |
```

### Formulas

**Retention D7 (Column H):**
```
H2: =E2/B2
Format as percentage
```

**Retention D30 (Column I):**
```
I2: =G2/B2
Format as percentage
```

**Conditional Formatting:**
- Green if > 60%
- Yellow if 40-60%
- Red if < 40%

---

## Sheet 3: "Revenue Tracker"

### Purpose: Track MRR, upgrades, downgrades

### Column Structure

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Date | User Email | Plan (Free/Pro/Elite) | Billing (Monthly/Annual) | Amount (€) | Transaction Type | Stripe ID | MRR Impact | Notes |

### Example Rows

```
| Date       | User Email        | Plan  | Billing | Amount | Type            | Stripe ID          | MRR Impact | Notes              |
|------------|-------------------|-------|---------|--------|-----------------|--------------------|------------|--------------------|
| 2026-03-23 | marco@email.com   | Pro   | Monthly |  9.99  | subscription    | sub_1QXabc123      |    +9.99   | First Pro user     |
| 2026-03-23 | alice@email.com   | Pro   | Monthly |  9.99  | subscription    | sub_1QXdef456      |    +9.99   |                    |
| 2026-03-24 | luca@email.com    | Pro   | Annual  | 79.99  | subscription    | sub_1QXghi789      |    +6.67   | Annual = /12 for MRR |
| 2026-03-25 | giulia@email.com  | Elite | Monthly | 24.99  | subscription    | sub_1QXjkl012      |   +24.99   |                    |
| 2026-03-28 | marco@email.com   | Free  | Monthly |  0.00  | downgrade       | sub_1QXabc123      |    -9.99   | Churned            |
```

### Formulas

**Total MRR (cell J2):**
```
J2: =SUM(H:H)
```

**Monthly Recurring Revenue Trend (create chart):**
- X-axis: Date
- Y-axis: Cumulative MRR
- Chart type: Line chart

**Annual Revenue Equivalent (cell K2):**
```
K2: =J2 * 12
```

---

## Sheet 4: "Feedback Log"

### Purpose: Track user complaints and feature requests

### Column Structure

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Date | User | Category | Feedback | Severity (1-5) | Status | Action Taken |

### Categories (Dropdown)
- Bug
- Feature Request
- UX Friction
- Pricing Concern
- Onboarding Issue
- Other

### Severity Scale
- 1 = Nice to have
- 2 = Minor annoyance
- 3 = Almost quit
- 4 = Major blocker
- 5 = Critical bug

### Example Rows

```
| Date       | User        | Category      | Feedback                          | Severity | Status    | Action Taken           |
|------------|-------------|---------------|-----------------------------------|----------|-----------|------------------------|
| 2026-03-17 | marco@email | UX Friction   | "Too many clicks to check in"     |    3     | Done      | Reduced to 1-tap       |
| 2026-03-18 | alice@email | Feature Req   | "Want iOS app"                    |    2     | Backlog   |                        |
| 2026-03-19 | luca@email  | Bug           | "Streak didn't update"            |    4     | Done      | Fixed timezone bug     |
| 2026-03-20 | giulia@email| Pricing       | "€10/month too expensive"         |    2     | Ignored   | Price is correct       |
| 2026-03-21 | stefano@email| Onboarding   | "Didn't know how to find partner" |    4     | Done      | Added tutorial modal   |
```

### Pivot Table (create new sheet)

**Feedback by Category:**
- Rows: Category
- Values: COUNT of Feedback
- Sort: Descending

**Feedback by Severity:**
- Rows: Severity
- Values: COUNT of Feedback
- Filter: Severity >= 3 only

---

## Sheet 5: "Outreach Tracker"

### Purpose: Track DMs, emails, partnership outreach

### Column Structure

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Date | Platform | Contact Name | Handle/Email | Message Sent | Response | Status | Notes |

### Platforms (Dropdown)
- Twitter DM
- Instagram DM
- LinkedIn Message
- Email
- Discord DM
- Reddit DM
- WhatsApp

### Status (Dropdown)
- Sent
- Replied
- Signed Up
- Not Interested
- Ghosted
- Follow-up Needed

### Example Rows

```
| Date       | Platform    | Contact Name | Handle           | Message Sent | Response  | Status    | Notes              |
|------------|-------------|--------------|------------------|--------------|-----------|-----------|--------------------|
| 2026-03-17 | Twitter DM  | Marco Rossi  | @marcorossi_fit  | Yes          | Yes       | Signed Up | Fitness influencer   |
| 2026-03-17 | Instagram DM| Alice Bianchi| @alice_bianchi   | Yes          | No        | Ghosted   | 5k followers         |
| 2026-03-18 | LinkedIn    | Luca Verdi   | luca.verdi@email | Yes          | Yes       | Follow-up | Wants demo call    |
| 2026-03-18 | Email       | Giulia Neri  | giulia@email.com | Yes          | Yes       | Signed Up | Referred 2 friends   |
| 2026-03-19 | Twitter DM  | Stefano Blu  | @stefanoblu      | Yes          | No        | Not Int.  | "Already use Notion" |
```

### Formulas

**Conversion Rate (cell I2):**
```
I2: =COUNTIF(G:G, "Signed Up") / COUNTA(G:G)
Format as percentage
```

**Response Rate (cell J2):**
```
J2: =COUNTIF(F:F, "<>No") / COUNTA(F:F)
Format as percentage
```

---

## Sheet 6: "KPI Dashboard" (Summary View)

### Purpose: One-glance view of all key metrics

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRAXIS KPI DASHBOARD                         │
│                    Last Updated: =TODAY()                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TOTAL USERS              ACTIVE USERS (DAU)                    │
│  =MAX('Daily Metrics'!C:C)  =AVERAGE('Daily Metrics'!D:D)      │
│                                                                 │
│  DAU/MAU RATIO            WEEK 1 RETENTION                      │
│  =D2/C2                   ='User Cohorts'!H2                    │
│                                                                 │
│  TOTAL MRR (€)            PRO USERS                             │
│  =SUM('Revenue Tracker'!H:H)  =COUNTIF('Revenue Tracker'!C:C,"Pro") │
│                                                                 │
│  PRO CONVERSION %         AVG REVENUE PER USER                  │
│  =I2/C2                   =J2/C2                                │
│                                                                 │
│  OUTREACH CONVERSION %    FEEDBACK ITEMS (SEVERITY >=3)         │
│  ='Outreach Tracker'!I2   =COUNTIF('Feedback Log'!E:E,">=3")   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MRR TREND (Last 30 Days)                                       │
│  [Insert Line Chart from Revenue Tracker data]                  │
│                                                                 │
│  USER GROWTH (Last 30 Days)                                     │
│  [Insert Line Chart from Daily Metrics data]                    │
│                                                                 │
│  FEEDBACK BY CATEGORY                                           │
│  [Insert Pie Chart from Feedback Log data]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Conditional Formatting Rules

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| DAU/MAU | > 45% | 25-45% | < 25% |
| Week 1 Retention | > 70% | 50-70% | < 50% |
| Pro Conversion | > 10% | 5-10% | < 5% |
| MRR Growth | > 20%/week | 10-20%/week | < 10%/week |

---

## How to Use This Dashboard

### Daily (15 minutes)

1. **Morning (9:00):**
   - Open Stripe Dashboard
   - Copy yesterday's metrics into "Daily Metrics" sheet
   - Update "Revenue Tracker" with new subscriptions

2. **Evening (17:00):**
   - Log all outreach from today in "Outreach Tracker"
   - Add any user feedback to "Feedback Log"
   - Check KPI Dashboard for trends

### Weekly (1 hour, Sunday)

1. **Review Cohorts:**
   - Update "User Cohorts" with Day 7, 14, 30 data
   - Calculate retention rates
   - Identify drop-off points

2. **Analyze Feedback:**
   - Create pivot table of feedback by category
   - Identify top 3 complaints
   - Plan fixes for next week

3. **Update Projections:**
   - If MRR growth < 10%/week → adjust strategy
   - If retention < 50% → fix core loop before acquiring more users

### Monthly (2 hours, Last day of month)

1. **Full Review:**
   - Export all sheets to PDF (archive)
   - Compare actuals vs. projections
   - Decide: Double down, pivot, or kill

2. **Public Update:**
   - Create Twitter/LinkedIn post with key metrics
   - Be transparent about failures
   - Build in public = more supporters

---

## Google Sheet Setup Instructions

1. **Create New Sheet:**
   - Go to sheets.google.com
   - Click "+ Blank"
   - Name it "Praxis Analytics Dashboard"

2. **Create Tabs:**
   - Click "+" at bottom 6 times
   - Rename tabs: "Daily Metrics", "User Cohorts", "Revenue Tracker", "Feedback Log", "Outreach Tracker", "KPI Dashboard"

3. **Copy Column Headers:**
   - Copy the column structures from above into each tab
   - Row 1 = headers (bold, background color)

4. **Add Formulas:**
   - Copy formulas from above into specified cells
   - Test with sample data

5. **Create Charts:**
   - Select data range
   - Insert → Chart
   - Choose line chart for trends, pie chart for categories

6. **Set Up Conditional Formatting:**
   - Format → Conditional formatting
   - Add rules from table above
   - Apply to relevant cells

7. **Share Settings:**
   - Click "Share" (top right)
   - Add your email (backup)
   - Set to "Anyone with link can view" (if building in public)

---

## Quick Start: First Week Data Entry

**Day 1 (Launch Day):**
```
Date: 2026-03-16
Day #: 1
Total Users: 10
DAU: 8
New Signups: 10
Churned: 0
Check-ins: 23
Mutual Streaks: 5
Pro Users: 0
MRR: €0
Annual Plans: 0
Notes: "Launch day. Twitter thread posted at 20:00"
```

**Day 2:**
```
Date: 2026-03-17
Day #: 2
Total Users: 15
DAU: 12
New Signups: 5
Churned: 0
Check-ins: 34
Mutual Streaks: 8
Pro Users: 0
MRR: €0
Annual Plans: 0
Notes: "Reddit post r/getdisciplined. 3 partnerships initiated"
```

**Continue daily...**

---

## Pro Tips

1. **Automate What You Can:**
   - Use Stripe → Google Sheets integration (Zapier free tier)
   - Auto-import new subscriptions into "Revenue Tracker"

2. **Mobile Access:**
   - Install Google Sheets app on phone
   - Quick data entry between library sessions

3. **Backup Daily:**
   - File → Download → Excel (.xlsx)
   - Save to Google Drive folder "Praxis Analytics Backup"

4. **Build in Public:**
   - Share KPI Dashboard screenshot on Twitter every Friday
   - Transparency = more supporters = more users

---

**Next Step:** Copy this template into Google Sheets TODAY before you forget. Takes 20 minutes.
