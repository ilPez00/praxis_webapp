# What Axiom Reads — Data Access Guide

**Last Updated:** 2026-03-15  
**Version:** 2.0

---

## Quick Reference

| Data Type | Does Axiom Read It? | Why / Why Not |
|-----------|---------------------|---------------|
| **Tracker entries** | ✅ YES | Detect trends, suggest interventions |
| **Note titles** | ✅ YES | Extract themes and interests |
| **Public posts** | ✅ YES | Understand social engagement |
| **Goal names/domains** | ✅ YES | Recommend matches, events, places |
| **Check-in timestamps** | ✅ YES | Activity patterns, consistency |
| **Direct Messages** | ❌ NO | Private conversations |
| **DM room content** | ❌ NO | Confidential 1:1 discussions |
| **Private journal entries** | ❌ NO | Personal reflections |
| **Password fields** | ❌ NO | Sensitive data |
| **Health values** (specific) | ⚠️ TRENDS ONLY | Only improving/declining, not values |

---

## What Axiom Reads (And Why)

### 1. Tracker Data ✅

**What's Read:**
- Tracker names
- Entry values (numeric)
- Entry timestamps
- Week-over-week changes

**How It's Used:**
```
User's "Sleep Hours" tracker:
  - This week avg: 6.2 hrs
  - Last week avg: 7.1 hrs
  - Trend: -13% (declining)

Axiom Recommendation:
  "Some metrics are down — that's okay. 
   Focus on recovery AND one small win."
   
Resource suggestion:
  "Consistency: Small daily actions beat sporadic intensity"
```

**Privacy:**
- Specific values shown only to user
- Trends used for recommendations
- Never shared with other users

---

### 2. Notes ✅

**What's Read:**
- Note titles (keyword extraction)
- Note frequency (how often they write)
- Common themes across titles

**How It's Used:**
```
User's recent note titles:
  - "Career transition thoughts"
  - "Learning Spanish — resources"
  - "Career: what really matters?"

Extracted themes: ["career", "learning", "spanish"]

Axiom Message:
  "You have many interests — that's your strength.
   Focus on career today."
   
Resource suggestion:
  "Career: You've been reflecting on this — 
   what action does it suggest?"
```

**Privacy:**
- Only titles analyzed, not full content
- Keywords used for topic suggestions
- Note content never shown to others

---

### 3. Public Posts ✅

**What's Read:**
- Post count per week
- Topics (if tagged/categorized)
- Engagement level

**How It's Used:**
```
User's activity:
  - 3 public posts this week
  - Topics: fitness, nutrition
  - Engagement: high (many responses)

Axiom Recommendation:
  "Your connections fuel you.
   Share your progress with your network today."
```

**Privacy:**
- Only public posts analyzed
- Private posts ignored
- Used to gauge social engagement style

---

### 4. Goal Trees ✅

**What's Read:**
- Goal names
- Goal domains (Fitness, Career, etc.)
- Progress percentages
- Completion status
- Update timestamps

**How It's Used:**
```
User's goals:
  - "Run 5K" (Fitness, 75% complete)
  - "Learn Python" (Career, 30% complete) ← most updated this week
  - "Read 12 books" (Personal, 50% complete)

Current focus: "Learn Python" (most updated)
Top domains: ["Fitness", "Career", "Personal"]

Axiom Message:
  "You excel at finishing what you start.
   Keep advancing 'Learn Python' today."
   
Match recommendation:
  Find users with "Career" domain goals
```

**Privacy:**
- Goal names visible to matches anyway
- Domain used for matching algorithm
- Progress used for recommendations

---

### 5. Check-in Data ✅

**What's Read:**
- Check-in timestamps
- Streak count
- Consistency (time of day)

**How It's Used:**
```
User's pattern:
  - Streak: 14 days
  - Typical check-in: 7:30 AM
  - Consistency score: 85/100

Axiom Message (streak_driven style):
  "Your 14-day streak proves your commitment.
   Protect it."
```

**Privacy:**
- Timestamps only, no location data
- Used for activity scoring
- Never shared in detail

---

### 6. Social Data ✅

**What's Read:**
- Match count
- Honor given/received
- Interaction frequency

**How It's Used:**
```
User's social pattern:
  - 5 matches
  - 12 honors given this week
  - 8 honors received
  - Social score: 72/100

Archetype: "Socializer"

Axiom Message:
  "Your connections fuel you.
   Reach out to someone in your network today."
```

**Privacy:**
- Counts only, not message content
- Used for social archetype classification
- Never exposes specific interactions

---

## What Axiom Does NOT Read

### 1. Direct Messages ❌

**Why Not:**
- Private conversations between users
- Protected by expectation of confidentiality
- Not relevant for goal recommendations

**What Happens Instead:**
- Message count tracked (for social score)
- Response timing analyzed (for engagement)
- Content never accessed

---

### 2. Private Journal Entries ❌

**Why Not:**
- Personal reflections
- May contain sensitive information
- User expectation of privacy

**What Happens Instead:**
- Journal completion tracked (boolean)
- Entry frequency counted
- Content never analyzed

---

### 3. Health Data (Specific Values) ⚠️

