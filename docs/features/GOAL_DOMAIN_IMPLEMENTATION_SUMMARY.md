# Goal Domain System - Implementation Summary

**Date:** March 18, 2026  
**Status:** Ready for Deployment  
**Based on:** Maslow's Hierarchy of Needs

---

## What Changed

### ✅ Old System (9 Domains - Redundant, No Scientific Basis)

```
- Body & Health (too broad)
- Mind & Learning (overlaps with Spirit & Purpose)
- Craft & Career (could be split)
- Money & Assets (overlaps with Investing)
- Environment & Gear
- Spirit & Purpose
- Culture / Hobbies / Creative Pursuits (too broad)
- Intimacy / Romantic Exploration
- Friendship / Social Engagement
```

### ✅ New System (14 Domains - Maslow-Based, Scientific)

**Level 1: Physiological Needs (Survival) - 3 domains**

- 💪 Body & Fitness
- 😴 Rest & Recovery (NEW - split from health)
- 🧠 Mental Balance (NEW - combines mental health + balance)

**Level 2: Safety Needs (Security) - 3 domains**

- 🏠 Environment & Home
- 🛡️ Health & Longevity (NEW - split from fitness)
- 💰 Financial Security (NEW - split from investing)

**Level 3: Love/Belonging (Social) - 3 domains**

- 👥 Friendship & Social
- ❤️ Romance & Intimacy
- 🏛️ Community & Contribution (NEW - elevated)

**Level 4: Esteem (Achievement) - 3 domains**

- 💼 Career & Craft
- 📈 Wealth & Assets
- 🎮 Gaming & Esports (NEW - modern addition!)

**Level 5: Self-Transcendence - 2 domains**

- 🎯 Impact & Legacy (NEW - split from personal goals)
- 🌟 Spirit & Purpose

---

## Files Created/Modified

### New Files

1. **`client/src/types/MaslowDomain.ts`** - Core type definitions
2. **`client/src/types/Domain.ts`** - Updated domain configuration
3. **`migrations/2026-03-18-domain-rework-maslow.sql`** - Database migration
4. **`GOAL_DOMAIN_REWORK_MASLOW.md`** - Detailed proposal document

### Modified Files

1. **`client/src/features/trackers/trackerTypes.ts`** - Added 4 gaming trackers
2. **`migrations/2026-03-18-add-axiom-brief-entry-type.sql`** - Already created

---

## Key Features

### 1. Gaming & Esports Domain 🎮

**Why Added:**

- $200B+ industry (larger than movies + music)
- 3+ billion gamers worldwide
- Legitimate skill development, social connection, achievement

**Trackers Added:**

- `gaming` - Session tracking (game, duration, platform, mode)
- `achievements` - Trophy/achievement hunting
- `rank` - Competitive rank progression (LoL, Valorant, CS:GO)
- `streaming` - Twitch/YouTube content creation

**Example Goals:**

```
🎮 Gaming & Esports
├─ Reach Diamond in Valorant
│  ├─ Improve aim (K/D > 1.5)
│  └─ Learn 3 new agents
├─ Grow Twitch channel
│  ├─ Stream 5x/week
│  └─ Reach 1000 followers
└─ Complete all FromSoftware games
   ├─ Elden Ring (Platinum)
   └─ Dark Souls 3 (NG+7)
```

### 2. Maslow Level Analytics

**New Capabilities:**

- Track balance across 5 hierarchical levels
- Identify neglected life areas
- AI coaching insights: "You're neglecting Level 1 while focusing on Level 4"

**Example Analytics:**

```
Level 1: Physiological ✅ 85%
├─ Body & Fitness: 90%
├─ Rest & Recovery: 75%
└─ Mental Balance: 90%

Level 3: Love/Belonging ⚠️ 45%
├─ Friendship & Social: 40%
├─ Romance & Intimacy: 60%
└─ Community & Contribution: 35%

🔍 Axiom Insight: "You're excelling at Levels 1-2, but neglecting
   social connection (Level 3). Consider joining a local group."
```

### 3. Auto-Tracker Assignment

Each domain automatically activates relevant trackers:

```typescript
'Gaming & Esports': ['gaming', 'achievements', 'rank', 'streaming']
'Body & Fitness': ['lift', 'cardio', 'steps', 'sports']
'Mental Balance': ['mood', 'journal', 'meditation']
```

---

## Migration Steps

### Step 1: Run SQL Migration

```bash
# In Supabase SQL Editor or via CLI
psql -f migrations/2026-03-18-domain-rework-maslow.sql
```

### Step 2: Verify Migration

```sql
-- Check domain distribution
SELECT domain, COUNT(*)
FROM goal_trees
GROUP BY domain
ORDER BY domain;

-- Test Maslow level function
SELECT get_maslow_level('Gaming & Esports'::goal_domain_new); -- Returns 4
SELECT get_maslow_level('Body & Fitness'::goal_domain_new); -- Returns 1

-- Check user domain balance view
SELECT * FROM user_domain_balance WHERE user_id = 'your-user-id';
```

### Step 3: Update Frontend

The TypeScript files are already updated. Just ensure:

