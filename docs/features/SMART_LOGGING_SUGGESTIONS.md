# Smart Logging Suggestions for Axiom

## Overview

Smart Logging Suggestions provide context-aware prompts that help users log the most useful information for Axiom to track progress on their goals. Instead of a blank "What's on your mind?" textbox, users see curated suggestions designed to elicit high-value tracking data.

## Problem Solved

**Before:** Users stare at empty textboxes wondering what to log
**After:** Users see 5-6 actionable prompts tailored to their goal domain

This ensures:

1. **Consistent Data**: Users log similar types of information daily
2. **Actionable Insights**: Prompts focus on trackable metrics
3. **Better AI Coaching**: Axiom gets structured, useful data
4. **Reduced Friction**: No more "writer's block" when logging

## Implementation

### New Files

- `client/src/utils/loggingSuggestions.ts` - Suggestion engine

### Modified Files

- `client/src/features/notes/GoalNotesPanel.tsx` - Added suggestions UI
- `client/src/components/common/QuickLogDialog.tsx` - Added suggestions UI

## Suggestion Categories

### By Domain (10 domains × 7 suggestions = 70 suggestions)

#### 🏋️ Fitness

1. What exercise did you complete today?
2. How did your body feel during training?
3. Did you hit your nutrition targets?
4. What was your energy level today (1-10)?
5. Any new personal records or milestones?
6. What obstacles did you overcome today?
7. How consistent were you with your routine?

#### 💼 Career

1. What meaningful work did you complete today?
2. Did you move closer to a career milestone?
3. What skills did you practice or learn?
4. Any challenges or blockers at work?
5. How productive were you today (1-10)?
6. Did you network or build relationships?
7. What would make tomorrow more productive?

#### 📚 Learning

1. What did you study or practice today?
2. What new concept clicked for you?
3. How long did you focus today (minutes)?
4. What was challenging or confusing?
5. How confident do you feel with the material?
6. What will you review or practice next?
7. Any breakthroughs or "aha" moments?

#### 👥 Relationships

1. Who did you connect with today?
2. How did you show up for others today?
3. Any meaningful conversations or moments?
4. Did you resolve any conflicts or tensions?
5. How supported do you feel right now?
6. Who needs your attention or care?
7. What relationship skill are you working on?

#### 💰 Finance

1. What financial action did you take today?
2. Did you stay within budget today?
3. Any income earned or savings made?
4. What spending triggers did you notice?
5. How confident do you feel about your finances?
6. Any financial obstacles or worries?
7. What financial habit are you building?

#### 🎨 Creative

1. What did you create or work on today?
2. How long did you spend in flow state?
3. Any new ideas or inspiration today?
4. What creative blocks did you face?
5. How satisfied are you with your progress?
6. What will you create tomorrow?
7. What skill or technique did you practice?

#### 🏥 Health

1. How did you prioritize your health today?
2. What was your stress level (1-10)?
3. How many hours did you sleep?
4. Any symptoms or health wins to note?
5. Did you take medications/supplements?
6. What health habit are you working on?
7. How energized do you feel today?

#### 🧘 Spiritual

1. How did you nurture your spirit today?
2. What are you grateful for today?
3. Did you meditate or pray today?
4. What insights or revelations came to you?
5. How connected do you feel to your purpose?
6. What doubts or questions arose?
7. How can you deepen your practice?

#### 📈 Business

1. What business milestone did you hit today?
2. What revenue or growth action did you take?
3. Did you talk to customers or users today?
4. What metrics improved today?
5. What business challenges did you face?
6. How confident are you in your business direction?
7. What did you learn about your market?

#### 💭 Personal (Default)

1. What made you smile today?
2. What important thing did you do today?
3. How are you really feeling right now?
4. What are you proud of today?
5. What challenged you today?
6. What did you learn about yourself?
7. What's one thing you want to improve tomorrow?

### General Suggestions (12 suggestions)

For free-form logging when no goal is selected:

1. What was the highlight of your day?
2. How are you feeling right now, really?
3. What's one thing you accomplished today?
4. What's on your mind that needs attention?
5. What are you grateful for today?
6. What drained your energy today?
7. What gave you energy today?
8. What's worrying you right now?
9. What made you laugh today?
10. What's one lesson from today?
11. How did you show up for yourself today?
12. What do you need right now?

## Suggestion Categories (Metadata)

Each suggestion is tagged with a category:

- **reflection**: Introspective questions about feelings/state
- **action**: Concrete actions taken
- **obstacle**: Challenges or blockers faced
- **milestone**: Achievements or wins
- **mood**: Emotional state check-ins
- **learning**: New knowledge or skills