**Why Limited:**
- HIPAA compliance considerations
- User privacy expectations
- Potential for harm if misused

**What's Analyzed:**
- Trend direction only (improving/declining/stable)
- Week-over-week percentage change
- Consistency patterns

**Example:**
```
✅ READ: "Sleep tracker is declining 13%"
❌ NOT READ: "User slept 5.2 hours last night"

✅ READ: "Weight trending down 2%"
❌ NOT READ: "User weighs 180 lbs"
```

---

## How Recommendations Work

### Place Recommendations

```
1. Read user's goal domains
   → ["Fitness", "Health", "Career"]

2. Read user's city (from profile)
   → "Milan"

3. Query places table:
   SELECT * FROM places
   WHERE city = 'Milan'
   AND (tags CONTAINS 'Fitness' OR 'Health' OR 'Career')
   ORDER BY relevance

4. Recommend top match:
   → "Biblioteca degli Alberi (quiet workspace)"
```

---

### Event Recommendations

```
1. Read user's goal domains
   → ["Running", "Fitness"]

2. Read user's city
   → "Milan"

3. Query events table:
   SELECT * FROM events
   WHERE city = 'Milan'
   AND event_date > NOW()
   AND (tags CONTAINS 'Running' OR 'Fitness')
   ORDER BY date ASC

4. Recommend soonest relevant event:
   → "Milano Running Festival — March 22"
```

---

### Match Recommendations

```
1. Read user's goal domains
   → ["Career", "Entrepreneurship"]

2. Query other users with overlapping domains:
   SELECT users, overlap_score
   WHERE domains OVERLAP ['Career', 'Entrepreneurship']
   ORDER BY score DESC
   LIMIT 5

3. Recommend top matches:
   → "Marco — also building a startup"
   → "Sarah — career transition coach"
```

---

### Routine Suggestions

```
1. Read user's motivation style
   → "streak_driven"

2. Read user's typical session times
   → Most active: 7-9 AM

3. Generate routine:
   Morning (7-9 AM): "Check in to maintain your streak"
   Afternoon: "One focused action on your top goal"
   Evening: "Reflect on today's win"
```

---

### Task Estimation & Critique

```
1. Read user's tracker trends
   → "Deep Work" tracker: 45 min avg, declining

2. Read user's goal progress
   → "Learn Python": 30% complete, slow progress

3. Generate critique:
   "Your deep work sessions are declining.
    For 'Learn Python', try:
    - 25-min Pomodoro sessions (not 45)
    - Daily consistency over intensity
    - Track completion, not hours"
```

---

## Data Flow Diagram

```
User Data Sources
    │
    ├─→ Trackers ─────────────┐
    ├─→ Notes ────────────────┤
    ├─→ Public Posts ─────────┤
    ├─→ Goals ────────────────┤
    ├─→ Check-ins ────────────┤
    ├─→ Social (counts only) ─┤
    │                         │
    └─→ [EngagementMetricService]
            │
            ├─→ Calculate metrics
            ├─→ Extract themes
            ├─→ Identify trends
            └─→ Build context
                    │
                    ↓
            [AxiomScanService]
                    │
                    ├─→ Pick archetype
                    ├─→ Pick motivation style
                    ├─→ Identify risks
                    └─→ Generate brief
                            │
                            ↓
                    Morning Brief UI
```

---

## Privacy Controls

### User Settings

Users can control what Axiom reads:

```
Settings → Privacy → Axiom Data Access

[✓] Use tracker data for recommendations
[✓] Use note titles for personalization
[✓] Use public posts for suggestions
[✓] Use goal data for matching
[ ] Use private journal entries (DISABLED)
[ ] Use DM conversations (DISABLED - never available)
```

### Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| Engagement metrics | 24 hours (cached) |
| Tracker trends | 30 days |
| Note themes | 7 days |
| Goal data | Real-time |
| Check-in history | Unlimited (user data) |

---

## Security Measures

### Access Control

- Axiom service uses read-only Supabase key
- No write access to user data
- Rate limited to prevent abuse

### Data Isolation

- Each user's metrics calculated independently
- No cross-user data leakage
- Aggregated data anonymized

### Audit Logging

```typescript
logger.info(`[AxiomScan] Generated brief for user ${userId}`, {
  archetype: metrics.archetype,
  dataSourcesUsed: ['trackers', 'goals', 'notes'],
  recommendationsCount: resources.length,
});
```

---

## Compliance

### GDPR

- ✅ Right to access: Users can request their metrics
- ✅ Right to deletion: Metrics deleted on account deletion
- ✅ Data minimization: Only necessary data read

### CCPA

- ✅ No data selling
- ✅ Opt-out available (disable all Axiom features)
- ✅ Transparency: This document explains what's read

---

## Future Considerations

### Planned Enhancements

1. **Granular Controls**
   - Per-tracker opt-out
   - Per-note tagging (private/public)

2. **Local Processing**
   - Calculate metrics on-device
   - Send only aggregated insights to server

3. **Differential Privacy**
   - Add noise to aggregate statistics
   - Prevent individual identification

---

**Questions?** See `docs/HOW_PRAXIS_WORKS.md` for system overview.
