# Goal Domain System Rework - Maslow's Hierarchy Based

**Date:** March 18, 2026  
**Status:** Proposal for Implementation

---

## Executive Summary

The current domain system has **redundancies** and lacks scientific grounding. This proposal restructures the goal domains based on **Maslow's Hierarchy of Needs** - a proven psychological framework - while adding **Video Games** as a legitimate domain for modern life tracking.

### Current Issues

1. **Redundant Domains:**
   - `Mind & Learning` + `Spirit & Purpose` overlap significantly
   - `Craft & Career` could be split for better granularity
   - `Culture & Hobbies` is too broad

2. **Missing Modern Domains:**
   - **Video Games** - A major part of modern leisure, skill development, and social connection
   - No explicit domain for digital/gaming achievements

3. **Lack of Scientific Foundation:**
   - Current domains are intuitive but not based on established psychological frameworks
   - Maslow's hierarchy provides proven structure for human motivation

---

## Proposed New Domain System

### Based on Maslow's Hierarchy (5 Levels)

```
Level 5: Self-Transcendence (Beyond Self)
├─ 🎯 Impact & Legacy
└─ 🌟 Spirit & Purpose

Level 4: Esteem (Achievement & Recognition)
├─ 💼 Career & Craft
├─ 📈 Wealth & Assets
└─ 🎮 Gaming & Esports

Level 3: Love/Belonging (Social Connection)
├─ 👥 Friendship & Social
├─ ❤️ Romance & Intimacy
└─ 🏛️ Community & Contribution

Level 2: Safety (Security & Stability)
├─ 🏠 Environment & Home
├─ 🛡️ Health & Longevity
└─ 💰 Financial Security

Level 1: Physiological (Basic Needs)
├─ 💪 Body & Fitness
├─ 😴 Rest & Recovery
└─ 🧠 Mental Balance
```

---

## The 14 New Domains

### Level 1: Physiological Needs (Survival)

#### 1. 💪 Body & Fitness

**Replaces:** `Body & Health` (partial)

- Physical fitness, strength, athletics
- Exercise routines, sports performance
- **Trackers:** lift, cardio, steps, sports

#### 2. 😴 Rest & Recovery

**NEW** - Split from health

- Sleep optimization, rest days
- Stress management, relaxation
- **Trackers:** sleep, meditation, rest

#### 3. 🧠 Mental Balance

**Replaces:** `Mind & Learning` (partial) + `Mental Health`

- Emotional regulation, psychological resilience
- Therapy, mindfulness, mental wellness
- **Trackers:** mood, journal, meditation

---

### Level 2: Safety Needs (Security)

#### 4. 🏠 Environment & Home

**Replaces:** `Environment & Gear`

- Living space, organization, cleanliness
- Home improvement, relocation
- **Trackers:** cleaning, home projects

#### 5. 🛡️ Health & Longevity

**Replaces:** `Body & Health` (partial)

- Medical checkups, preventive care
- Nutrition, supplements, health metrics
- **Trackers:** meals, health metrics, medical appointments

#### 6. 💰 Financial Security

**NEW** - Split from investing

- Budget management, emergency fund
- Debt reduction, financial stability
- **Trackers:** budget, expenses, savings

---

### Level 3: Love/Belonging (Social)

#### 7. 👥 Friendship & Social

**Keeps:** `Friendship & Social`

- Platonic relationships, social circles
- Networking, social events
- **Trackers:** hangout, social events

#### 8. ❤️ Romance & Intimacy

**Keeps:** `Intimacy & Romance`

- Romantic relationships, dating
- Physical intimacy, emotional connection
- **Trackers:** dates, relationship check-ins

#### 9. 🏛️ Community & Contribution

**NEW** - Elevated from sub-category

- Volunteering, community service
- Religious/spiritual community participation
- **Trackers:** volunteer hours, community events

---

### Level 4: Esteem Needs (Achievement)

#### 10. 💼 Career & Craft

**Replaces:** `Craft & Career`

- Professional advancement, skill mastery
- Business building, entrepreneurship
- **Trackers:** job applications, projects, deep work

#### 11. 📈 Wealth & Assets

**Replaces:** `Money & Assets` + `Investing`

- Investment growth, wealth building
- Asset acquisition, passive income
- **Trackers:** investments, portfolio value, passive income

#### 12. 🎮 Gaming & Esports

**NEW** - Modern addition

- Video game achievements, skill progression
- Esports competition, streaming
- Game completion, collection building
- **Trackers:** gaming sessions, achievements, rank progression

---

### Level 5: Self-Transcendence (Beyond Self)

#### 13. 🎯 Impact & Legacy

**NEW** - Split from personal goals

- Making a difference, leaving a mark
- Mentoring, teaching, influencing others
- **Trackers:** people helped, content created, students mentored

#### 14. 🌟 Spirit & Purpose

**Keeps:** `Spirit & Purpose` (refocused)

- Life meaning, existential exploration
- Philosophical development, personal values
- **Trackers:** journal, reflection, meditation

---

## Why Add Video Games as a Domain?