This metadata enables future features like:

- Filtering logs by category
- Analytics on what types of entries correlate with progress
- Axiom coaching insights ("You log lots of obstacles but few actions...")

## UI/UX Design

### Visual Design

- **Lightbulb icon** indicates smart suggestions
- **Toggle button** to show/hide suggestions
- **Chip components** for clickable suggestions
- **Domain-colored** borders and backgrounds
- **Auto-insert** with newline separation

### User Flow

1. User opens notebook/logging dialog
2. Sees "💡 What would be most useful to track?" header
3. Clicks "Show Prompts" button
4. 5-6 suggestion chips appear
5. Clicks a suggestion chip
6. Suggestion text is inserted into input field
7. User can edit/expand on the suggestion
8. Submits log as normal

### Example UI

```
┌────────────────────────────────────────┐
│ 💡 What would be most useful to track? │
│                          [Show Prompts]│
└────────────────────────────────────────┘

[Clicks Show Prompts]

┌────────────────────────────────────────┐
│ 💡 What would be most useful to track? │
│                          [Hide Prompts]│
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ What exercise did you complete     │ │
│ │ today? 🏋️                          │ │
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ How did your body feel during      │ │
│ │ training? 💪                        │ │
│ └────────────────────────────────────┘ │
│ ...                                    │
└────────────────────────────────────────┘
```

## Technical Details

### Suggestion Selection Algorithm

```typescript
// Get top 5 suggestions sorted by priority
function getSuggestionsForDomain(domain: Domain): LoggingSuggestion[] {
  return GOAL_SUGGESTIONS[domain]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}
```

### Priority System

- **10**: Most critical/trackable data
- **9-8**: Important metrics
- **7-6**: Useful context
- **5**: Nice-to-know

Priorities ensure the most Axiom-valuable prompts appear first.

### Integration Points

#### GoalNotesPanel

```tsx
// Load suggestions based on context
useEffect(() => {
  if (nodeId) {
    setSuggestions(getSuggestionsForDomain("Personal"));
  } else {
    setSuggestions(getGeneralSuggestions());
  }
}, [nodeId, nodeTitle]);
```

#### QuickLogDialog

```tsx
// Update suggestions when goal selection changes
useEffect(() => {
  if (selectedGoal) {
    setSuggestions(getSuggestionsForDomain(selectedGoal.domain));
  } else if (viewMode === "free") {
    setSuggestions(getGeneralSuggestions());
  }
}, [selectedGoal, viewMode]);
```

## Future Enhancements

### Personalization

- [ ] Learn which suggestions user clicks most
- [ ] Promote high-engagement suggestions
- [ ] Demote ignored suggestions
- [ ] User-specific suggestion tuning

### Dynamic Suggestions

- [ ] Time-based (morning vs evening prompts)
- [ ] Streak-based (celebrate milestones)
- [ ] Progress-based (adjust to goal stage)
- [ ] Mood-aware (suggest based on recent logs)

### Axiom Integration

- [ ] Axiom generates custom suggestions
- [ ] Suggestions based on goal bottlenecks
- [ ] Reflect recent coaching insights
- [ ] Prompt for missing data Axiom needs

### Social Features

- [ ] Share suggestion templates
- [ ] Community-curated suggestions
- [ ] Coach-recommended prompts
- [ ] Accountability partner suggestions

## Benefits for Axiom

### Data Quality

- **Structured**: Similar data logged daily
- **Comparable**: Same metrics tracked over time
- **Actionable**: Focus on trackable behaviors
- **Complete**: Covers multiple dimensions

### Coaching Insights

With consistent data, Axiom can:

- Detect patterns ("You always log low energy on Mondays")
- Correlate behaviors ("Sleep < 7hrs → productivity drops")
- Identify obstacles ("Financial stress spikes monthly")
- Celebrate wins ("30-day streak on nutrition logs!")

### Progress Estimation

Better data → better progress estimates:

- Explicit metrics (hours, reps, dollars)
- Qualitative signals (confidence, energy, mood)
- Obstacle tracking (what blocks progress)
- Milestone detection (when goals are achieved)

## Usage Analytics (Future)

Track these metrics:

- **Suggestion click-through rate**: Which prompts resonate?
- **Domain engagement**: Which goals get most logs?
- **Time patterns**: When do users log most?
- **Completion rate**: Do suggestions increase logging frequency?

## Deployment Notes

- No database migrations required
- Client-side only feature
- Backwards compatible (existing logs unaffected)
- No API changes needed
- Instant activation on deploy
