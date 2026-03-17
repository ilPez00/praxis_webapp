# Axiom Daily Brief Update

## Changes Made

### 1. Frontend (`client/src/features/coaching/AICoachPage.tsx`)
- **Removed "Axiom's Take" section** - The motivation message section has been removed from the UI
- Goal Strategy is now the first section shown

### 2. Backend (`src/services/AxiomScanService.ts`)

The goal strategy is now **always generated algorithmically** (no LLM).

**What changed:**
- Goal strategy is generated based on goal progress percentage
- Each goal gets a tailored bottleneck and advice based on progress stage:
  - **0% progress**: "Hasn't started yet" → "Start with a 5-minute exploration session"
  - **<30% progress**: "Early stage - building momentum" → "Focus on consistency over perfection"
  - **<70% progress**: "Mid-goal plateau" → "Review your approach, consider asking for help"
  - **>70% progress**: "Final stretch resistance" → "Set a deadline and commit to finishing"

**Network leverage** is also generated algorithmically:
- Suggests reaching out to matches
- Provides generic but actionable networking advice

## Result

- **Faster** brief generation (no LLM latency)
- **More reliable** (no LLM failures)
- **Consistent** goal strategy for all users
- **Simpler** UI without the "Axiom's Take" section

## Testing

After deployment:
1. Go to Coaching page
2. "Axiom's Take" section should be gone
3. "Goal Strategy" section should show first
4. Each goal should have progress-based advice