### Cultural Significance

- **$200B+ industry** - Larger than movies and music combined
- **3+ billion gamers worldwide** - Majority of global population
- **Legitimate skill development** - Problem-solving, reflexes, strategy, teamwork

### Common Gaming Goals

1. **Achievement Hunting** - 100% completion, platinum trophies
2. **Skill Progression** - Rank climbing in competitive games (LoL, CS:GO, Valorant)
3. **Content Creation** - Streaming, YouTube, building audience
4. **Esports Competition** - Tournament participation, team play
5. **Collection Building** - Game libraries, rare items, memorabilia
6. **Social Gaming** - Guild leadership, community building
7. **Speedrunning** - World record attempts, personal bests
8. **Creative Gaming** - Minecraft builds, game modding

### Integration with Existing Features

- **Trackers:** gaming hours, achievements unlocked, rank progression
- **Events:** Gaming tournaments, launch parties, LAN events
- **Challenges:** "Complete Dark Souls no-hit run", "Reach Diamond rank"
- **Matches:** Find gaming buddies, accountability partners for grind

### Addressing Concerns

> "Isn't gaming just a waste of time?"

**Response:** Gaming is what you make of it:

- **Passive consumption** → Entertainment (like TV)
- **Active engagement** → Skill development, social connection, achievement
- **Professional pursuit** → Career (streaming, esports, content creation)

The domain allows users to **intentionally track** gaming goals rather than feeling guilty about "unproductive" time.

---

## Migration Strategy

### Database Changes

```sql
-- 1. Create new domain mapping
CREATE TYPE new_domain AS ENUM (
  -- Level 1: Physiological
  'body_fitness',
  'rest_recovery',
  'mental_balance',

  -- Level 2: Safety
  'environment_home',
  'health_longevity',
  'financial_security',

  -- Level 3: Love/Belonging
  'friendship_social',
  'romance_intimacy',
  'community_contribution',

  -- Level 4: Esteem
  'career_craft',
  'wealth_assets',
  'gaming_esports',

  -- Level 5: Self-Transcendence
  'impact_legacy',
  'spirit_purpose'
);

-- 2. Add new column (keep old for migration)
ALTER TABLE goal_trees ADD COLUMN new_domain new_domain;

-- 3. Migration mapping
UPDATE goal_trees SET new_domain = CASE
  -- Level 1
  WHEN domain IN ('Fitness', 'Body & Health') THEN 'body_fitness'
  WHEN domain = 'Mental Health' THEN 'mental_balance'

  -- Level 2
  WHEN domain = 'Environment & Gear' THEN 'environment_home'
  WHEN domain IN ('Investing / Financial Growth', 'Money & Assets') THEN 'financial_security'

  -- Level 3
  WHEN domain = 'Friendship / Social Engagement' THEN 'friendship_social'
  WHEN domain = 'Intimacy / Romantic Exploration' THEN 'romance_intimacy'

  -- Level 4
  WHEN domain = 'Career' THEN 'career_craft'
  WHEN domain IN ('Investing / Financial Growth', 'Money & Assets') THEN 'wealth_assets'

  -- Level 5
  WHEN domain = 'Philosophical Development' THEN 'spirit_purpose'
  WHEN domain = 'Personal Goals' THEN 'impact_legacy'

  -- Default
  ELSE 'career_craft'
END;

-- 4. After verification, drop old column and rename
ALTER TABLE goal_trees DROP COLUMN domain;
ALTER TABLE goal_trees RENAME COLUMN new_domain TO domain;
```

### Frontend Changes

1. **Update `client/src/types/Domain.ts`**
   - Replace `PRAXIS_DOMAINS` array with new 14 domains
   - Update color scheme (use Maslow level colors)

2. **Update `client/src/models/Domain.ts`**
   - Replace enum with new domain values

3. **Update all domain references**
   - Matches page filters
   - Places page filters
   - Events page filters
   - Tracker auto-assignment logic

### Color Scheme by Maslow Level

```typescript
const MASLOW_LEVEL_COLORS = {
  // Level 1: Physiological (Red/Orange - Survival)
  body_fitness: "#EF4444",
  rest_recovery: "#F97316",
  mental_balance: "#FB923C",

  // Level 2: Safety (Blue/Green - Stability)
  environment_home: "#10B981",
  health_longevity: "#3B82F6",
  financial_security: "#6366F1",

  // Level 3: Love/Belonging (Pink/Purple - Connection)
  friendship_social: "#EC4899",
  romance_intimacy: "#F472B6",
  community_contribution: "#A78BFA",

  // Level 4: Esteem (Gold/Yellow - Achievement)
  career_craft: "#F59E0B",
  wealth_assets: "#FBBF24",
  gaming_esports: "#8B5CF6",

  // Level 5: Self-Transcendence (Purple/White - Transcendence)
  impact_legacy: "#8B5CF6",
  spirit_purpose: "#C4B5FD",
};
```

---

## Benefits of This Rework

### 1. **Scientific Foundation**

- Based on proven psychological framework (Maslow)
- Users understand the "why" behind domain structure
- Clear progression from basic needs to self-actualization

