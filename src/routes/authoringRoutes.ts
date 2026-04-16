import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';
import { AICoachingService } from '../services/AICoachingService';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const AUTHORING_COST = 200;

interface AuthoringPhase {
  phase: 'selecting' | 'authoring' | 'reviewing' | 'completed';
  messages: Array<{ role: 'user' | 'axiom'; content: string }>;
  narrativeDraft?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /authoring/start
 * Start new interactive authoring session
 * Body: { topic?: string, startDate?: string, endDate?: string }
 */
router.post('/start', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { topic, startDate, endDate } = req.body as {
    topic?: string;
    startDate?: string;
    endDate?: string;
  };

  // Check premium status and PP balance
  const { data: profile } = await supabase
    .from('profiles').select('name, praxis_points, is_premium, is_admin')
    .eq('id', userId).single();

  const userName = profile?.name || 'User';
  const isPro = profile?.is_premium || profile?.is_admin;
  const balance = profile?.praxis_points ?? 0;

  if (!isPro && balance < AUTHORING_COST) {
    throw new BadRequestError(`Not enough PP. You have ${balance}, need ${AUTHORING_COST}.`);
  }

  // Deduct PP (will refund if session fails)
  if (!isPro) {
    const { error: ppErr } = await supabase
      .from('profiles')
      .update({ praxis_points: balance - AUTHORING_COST })
      .eq('id', userId);
    if (ppErr) throw ppErr;
    logger.info(`[Authoring] Deducted ${AUTHORING_COST} PP from ${userName}`);
  }

  // Create session ID
  const sessionId = uuidv4();
  const now = new Date().toISOString();

  // Fetch relevant entries for the period/topic
  const entries = await fetchAuthoringEntries(userId, startDate, endDate, topic);

  if (entries.length === 0) {
    if (!isPro) {
      await supabase.from('profiles').update({ praxis_points: balance }).eq('id', userId);
    }
    throw new BadRequestError('No entries found for this period. Try a different range.');
  }

  // Build initial Axiom prompt
  const dateRangeText = startDate && endDate
    ? `from ${startDate} to ${endDate}`
    : topic
      ? `about "${topic}"`
      : 'from your recent activity';

  const entriesText = formatEntriesForPrompt(entries);

  const initialPrompt = `You are Axiom, a warm and wise personal editor/butler. Your role is to help the user rewrite their life story as a beautiful narrative.

AUTHOR: ${userName}
PERIOD: ${dateRangeText}

RELEVANT ENTRIES:
${entriesText}

INSTRUCTIONS:
1. Acknowledge the entries and warmly introduce what you've found
2. Ask the user which moments or aspects resonate most with them
3. Invite them to pick 2-3 moments they want to develop into a narrative
4. Be a gentle guide — don't write yet, just help them discover what matters

Respond warmly and conversationally, as a thoughtful editor would.`;

  const initialMessage: AuthoringPhase = {
    phase: 'selecting',
    messages: [{ role: 'axiom', content: initialPrompt }],
    createdAt: now,
    updatedAt: now,
  };

  // Save session to localStorage format (on client)
  // For now, return the data needed to start the session on frontend
  res.json({
    sessionId,
    cost: isPro ? 0 : AUTHORING_COST,
    entries: entries.slice(0, 50), // Limit for UI
    entryCount: entries.length,
    dateRange: startDate && endDate ? { start: startDate, end: endDate } : null,
    topic: topic || null,
    initialMessage: initialPrompt,
    userName,
  });
}));

/**
 * POST /authoring/suggest-topics
 * Get AI-suggested topics from recent entries
 */
