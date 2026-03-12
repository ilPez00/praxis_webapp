import { Request, Response, NextFunction } from 'express';
import { MatchingEngineService } from '../services/MatchingEngineService';
import { supabase } from '../lib/supabaseClient';
import { GoalTree } from '../models/GoalTree';
import logger from '../utils/logger';
import { catchAsync, InternalServerError } from '../utils/appErrors';

const matchingEngine = new MatchingEngineService();

// Simple in-memory cache for match results (5 minutes TTL)
const MATCH_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export const getMatchesForUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  const domainFilter = req.query.domain as string | undefined;

  if (!userId || userId === 'none') return res.json([]);

  // Check cache
  const cacheKey = `${userId}-${domainFilter || 'all'}`;
  const cached = MATCH_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }

  const startTime = Date.now();

  // 1. Try pgvector RPC first (Super Fast)
  try {
    const { data: rpcMatches, error: rpcError } = await supabase.rpc('match_users_by_goals', {
      query_user_id: userId,
      match_limit: 40,
    });

    if (!rpcError && rpcMatches && rpcMatches.length > 0) {
      logger.info(`[Matching] pgvector success (${Date.now() - startTime}ms) for ${userId}`);
      const enriched = await enrichMatches(rpcMatches.map((m: any) => ({ userId: m.matched_user_id, score: m.score })));
      
      let results = enriched;
      if (domainFilter) {
        results = results.filter((r: any) => r.domains.includes(domainFilter));
      }

      MATCH_CACHE.set(cacheKey, { data: results, timestamp: Date.now() });
      return res.json(results);
    }
  } catch (err: any) {
    logger.warn(`[Matching] pgvector failed: ${err.message}. Falling back.`);
  }

  // 2. Fallback: Structural Comparison (Still fast, O(N))
  logger.info(`[Matching] Running fallback path for ${userId}...`);
  const { data: userGoalTree } = await supabase.from('goal_trees').select('*').eq('userId', userId).single();
  
  if (!userGoalTree) return res.json([]);

  const { data: others } = await supabase.from('goal_trees').select('*').neq('userId', userId).limit(40);
  
  const matches = [];
  for (const other of (others || [])) {
    const score = await matchingEngine.calculateCompatibilityScore(userGoalTree as GoalTree, other as GoalTree);
    if (score > 0.1) {
      matches.push({ userId: other.userId, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const enriched = await enrichMatches(matches);
  
  let finalResults = enriched;
  if (domainFilter) {
    finalResults = finalResults.filter((r: any) => r.domains.includes(domainFilter));
  }

  logger.info(`[Matching] Fallback path complete (${Date.now() - startTime}ms) for ${userId}`);
  MATCH_CACHE.set(cacheKey, { data: finalResults, timestamp: Date.now() });
  res.json(finalResults);
});

async function enrichMatches(rawMatches: { userId: string; score: number }[]): Promise<any[]> {
  if (rawMatches.length === 0) return [];
  const userIds = rawMatches.map(m => m.userId);

  const [{ data: profiles }, { data: trees }] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_url, bio, current_streak, last_activity_date').in('id', userIds),
    supabase.from('goal_trees').select('userId, nodes').in('userId', userIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const treeMap = new Map((trees ?? []).map((t: any) => [t.userId, t.nodes ?? []]));

  return rawMatches.map(m => {
    const p = profileMap.get(m.userId);
    const nodes = treeMap.get(m.userId) ?? [];
    const domains = [...new Set<string>(nodes.map((n: any) => n.domain).filter(Boolean))];
    const sharedGoals = nodes
      .filter((n: any) => n.name && typeof n.progress === 'number')
      .sort((a: any, b: any) => b.progress - a.progress)
      .slice(0, 3)
      .map((n: any) => n.name);

    return {
      userId: m.userId,
      score: m.score,
      name: p?.name ?? `User ${m.userId.slice(0, 6)}`,
      avatarUrl: p?.avatar_url,
      bio: p?.bio,
      currentStreak: p?.current_streak ?? 0,
      lastCheckinDate: p?.last_activity_date,
      domains,
      sharedGoals,
    };
  });
}
