import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from '../services/AICoachingService';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';
import logger from '../utils/logger';

const aiCoachingService = new AICoachingService();

interface AxiomAction {
  type: 'create_entry' | 'update_goal' | 'suggest_match' | 'search_web' | 'respond';
  params?: Record<string, any>;
  content?: string;
}

interface AxiomAgentResponse {
  message: string;
  actions?: AxiomAction[];
  sources?: { type: string; id?: string; title?: string; content?: string }[];
  webResults?: { title: string; url: string; snippet: string }[];
}

async function searchNotebooks(userId: string, query: string): Promise<any[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: entries } = await supabase
    .from('notebook_entries')
    .select('id, entry_type, title, content, mood, tags, domain, goal_id, occurred_at')
    .eq('user_id', userId)
    .gte('occurred_at', thirtyDaysAgo.toISOString())
    .limit(50);

  if (!entries || entries.length === 0) return [];

  const queryLower = query.toLowerCase();
  const scored = entries.map(entry => {
    let score = 0;
    const title = (entry.title || '').toLowerCase();
    const content = (entry.content || '').toLowerCase();
    const tags = (entry.tags || []).join(' ').toLowerCase();
    const domain = (entry.domain || '').toLowerCase();

    if (title.includes(queryLower)) score += 10;
    if (content.includes(queryLower)) score += 5;
    if (tags.includes(queryLower)) score += 3;
    if (domain.includes(queryLower)) score += 2;

    if (queryLower.split(' ').some(w => w.length > 3 && (content.includes(w) || title.includes(w)))) {
      score += 2;
    }

    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(s => s.entry);
}

async function searchWeb(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  // For now, return empty - web search would require additional API setup
  // This could integrate with Google Search API, Tavily, or similar
  logger.info(`[AxiomAgent] Web search requested: "${query}"`);
  return [];
}

async function createNotebookEntry(userId: string, data: { title?: string; content: string; mood?: string; domain?: string }): Promise<any> {
  const { data: entry, error } = await supabase
    .from('notebook_entries')
    .insert({
      user_id: userId,
      entry_type: 'note',
      title: data.title || null,
      content: data.content,
      mood: data.mood || null,
      domain: data.domain || null,
      occurred_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error('[AxiomAgent] Failed to create notebook entry:', error.message);
    throw error;
  }

  return entry;
}

async function updateGoalProgress(userId: string, goalId: string, progress: number): Promise<void> {
  const { data: tree } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('user_id', userId)
    .maybeSingle();

  if (!tree?.nodes) return;

  const nodes = tree.nodes.map((n: any) => {
    if (n.id === goalId) {
      return { ...n, progress: progress / 100 };
    }
    return n;
  });

  await supabase
    .from('goal_trees')
    .update({ nodes })
    .eq('user_id', userId);
}

async function suggestMatch(userId: string, context: string): Promise<any | null> {
  const { data: matches } = await supabase.rpc('match_users_by_goals', {
    query_user_id: userId,
    match_limit: 1,
  });

  if (matches && matches.length > 0) {
    return matches[0];
  }
  return null;
}

async function buildAgentContext(userId: string, query: string): Promise<any> {
  const [
    profileRes,
    goalTreeRes,
    trackersRes,
    checkinsRes,
    matchesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('name, bio, city').eq('id', userId).single(),
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
    supabase.from('trackers').select('id, type, goal').eq('user_id', userId),
    supabase.from('checkins').select('checked_in_at, mood, win_of_the_day, streak_day')
      .eq('user_id', userId)
      .order('checked_in_at', { ascending: false })
      .limit(7),
    supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 3 }),
  ]);

  const profile = profileRes.data;
  const nodes = goalTreeRes.data?.nodes || [];
  const goals = nodes.slice(0, 10).map((n: any) => ({
    id: n.id,
    name: n.name,
    domain: n.domain,
    progress: Math.round((n.progress || 0) * 100),
  }));

  return {
    userId,
    userName: profile?.name || 'User',
    city: profile?.city || 'Unknown',
    bio: profile?.bio,
    goals,
    trackers: trackersRes.data || [],
    recentCheckins: checkinsRes.data || [],
    matches: matchesRes.data || [],
    query,
  };
}

