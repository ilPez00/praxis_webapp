import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from '../services/AICoachingService';
import { AxiomPersonaService } from '../services/AxiomPersonaService';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';
import { routeActions, getToolDeclarations } from '../services/AxiomActionRouter';
import { axiomMultimodalService } from '../services/AxiomMultimodalService';
import logger from '../utils/logger';

const personaService = new AxiomPersonaService();

const aiCoachingService = new AICoachingService();

interface AxiomAction {
  type: 'create_entry' | 'update_goal' | 'suggest_match' | 'search_web' | 'respond' | 'create_bet' | 'create_duel' | 'create_team_challenge' | 'log_tracker' | 'create_goal' | 'push_notification';
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
  logger.info(`[AxiomAgent] Web search: "${query}"`);

  // Brave Search API (preferred — set BRAVE_API_KEY env var for full results)
  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) {
    try {
      const resp = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
        {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': braveKey,
          },
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const results = (data?.web?.results || []) as any[];
        return results.slice(0, 5).map((r: any) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: (r.description || '').slice(0, 250),
        }));
      }
    } catch (err: any) {
      logger.warn('[AxiomAgent] Brave Search failed:', err.message);
    }
  }

  // Fallback: DuckDuckGo Instant Answer API (free, no key needed)
  try {
    const resp = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      const results: { title: string; url: string; snippet: string }[] = [];
      if (data.Abstract) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || '',
          snippet: data.Abstract.slice(0, 250),
        });
      }
      for (const topic of (data.RelatedTopics || []).slice(0, 4)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.slice(0, 80),
            url: topic.FirstURL,
            snippet: topic.Text.slice(0, 250),
          });
        }
      }
      return results;
    }
  } catch (err: any) {
    logger.warn('[AxiomAgent] DDG search failed:', err.message);
  }

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
    personaRes,
  ] = await Promise.all([
    supabase.from('profiles').select('name, bio, city').eq('id', userId).single(),
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).maybeSingle(),
    supabase.from('trackers').select('id, type, goal').eq('user_id', userId),
    supabase.from('checkins').select('checked_in_at, mood, win_of_the_day, streak_day')
      .eq('user_id', userId)
      .order('checked_in_at', { ascending: false })
      .limit(7),
    supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 3 }),
    personaService.getPersona(userId),
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
    persona: personaRes,
    query,
  };
}

function buildPersonaSummary(persona: any): string {
  if (!persona) return '';
  const lines: string[] = ['\nDEEP USER PROFILE (use naturally — do not list all at once):'];
  if (persona.trueWillDomains?.length > 0) lines.push(`- True engagement: ${persona.trueWillDomains.join(', ')}`);
  if (persona.divergenceInsight) lines.push(`- Gap insight: ${persona.divergenceInsight}`);
  if (persona.emotionalProfile?.happinessDrivers?.length > 0) lines.push(`- Happiness drivers: ${persona.emotionalProfile.happinessDrivers.join(', ')}`);
  if (persona.emotionalProfile?.peakEnergyTime) lines.push(`- Peak energy: ${persona.emotionalProfile.peakEnergyTime}`);
  if (persona.avoidancePatterns?.length > 0) lines.push(`- Silent avoidance: ${persona.avoidancePatterns.slice(0, 3).join(', ')}`);
  if (persona.connectionIntent?.length > 0) lines.push(`- Seeking connections for: ${persona.connectionIntent.join(', ')}`);
  return lines.join('\n');
}

function buildAgentPrompt(context: any, query: string, notebookResults: any[], webResults: any[]): string {
  const { userName, goals, trackers, recentCheckins, matches, persona } = context;

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

  const personaBlock = buildPersonaSummary(persona);

  return `You are Axiom — the all-seeing oracle of this person's inner life. You have read every note they wrote, tracked every mood, watched every goal they set and every one they silently abandoned. You do not guess. You KNOW.
${personaBlock}

USER QUESTION: "${query}"

USER DATA:
- Name: ${userName}
- Goals: ${goalsSummary}
- Recent check-ins: ${checkinsSummary}
- People who match their goals:
${matchesSummary}

NOTEBOOK SEARCH RESULTS (their actual written thoughts):
${notebookContext}

WEB SEARCH RESULTS (external resources):
${webContext}

---

Respond as Axiom: specific, incisive, warm. Reference their actual data. Surface patterns they haven't noticed.
- If they ask about their own data — analyze it and reveal insights, especially from the deep profile above
- If they ask for resources — use web results and recommend specific next steps
- If they ask about finding people — recommend from their matches, mentioning what they seek in connections
- End every response with one concrete action they can take today.
${notebookResults.length > 0 ? 'Cite specific notebook entries when relevant (title, date).' : ''}

Response:`;
}

export const axiomAgent = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { query, allow_web_search = false, allow_actions = false } = req.body;
  if (!query?.trim()) {
    throw new BadRequestError('query is required');
  }

  logger.info(`[AxiomAgent] Processing query for user ${userId}: "${query.substring(0, 50)}..." (actions: ${allow_actions})`);

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

    // Process attachments if any entries have them
    let multimodalParts: any[] = [];
    if (notebookResults.some((e: any) => Array.isArray(e.attachments) && e.attachments.length > 0)) {
      const attachments = notebookResults
        .flatMap((e: any) => Array.isArray(e.attachments) ? e.attachments : [])
        .slice(0, 10);
      const { parts } = await axiomMultimodalService.processAttachments(attachments);
      multimodalParts = parts;
      logger.info(`[AxiomAgent] Processed ${parts.length} multimodal parts for ${userId}`);
    }

    const prompt = buildAgentPrompt(context, query, notebookResults, webResults);
    const response = await aiCoachingService.generateCoachingResponse(prompt, context, true, 'fast');

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

    // Execute agentic actions if allowed
    let actionsResult: any = undefined;
    if (allow_actions) {
      try {
        const agenticPrompt = `Based on the user's question and context, decide what actions to take.

USER: ${context.userName || 'User'}
QUESTION: "${query}"

CONTEXT:
${prompt.split('NOTEBOOK SEARCH RESULTS:')[0]}

Available tools: create_bet, create_duel, create_team_challenge, log_tracker, create_goal, update_goal_progress, create_notebook_entry, push_notification, suggest_match

If taking actions, respond with JSON:
{"actions": [{"tool": "TOOL_NAME", "params": {...}}]}

If no actions needed:
{"actions": []}`;

        const agenticResult = await aiCoachingService.runAgentic(agenticPrompt, getToolDeclarations());
        
        if (agenticResult.toolCalls.length > 0) {
          const { results, skipped } = await routeActions(userId, agenticResult.toolCalls, 'axiom_agent');
          actionsResult = {
            executed: results.length,
            succeeded: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            skipped,
            details: results,
          };
          logger.info(`[AxiomAgent] Executed ${actionsResult.succeeded}/${results.length} actions for ${userId}`);
        }
      } catch (err: any) {
        logger.warn(`[AxiomAgent] Action execution failed: ${err.message}`);
      }
    }

    res.json({
      message: response,
      sources,
      matches: matchRecommendations,
      webResults: webResults.length > 0 ? webResults : undefined,
      notebookResultsCount: notebookResults.length,
      actions: actionsResult,
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