router.post('/suggest-topics', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles').select('name').eq('id', userId).single();
  const userName = profile?.name || 'User';

  // Fetch recent entries (last 6 weeks)
  const entries = await fetchAuthoringEntries(userId, null, null, null, 6);

  if (entries.length === 0) {
    res.json({ topics: [] });
    return;
  }

  const entriesText = formatEntriesForPrompt(entries.slice(0, 30));

  const prompt = `You are Axiom, a thoughtful life coach. Analyze these diary entries and suggest 3-5 meaningful themes or topics the person might want to write about.

ENTRIES:
${entriesText}

Respond with a JSON array of topics, each with:
- "topic": brief theme name (3-6 words)
- "description": 1-sentence explanation of what's included
- "entryCount": approximate number of relevant entries

Output only JSON, no other text.`;

  try {
    const aiCoaching = new AICoachingService();
    const response = await aiCoaching.runWithFallback(prompt);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    const topics = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    
    res.json({ topics });
  } catch (err) {
    logger.error(`[Authoring] Failed to suggest topics: ${err}`);
    res.json({ topics: [] });
  }
}));

/**
 * POST /authoring/session/:id/continue
 * Continue authoring after user input
 */
router.post('/session/:id/continue', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { sessionId } = req.params;
  const { userInput, regenerate } = req.body as { userInput?: string; regenerate?: boolean };

  // Get session data from request body (passed from frontend localStorage)
  const { sessionData } = req.body as { sessionData?: AuthoringPhase };
  
  if (!sessionData) {
    throw new BadRequestError('Session data required');
  }

  const { data: profile } = await supabase
    .from('profiles').select('name').eq('id', userId).single();
  const userName = profile?.name || 'User';

  // Build conversation for continuation
  const messages = [...sessionData.messages];
  if (userInput) {
    messages.push({ role: 'user', content: userInput });
  }

  // Determine what Axiom should do
  const isRegeneration = regenerate || false;
  const lastMessage = messages[messages.length - 1];
  const shouldWrite = lastMessage?.role === 'user' && !regenerate && !!userInput;

  let axiomResponse: string;

  if (isRegeneration) {
    // Regenerate the narrative draft
    const prompt = `You are Axiom, a warm and wise personal editor. The user wants to regenerate their narrative draft.
    
STORY SO FAR (user's selected moments):
${userInput || 'Please regenerate, focusing on different aspects'}

Write a polished, beautiful narrative in first person — like a memoir chapter.
- 500-1500 words
- Evocative but grounded in specific details from their life
- Write as ${userName}, not as "the author"
- No bullet points, just clean prose

Generate the narrative now:`;

    const aiCoaching = new AICoachingService();
    axiomResponse = await aiCoaching.runWithFallback(prompt);
  } else if (shouldWrite) {
    // Check if user is ready to write (indicated by phrases like "write", "ready", "do it")
    const readyToWrite = userInput ? /write|ready|do it|go ahead|yes lets|lets write|compose/i.test(userInput) : false;
    
    if (readyToWrite) {
      // Generate the narrative
      const contextForWriting = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n\n');

      const prompt = `You are Axiom, a warm and wise personal editor. The user has selected moments to develop into a narrative.
      
SELECTED MOMENTS:
${contextForWriting}

Write a beautiful, polished personal narrative in first person — like a memoir chapter.
- 800-2000 words
- Group into 2-3 short chapters with titles
- Include specific details, emotions, dates
- Write as ${userName}, capturing their authentic voice
- No bullet points, no lists — just flowing prose
- End with a reflection on what this period means

Generate the complete narrative now:`;

      const aiCoaching = new AICoachingService();
      axiomResponse = await aiCoaching.runWithFallback(prompt);
    } else {
      // Continue the dialogue
      const conversationHistory = messages.slice(-6).map(m => 
        `${m.role === 'user' ? 'User' : 'Axiom'}: ${m.content}`
      ).join('\n\n');

      const prompt = `You are Axiom, a warm personal editor/butler helping someone write their life story.

CONVERSATION:
${conversationHistory}

User: ${userInput}

Axiom (respond as a thoughtful editor would, asking 1-2 warm questions to help them select moments or refine their vision):`;

      const aiCoaching = new AICoachingService();
      axiomResponse = await aiCoaching.runWithFallback(prompt);
    }
  } else {
    // Just continue the conversation
    axiomResponse = "Which moments would you like to develop into your narrative?";
  }

  messages.push({ role: 'axiom', content: axiomResponse });

  const newPhase: AuthoringPhase = {
    ...sessionData,
    phase: shouldWrite && messages.filter(m => m.role === 'axiom').length > 1 ? 'reviewing' : 'authoring',
    messages,
    narrativeDraft: shouldWrite ? axiomResponse : sessionData.narrativeDraft,
    updatedAt: new Date().toISOString(),
  };

  res.json({
    response: axiomResponse,
    phase: newPhase.phase,
    isComplete: newPhase.phase === 'reviewing',
  });
}));