function buildAgentPrompt(context: any, query: string, notebookResults: any[], webResults: any[]): string {
  const { userName, goals, trackers, recentCheckins, matches } = context;

  const notebookContext = notebookResults.length > 0
    ? notebookResults.map((e: any, i: number) => 
        `[${i + 1}] ${e.occurred_at?.slice(0, 10)} | ${e.entry_type} | ${e.title || '(no title)'} | ${(e.content || '').slice(0, 150)}...`
      ).join('\n')
    : '(No relevant notebook entries found)';

  const webContext = webResults.length > 0
    ? webResults.map((w: any) => `- ${w.title}: ${w.snippet?.slice(0, 100)}...`).join('\n')
    : '(No web results)';

  const goalsSummary = goals.map((g: any) => `- ${g.name} (${g.domain}): ${g.progress}%`).join('\n');

  const checkinsSummary = recentCheckins.slice(0, 5).map((c: any) => 
    `${c.checked_in_at?.slice(0, 10)}: ${c.mood || 'N/A'} | ${c.win_of_the_day?.slice(0, 30) || 'no win'}`
  ).join('\n');

  const matchesSummary = matches.length > 0
    ? matches.map((m: any) => {
        const matchName = m.name || m.name1 || 'Someone';
        const reason = m.reason || m.match_reason || 'similar goals';
        return `- ${matchName}: ${reason}`;
      }).join('\n')
    : '(No matches found yet)';

  return `You are Axiom Agent — an intelligent life coach that can search your notebooks, the web, and recommend people.

USER QUESTION: "${query}"

YOUR CONTEXT:
- User: ${userName}
- Goals: ${goalsSummary}
- Recent check-ins: ${checkinsSummary}
- Potential Sparring Partners (for recommendations):
${matchesSummary}

NOTEBOOK SEARCH RESULTS:
${notebookContext}

WEB SEARCH RESULTS:
${webContext}

---

Based on the user's question and the search results, respond appropriately:

1. If the question asks about their data — analyze the notebook results and provide insights
2. If the question asks for external information — use web results or explain you can search the web
3. If the question asks to do something — describe what action would help (you cannot execute actions yet)

Be conversational, specific, and helpful. Reference specific entries, dates, or data points.
${notebookResults.length > 0 ? 'Cite specific notebook entries when relevant.' : 'Note if the notebook search returned no relevant results.'}

Response:`;
}

export const axiomAgent = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { query, allow_web_search = false } = req.body;
  if (!query?.trim()) {
    throw new BadRequestError('query is required');
  }

  logger.info(`[AxiomAgent] Processing query for user ${userId}: "${query.substring(0, 50)}..."`);

  if (!aiCoachingService.isConfigured) {
    return res.status(503).json({
      error: 'AXIOM_OFFLINE',
      message: 'Axiom is not configured on this server',
    });
  }

  try {
    const context = await buildAgentContext(userId, query);
    
    const [notebookResults, webResults] = await Promise.all([
      searchNotebooks(userId, query),
      allow_web_search ? searchWeb(query) : Promise.resolve([]),
    ]);

    const prompt = buildAgentPrompt(context, query, notebookResults, webResults);
    const response = await aiCoachingService.generateCoachingResponse(prompt, context, true);

    const sources = notebookResults.slice(0, 5).map((e: any) => ({
      type: e.entry_type,
      id: e.id,
      title: e.title,
      content: e.content?.slice(0, 100),
    }));

    const matchRecommendations = context.matches.slice(0, 2).map((m: any) => ({
      id: m.id || m.user_id,
      name: m.name || m.name1 || 'Someone',
      reason: m.reason || m.match_reason || 'similar goals',
      avatarUrl: m.avatar_url,
    }));

    res.json({
      message: response,
      sources,
      matches: matchRecommendations,
      webResults: webResults.length > 0 ? webResults : undefined,
      notebookResultsCount: notebookResults.length,
    });
  } catch (err: any) {
    logger.error('[AxiomAgent] Failed:', err.message);
    const msg = err?.message || String(err);
    
    if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
      return res.status(503).json({
        error: 'QUOTA_EXCEEDED',
        message: 'Axiom is at capacity. Please try again later.',
      });
    }

    res.status(500).json({
      error: 'AGENT_ERROR',
      message: 'Axiom Agent encountered an error. Please try again.',
    });
  }
});

export { buildAgentContext, searchNotebooks, buildAgentPrompt, searchWeb, createNotebookEntry, updateGoalProgress };
export default { axiomAgent, buildAgentContext, searchNotebooks, buildAgentPrompt, searchWeb, createNotebookEntry, updateGoalProgress };
