# Axiom Notebook Query Feature

## Overview

Added an "Ask Axiom" button to the Smart Notebook page that allows users to query their logged notebook data using AI-powered insights.

## Features

### User Experience

- **Button Location**: Top-right corner of the Notebook page, next to "New Note" button
- **Cost Structure**:
  - **Free Users**: 50 PP per query
  - **Premium Users**: Unlimited queries (no PP cost)
- **Dialog Interface**: Beautiful modal with:
  - User's current PP balance display
  - Suggested question chips for inspiration
  - Multi-line text input for custom questions
  - Formatted AI response with cost breakdown
  - Error handling with helpful messages

### Backend Implementation

#### New Files Created

1. **`src/controllers/notebookAxiomController.ts`**
   - `queryNotebookAxiom()` - Main controller function
   - `buildNotebookContext()` - Gathers user's notebook data
   - `buildNotebookQueryPrompt()` - Creates AI prompt with context
   - PP deduction logic with transaction logging

2. **`client/src/features/notebook/AxiomQueryDialog.tsx`**
   - Complete dialog UI component
   - API integration
   - User profile fetching
   - Suggested questions
   - Response formatting

#### Modified Files

1. **`src/routes/notebookRoutes.ts`**
   - Added `POST /notebook/axiom-query` endpoint

2. **`client/src/features/notebook/NotebookPage.tsx`**
   - Added "Ask Axiom" button
   - Added AxiomQueryDialog component
   - User profile fetching for PP display

### Data Context

When a user asks a question, Axiom analyzes:

- **Notebook Entries**: Last 30 days (up to 100 entries)
- **Tags**: All user's tags
- **Goals**: Root goals from goal tree
- **Trackers**: All active trackers
- **Check-ins**: Last 14 days of check-ins
- **Profile**: Name, streak, PP balance

### AI Prompt Structure

The prompt includes:

- User identity and question
- Formatted summary of recent notebook entries
- Tags, goals, trackers, and check-ins
- Instructions for analysis tone and style
- Request for specific, data-driven insights

### Payment Flow

1. User clicks "Ask Axiom" button
2. Dialog opens showing current PP balance
3. User enters question and submits
4. Backend checks premium status:
   - **Premium**: Query processed, no PP deducted
   - **Free**: 50 PP deducted if sufficient balance
5. If insufficient PP, error message shown with upgrade hint
6. Transaction logged to `marketplace_transactions` table
7. Query and response logged to `messages` table

### Error Handling

- **Insufficient Points**: 402 error with helpful message
- **AI Service Unavailable**: 503 error with friendly message
- **Rate Limiting**: Handled gracefully with retry suggestion
- **Offline Mode**: Clear messaging when AI service not configured

## Usage Examples

### Suggested Questions

- "What patterns do you see in my recent entries?"
- "How consistent have I been with my goals?"
- "What's my most common mood this week?"
- "Which tags do I use most frequently?"
- "Am I making progress on my main goals?"

### Custom Questions

Users can ask anything about their logged data:

- "Why am I feeling down lately?"
- "What goals am I neglecting?"
- "Show me my productivity trends"
- "What activities make me happiest?"

## Technical Details

### API Endpoint

```
POST /api/notebook/axiom-query
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "question": "What patterns do you see in my entries?"
}

Response:
{
  "success": true,
  "question": "What patterns do you see in my entries?",
  "answer": "Based on your last 30 days...",
  "cost": 50,
  "newBalance": 150
}
```

### Database Changes

No new migrations required. Uses existing tables:

- `notebook_entries` - User's logged data
- `profiles` - PP balance and premium status
- `marketplace_transactions` - Transaction logging
- `messages` - Query/response history

### Constants

```typescript
const AXIOM_NOTEBOOK_QUERY_COST = 50; // PP per query (free tier)
```

## Future Enhancements

- Query history view
- Follow-up questions in same session
- Export insights as notebook entry
- Voice input for questions
- Advanced filters (date ranges, specific domains)
- Batch analysis (weekly/monthly reports)

## Testing Checklist

- [ ] Free user with sufficient PP can query
- [ ] Free user with insufficient PP gets error
- [ ] Premium user can query without PP deduction
- [ ] Response includes specific data references
- [ ] Error handling works correctly
- [ ] Transaction logging works
- [ ] Messages logged correctly
- [ ] UI displays properly on mobile
- [ ] Suggested questions work
- [ ] Multi-line input works

## Deployment Notes

1. No database migrations required
2. Backend builds without errors
3. Frontend builds without errors
4. Feature is immediately available to all users
5. Monitor API usage and PP transactions