/**
 * POST /authoring/session/:id/complete
 * Finalize and get narrative for download
 */
router.post('/session/:id/complete', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { sessionData, finalNarrative } = req.body as {
    sessionData?: AuthoringPhase;
    finalNarrative?: string;
  };

  if (!finalNarrative && !sessionData?.narrativeDraft) {
    throw new BadRequestError('No narrative to complete');
  }

  const narrative = finalNarrative || sessionData?.narrativeDraft || '';

  // Optionally save to notebook
  const { saveToNotebook } = req.body as { saveToNotebook?: boolean };
  
  if (saveToNotebook) {
    await supabase.from('notebook_entries').insert({
      user_id: userId,
      entry_type: 'authoring',
      title: 'Interactive Authoring',
      content: narrative,
      metadata: { 
        type: 'interactive_authoring',
        topic: sessionData?.messages?.[0],
        createdAt: sessionData?.createdAt,
      },
    });
  }

  res.json({
    narrative,
    savedToNotebook: saveToNotebook,
  });
}));

// Helper functions

async function fetchAuthoringEntries(
  userId: string,
  startDate?: string | null,
  endDate?: string | null,
  topic?: string | null,
  weeksBack: number = 6
) {
  // Calculate date range
  let start: string;
  let end: string = endDate || new Date().toISOString().slice(0, 10);
  
  if (startDate) {
    start = startDate;
  } else {
    const d = new Date();
    d.setDate(d.getDate() - (weeksBack * 7));
    start = d.toISOString().slice(0, 10);
  }

  // Fetch from multiple tables
  const [journalsRes, nodeJournalsRes, checkinsRes] = await Promise.all([
    supabase.from('journal_entries')
      .select('note, mood, created_at')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
    supabase.from('node_journal_entries')
      .select('node_id, note, mood, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', start)
      .lte('logged_at', end)
      .order('logged_at', { ascending: true }),
    supabase.from('checkins')
      .select('mood, win_of_the_day, checked_in_at, streak_day')
      .eq('user_id', userId)
      .gte('checked_in_at', start)
      .lte('checked_in_at', end)
      .order('checked_in_at', { ascending: true }),
  ]);

  const journals = journalsRes.data || [];
  const nodeJournals = nodeJournalsRes.data || [];
  const checkins = checkinsRes.data || [];

  // Combine and sort
  const allEntries = [
    ...journals.map(e => ({ type: 'journal', date: e.created_at, text: `${e.mood || ''} ${e.note || ''}`.trim() })),
    ...nodeJournals.map(e => ({ type: 'goal_journal', date: e.logged_at, text: e.note || '' })),
    ...checkins.map(e => ({ type: 'checkin', date: e.checked_in_at, text: `Day ${e.streak_day}: ${e.mood || ''} ${e.win_of_the_day || ''}`.trim() })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return allEntries;
}

function formatEntriesForPrompt(entries: Array<{ type: string; date: string; text: string }>): string {
  const byDate: Record<string, string[]> = {};
  
  for (const e of entries) {
    if (!e.text) continue;
    const dateKey = e.date.slice(0, 10);
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(e.text);
  }

  const lines: string[] = [];
  for (const [date, texts] of Object.entries(byDate)) {
    lines.push(`${date}: ${texts.join('; ')}`);
  }

  return lines.join('\n');
}

export default router;