### 2. **Better Granularity**

- Split overly broad domains (Health → Body + Health + Mental)
- Focused domains = clearer goal setting
- Reduced cognitive load when categorizing goals

### 3. **Modern Relevance**

- Gaming recognized as legitimate pursuit
- Reflects how modern users actually spend time
- Attracts younger demographic

### 4. **Improved Analytics**

- Track balance across Maslow levels
- Identify neglected life areas
- "Are you focusing only on Level 4 while ignoring Level 1?"

### 5. **Better AI Coaching**

- Axiom can give level-specific advice
- "You're neglecting physiological needs"
- "Great balance across all levels this month!"

---

## Implementation Priority

### Phase 1: Core Changes (Week 1)

- [ ] Update domain enum and types
- [ ] Create database migration
- [ ] Update frontend domain selectors

### Phase 2: Tracker Integration (Week 2)

- [ ] Update tracker auto-assignment
- [ ] Add gaming-specific trackers
- [ ] Test tracker-domain mapping

### Phase 3: UI/UX Updates (Week 3)

- [ ] Update all filter dropdowns
- [ ] Update domain icons and colors
- [ ] Add Maslow level visualization

### Phase 4: Analytics & AI (Week 4)

- [ ] Add Maslow level balance analytics
- [ ] Update Axiom to reference levels
- [ ] Add "life balance" insights

---

## Example User Goal Trees

### Example 1: Gamer/Streamer

```
🎮 Gaming & Esports (Level 4)
├─ Reach Diamond in Valorant
│  ├─ Improve aim (K/D > 1.5)
│  └─ Learn 3 new agents
├─ Grow Twitch channel
│  ├─ Stream 5x/week
│  └─ Reach 1000 followers
└─ Complete all FromSoftware games
   ├─ Elden Ring (PLatinum)
   └─ Dark Souls 3 (NG+7)

💪 Body & Fitness (Level 1)
├─ Counteract sitting all day
│  ├─ Daily stretching routine
│  └─ Gym 3x/week
└─ Improve posture

💼 Career & Craft (Level 4)
└─ Transition to full-time streaming
   ├─ Build backup income ($3k/mo)
   └─ Create content pipeline
```

### Example 2: Work-Life Balance Seeker

```
Level 1: Physiological ✅ 85%
├─ 💪 Body & Fitness: 90%
├─ 😴 Rest & Recovery: 75%
└─ 🧠 Mental Balance: 90%

Level 2: Safety ✅ 80%
├─ 🏠 Environment & Home: 70%
├─ 🛡️ Health & Longevity: 85%
└─ 💰 Financial Security: 85%

Level 3: Love/Belonging ⚠️ 45%
├─ 👥 Friendship & Social: 40%
├─ ❤️ Romance & Intimacy: 60%
└─ 🏛️ Community & Contribution: 35%

Level 4: Esteem ✅ 75%
├─ 💼 Career & Craft: 80%
├─ 📈 Wealth & Assets: 70%
└─ 🎮 Gaming & Esports: 75%

Level 5: Self-Transcendence ⚠️ 30%
├─ 🎯 Impact & Legacy: 25%
└─ 🌟 Spirit & Purpose: 35%

🔍 Axiom Insight: "You're excelling at Levels 1-2, but neglecting social connection (Level 3)
   and meaning (Level 5). Consider joining a local community group or volunteering."
```

---

## Tracker Auto-Assignment by Domain

```typescript
const DOMAIN_TRACKERS = {
  // Level 1
  body_fitness: ["lift", "cardio", "steps", "sports"],
  rest_recovery: ["sleep", "meditation", "rest_day"],
  mental_balance: ["mood", "journal", "meditation", "therapy"],

  // Level 2
  environment_home: ["cleaning", "home_projects", "organization"],
  health_longevity: ["meals", "water", "supplements", "medical"],
  financial_security: ["budget", "expenses", "savings", "debt"],

  // Level 3
  friendship_social: ["hangout", "social_events", "networking"],
  romance_intimacy: ["dates", "relationship_checkin"],
  community_contribution: ["volunteer", "community_events"],

  // Level 4
  career_craft: ["deep_work", "job_apps", "projects", "learning"],
  wealth_assets: ["investments", "portfolio", "passive_income"],
  gaming_esports: ["gaming", "achievements", "rank", "streaming"],

  // Level 5
  impact_legacy: ["mentoring", "teaching", "content_creation"],
  spirit_purpose: ["journal", "reflection", "meditation", "reading"],
};
```

---

## Conclusion

This rework:
✅ **Eliminates redundancies** (9 → 14 focused domains)  
✅ **Adds scientific foundation** (Maslow's hierarchy)  
✅ **Includes modern pursuits** (Video games as legitimate domain)  
✅ **Improves user experience** (Clearer categorization, better insights)  
✅ **Enables advanced analytics** (Life balance across levels)

**Recommendation:** Proceed with implementation, starting with database migration and type updates.

---

_Prepared by: AI Code Analysis_  
_Date: March 18, 2026_
