import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from '../services/AICoachingService';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';
import logger from '../utils/logger';

const aiCoachingService = new AICoachingService();

// ---------------------------------------------------------------------------
// PP cost constants for Axiom notebook queries
// ---------------------------------------------------------------------------

const AXIOM_NOTEBOOK_QUERY_COST = 50; // PP per query (free tier)

/**
 * Deducts PP from a user's profile. Returns false if insufficient balance.
 */
async function deductPP(userId: string, amount: number): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single();

  const current: number = profile?.praxis_points ?? 0;
  if (current < amount) return false;

  await supabase
    .from('profiles')
    .update({ praxis_points: current - amount })
    .eq('id', userId);

  await supabase.from('marketplace_transactions').insert({
    user_id: userId,
    item_type: 'axiom_notebook_query',
    cost: amount,
    metadata: { label: 'Axiom notebook query' },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Build context for Axiom notebook queries
// ---------------------------------------------------------------------------

/**
 * Build context specifically for notebook data queries.
 * Includes user's notebook entries, tags, goals, and recent activity.
 */
async function buildNotebookContext(userId: string, question: string): Promise<any> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  // Fetch all relevant data in parallel
  const [
    profileRes,
    notebookEntriesRes,
    tagsRes,
    goalTreeRes,
    trackersRes,
    checkinsRes,
  ] = await Promise.allSettled([
    // 1. Profile
    supabase
      .from('profiles')
      .select('name, bio, current_streak, praxis_points, language')
      .eq('id', userId)
      .single(),

    // 2. Recent notebook entries (last 30 days, up to 100 entries)
    supabase
      .from('notebook_entries')
      .select('id, entry_type, title, content, mood, tags, domain, occurred_at, created_at')
      .eq('user_id', userId)
      .gte('occurred_at', thirtyDaysAgoStr)
      .order('occurred_at', { ascending: false })
      .limit(100),

    // 3. User's tags
    supabase
      .from('notebook_tags')
      .select('name, color')
      .eq('user_id', userId)
      .order('name'),

    // 4. Goal tree
    supabase
      .from('goal_trees')
      .select('nodes')
      .eq('user_id', userId)
      .maybeSingle(),

    // 5. Trackers
    supabase
      .from('trackers')
      .select('id, type, goal')
      .eq('user_id', userId),

    // 6. Recent check-ins (last 7 days)
    supabase
      .from('checkins')
      .select('checked_in_at, streak_day, mood, win_of_the_day')
      .eq('user_id', userId)
      .gte('checked_in_at', thirtyDaysAgoStr)
      .order('checked_in_at', { ascending: false })
      .limit(14),
  ]);

  // Extract data with fallbacks
  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
  const rawNotebookEntries: any[] = notebookEntriesRes.status === 'fulfilled' ? (notebookEntriesRes.value.data ?? []) : [];
  const tags: any[] = tagsRes.status === 'fulfilled' ? (tagsRes.value.data ?? []) : [];
  const goalNodes: any[] = goalTreeRes.status === 'fulfilled' ? (goalTreeRes.value.data?.nodes ?? []) : [];
  const trackers: any[] = trackersRes.status === 'fulfilled' ? (trackersRes.value.data ?? []) : [];
  const checkins: any[] = checkinsRes.status === 'fulfilled' ? (checkinsRes.value.data ?? []) : [];

  // Format notebook entries for context
  const notebookEntries = rawNotebookEntries.map((e: any) => ({
    id: e.id,
    type: e.entry_type,
    title: e.title || '(no title)',
    content: (e.content || '').slice(0, 500), // Truncate for context window
    mood: e.mood,
    tags: e.tags || [],
    domain: e.domain,
    date: e.occurred_at || e.created_at,
  }));

  // Extract root goals
  const rootGoals = goalNodes
    .filter((n: any) => !n.parentId && n.domain)
    .map((n: any) => ({
      name: n.domain,
      progress: n.progress || 0,
      description: n.description,
    }));

  return {
    userName: profile?.name || 'User',
    bio: profile?.bio,
    streak: profile?.current_streak || 0,
    praxisPoints: profile?.praxis_points || 0,
    language: profile?.language || 'en',
    notebookEntries,
    tags,
    goals: rootGoals,
    trackers,
    checkins,
    question,
  };
}

// ---------------------------------------------------------------------------
// Generate Axiom prompt for notebook queries
// ---------------------------------------------------------------------------

/**
 * Generate a prompt for Axiom to answer questions about user's notebook data.
 */
function buildNotebookQueryPrompt(context: any): string {
  const { userName, notebookEntries, tags, goals, trackers, checkins, question } = context;

  const entriesSummary = notebookEntries.length > 0
    ? notebookEntries.map((e: any, i: number) => 
        `[${i + 1}] ${e.date?.slice(0, 10)} | ${e.type} | ${e.title} | ${e.content.slice(0, 100)}...`
      ).join('\n')
    : '(No recent entries)';

  const tagsSummary = tags.length > 0
    ? tags.map((t: any) => `#${t.name}`).join(', ')
    : '(No tags)';

  const goalsSummary = goals.length > 0
    ? goals.map((g: any) => `- ${g.name}: ${g.progress}% complete`).join('\n')
    : '(No goals set)';

  const trackersSummary = trackers.length > 0
    ? trackers.map((t: any) => `- ${t.type}: ${t.goal?.template_rows?.length || 0} items tracked`).join('\n')
    : '(No trackers)';

  const checkinsSummary = checkins.length > 0
    ? checkins.slice(0, 7).map((c: any) => 
        `- ${c.checked_in_at?.slice(0, 10)}: Mood=${c.mood || 'N/A'}, Win=${c.win_of_the_day?.slice(0, 50) || 'N/A'}`
      ).join('\n')
    : '(No recent check-ins)';

  return `You are Axiom, a wise, warm, and highly analytical life coach. You are helping a student answer a question about their own logged data.

STUDENT: ${userName}
QUESTION: "${question}"

RECENT NOTEBOOK ENTRIES (last 30 days):
${entriesSummary}

TAGS USED:
${tagsSummary}

GOALS:
${goalsSummary}

TRACKERS:
${trackersSummary}

RECENT CHECK-INS:
${checkinsSummary}

---

Your task:
1. Answer the student's question by analyzing their logged data
2. Find patterns, insights, and connections in their entries
3. Be specific - reference actual entries, dates, moods, or themes
4. If the data shows concerning patterns, gently point them out
5. Provide actionable insights based on what you observe
6. Keep your response concise (200-400 words) unless complex analysis is needed

TONE: Warm, encouraging, data-driven, and insightful. Cite specific examples from their logs.

ANSWER:`;
}

// ---------------------------------------------------------------------------
// Controller: POST /notebook/axiom-query
// ---------------------------------------------------------------------------

/**
 * POST /notebook/axiom-query
 * Ask Axiom a question about your logged notebook data
 * Cost: 50 PP for free users, unlimited for premium
 */
export const queryNotebookAxiom = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { question } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ error: 'QUESTION_REQUIRED', message: 'question is required' });
  }

  // Check premium status and deduct PP if needed
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium, is_admin, praxis_points, minimal_ai_mode')
    .eq('id', userId)
    .single();

  const isPremium = profile?.is_premium || profile?.is_admin;
  const balance = profile?.praxis_points ?? 0;

  if (!isPremium) {
    if (balance < AXIOM_NOTEBOOK_QUERY_COST) {
      return res.status(402).json({
        error: 'INSUFFICIENT_POINTS',
        message: `Each Axiom notebook query costs ${AXIOM_NOTEBOOK_QUERY_COST} PP. You have ${balance} PP.`,
        needed: AXIOM_NOTEBOOK_QUERY_COST,
        have: balance,
      });
    }
    await deductPP(userId, AXIOM_NOTEBOOK_QUERY_COST);
  }

  // Check if AI service is configured
  if (!aiCoachingService.isConfigured) {
    return res.status(503).json({
      message: 'Axiom is offline — the AI service is not configured on this server.',
      detailed: profile?.is_admin ? 'genAI instance is null in AICoachingService' : undefined,
    });
  }

  try {
    // Build context from user's notebook data
    const context = await buildNotebookContext(userId, question.trim());

    // Build the prompt
    const prompt = buildNotebookQueryPrompt(context);

    // Generate response using Gemini
    const useLLM = true; // Always use LLM for notebook queries
    const response = await aiCoachingService.generateCoachingResponse(prompt, context, useLLM, 'fast');

    // Log the query to messages table for history
    await supabase.from('messages').insert({
      sender_id: userId,
      receiver_id: userId,
      content: `Notebook Query: ${question.trim()}`,
      message_type: 'text',
      is_ai: false,
    });

    await supabase.from('messages').insert({
      sender_id: userId,
      receiver_id: userId,
      content: response,
      message_type: 'text',
      is_ai: true,
      metadata: { type: 'axiom_notebook_query' },
    });

    res.json({
      success: true,
      question: question.trim(),
      answer: response,
      cost: isPremium ? 0 : AXIOM_NOTEBOOK_QUERY_COST,
      newBalance: isPremium ? balance : balance - AXIOM_NOTEBOOK_QUERY_COST,
    });
  } catch (err: any) {
    logger.error('[Axiom Notebook Query] Failed:', err.message);
    
    // Friendly error message
    const msg = err?.message || String(err);
    let errorMessage = 'Axiom is temporarily unavailable. Please try again.';
    
    if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
      errorMessage = 'Axiom is resting — the AI service has hit its daily limit. Try again later.';
    } else if (msg.includes('GEMINI_API_KEY') || msg.toLowerCase().includes('api key')) {
      errorMessage = 'Axiom is offline — AI service not configured.';
    }

    return res.status(503).json({
      error: 'AXIOM_UNAVAILABLE',
      message: errorMessage,
      detailed: profile?.is_admin ? msg : undefined,
    });
  }
});