1. Clear browser cache
2. Rebuild if using production build
3. Test domain selectors in:
   - Goal creation dialog
   - Matches page filters
   - Places page filters
   - Events page filters

### Step 4: Test Gaming Trackers

1. Create a goal in "Gaming & Esports" domain
2. Verify gaming trackers are auto-enabled
3. Log a gaming session
4. Check notebook entry is created

---

## Benefits

### Scientific Foundation ✅

- Based on proven psychological framework (Maslow)
- Users understand the "why" behind structure
- Clear progression from basic needs to self-actualization

### Better Granularity ✅

- Split overly broad domains
- Focused domains = clearer goal setting
- Reduced cognitive load

### Modern Relevance ✅

- Gaming recognized as legitimate pursuit
- Reflects how modern users actually spend time
- Attracts younger demographic

### Improved Analytics ✅

- Track balance across Maslow levels
- Identify neglected life areas
- "Are you focusing only on Level 4 while ignoring Level 1?"

### Better AI Coaching ✅

- Axiom can give level-specific advice
- "You're neglecting physiological needs"
- "Great balance across all levels this month!"

---

## Backward Compatibility

### Old Domain → New Domain Mapping

| Old Domain                            | New Domain                           | Maslow Level |
| ------------------------------------- | ------------------------------------ | ------------ |
| Fitness                               | Body & Fitness                       | 1            |
| Body & Health                         | Body & Fitness / Health & Longevity  | 1/2          |
| Mental Health                         | Mental Balance                       | 1            |
| Environment & Gear                    | Environment & Home                   | 2            |
| Investing / Financial Growth          | Financial Security / Wealth & Assets | 2/4          |
| Money & Assets                        | Financial Security                   | 2            |
| Friendship / Social Engagement        | Friendship & Social                  | 3            |
| Intimacy / Romantic Exploration       | Romance & Intimacy                   | 3            |
| Career                                | Career & Craft                       | 4            |
| Academics                             | Career & Craft                       | 4            |
| Philosophical Development             | Spirit & Purpose                     | 5            |
| Personal Goals                        | Impact & Legacy                      | 5            |
| Culture / Hobbies / Creative Pursuits | Gaming & Esports                     | 4            |

### Migration Safety

- Old columns backed up as `domain_old`
- Can rollback by renaming columns back
- All changes are reversible

---

## Next Steps

### Phase 1: Core Deployment (Week 1)

- [x] Create type definitions
- [x] Create database migration
- [x] Update tracker mappings
- [ ] Run migration in production
- [ ] Test all domain selectors

### Phase 2: UI Enhancements (Week 2)

- [ ] Add Maslow level visualization to goal tree
- [ ] Color-code domains by level
- [ ] Add level badges to goal cards
- [ ] Update onboarding flow

### Phase 3: Analytics (Week 3)

- [ ] Build "Life Balance" dashboard
- [ ] Add Maslow level progress charts
- [ ] Create "Neglected Areas" insights
- [ ] Axiom integration for level-based coaching

### Phase 4: Gaming Features (Week 4)

- [ ] Gaming-specific challenges
- [ ] Twitch/Steam API integrations
- [ ] Auto-import gaming achievements
- [ ] Gaming community features

---

## Testing Checklist

### Domain Selection

- [ ] Create goal → select domain → verify saved correctly
- [ ] Edit goal → change domain → verify updated
- [ ] Check all 14 domains appear in dropdown

### Tracker Auto-Assignment

- [ ] Create "Body & Fitness" goal → verify lift/cardio enabled
- [ ] Create "Gaming & Esports" goal → verify gaming trackers enabled
- [ ] Create "Mental Balance" goal → verify journal/meditation enabled

### Gaming Trackers

- [ ] Log gaming session → verify entry created
- [ ] Log achievement → verify trophy icon shows
- [ ] Log rank update → verify progression tracked
- [ ] Log streaming session → verify viewer count saved

### Analytics

- [ ] View goal tree → verify domain colors correct
- [ ] Check domain filter → verify all 14 domains filterable
- [ ] Test Maslow level view → verify grouping correct

---

## FAQ

**Q: Why replace the old domains?**  
A: The old system had redundancies (Mind/Spirit overlap) and lacked scientific foundation. Maslow's hierarchy is proven psychology.

**Q: What if I have goals in the old domains?**  
A: They're automatically migrated to the closest new domain. You can re-categorize manually if needed.

**Q: Is gaming really a legitimate life domain?**  
A: Yes! Gaming is a $200B industry with 3B+ participants. It involves skill development, social connection, and achievement - all valid goals.

**Q: Can I customize the domains?**  
A: The 14 domains are designed to be comprehensive. Custom domains would break the Maslow level analytics.

**Q: What about "Academics"?**  
A: Merged into "Career & Craft" as it's typically in service of professional development.

---

## Credits

- **Framework:** Maslow's Hierarchy of Needs (1943)
- **Implementation:** Praxis Development Team
- **Gaming Advocacy:** Modern Life Balance Research
- **Date:** March 18, 2026

---

_For detailed rationale, see `GOAL_DOMAIN_REWORK_MASLOW.md`_
