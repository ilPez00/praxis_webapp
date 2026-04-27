import { Request, Response, NextFunction } from 'express';
import { MatchingEngineService } from '../services/MatchingEngineService';
import { supabase } from '../lib/supabaseClient';
import { GoalTree } from '../models/GoalTree';
import logger from '../utils/logger';
import { catchAsync } from '../utils/appErrors';

const matchingEngine = new MatchingEngineService();

const MATCH_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

const GOAL_WEIGHT = 0.50;
const TEXT_WEIGHT = 0.35;
const GEO_WEIGHT = 0.10;
const RELIABILITY_WEIGHT = 0.05;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function geoProximityScore(lat1?: number, lon1?: number, lat2?: number, lon2?: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const km = haversineDistance(lat1, lon1, lat2, lon2);
  return Math.max(0, 1 - km / 10000);
}

function computeCompositeScore(
  goalScore: number,
  textScore: number | undefined,
  geoScore: number,
  reliabilityScore: number
): number {
  return (
    goalScore * GOAL_WEIGHT +
    (textScore ?? 0) * TEXT_WEIGHT +
    geoScore * GEO_WEIGHT +
    reliabilityScore * RELIABILITY_WEIGHT
  );
}

export const getMatchesForUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const domainFilter = req.query.domain as string | undefined;

  if (!userId || userId === 'none') return res.json([]);

  const cacheKey = `${userId}-${domainFilter || 'all'}`;
  const cached = MATCH_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }

  const startTime = Date.now();

  // 1. Goal-based matches (pgvector)
  let goalMatchMap = new Map<string, number>();
  try {
    const { data: rpcMatches, error: rpcError } = await supabase.rpc('match_users_by_goals', {
      query_user_id: userId,
      match_limit: 40,
    });

    if (!rpcError && rpcMatches && rpcMatches.length > 0) {
      for (const m of rpcMatches) {
        goalMatchMap.set(m.matched_user_id, m.score);
      }
    }
  } catch (err: any) {
    logger.warn(`[Matching] pgvector failed: ${err.message}.`);
  }

  // Fallback: structural comparison if pgvector failed
  if (goalMatchMap.size === 0) {
    logger.info(`[Matching] Running fallback path for ${userId}...`);
    const { data: userGoalTree } = await supabase
      .from('goal_trees').select('id, user_id, nodes, root_nodes').eq('user_id', userId).single();

    if (userGoalTree) {
      const { data: others } = await supabase
        .from('goal_trees').select('id, user_id, nodes, root_nodes').neq('user_id', userId).limit(40);

      for (const other of (others || [])) {
        const score = await matchingEngine.calculateCompatibilityScore(userGoalTree as GoalTree, other as GoalTree);
        if (score >= 0) {
          goalMatchMap.set((other as any).user_id, Math.max(score, 0.01));
        }
      }
    }
  }

  // If still no matches, fallback to showing random profiles
  if (goalMatchMap.size === 0) {
    const { data: allProfiles } = await supabase
      .from('profiles').select('id').neq('id', userId).limit(20);

    if (allProfiles) {
      for (const p of allProfiles) {
        goalMatchMap.set(p.id, 0.01);
      }
    }
  }

  const candidateIds = [...goalMatchMap.keys()];

  // 2. Text affinity scores (profile embeddings — optional, no throw)
  let textScoreMap = new Map<string, number>();
  try {
    const { data: textMatches } = await supabase.rpc('match_profiles_by_text', {
      query_user_id: userId,
      match_limit: 40,
    });

    if (textMatches) {
      for (const m of textMatches) {
        textScoreMap.set(m.matched_user_id, m.text_score);
      }
    }
  } catch {
    // text affinity unavailable (no embeddings yet, or pgvector down) — skip
  }

  // 3. Fetch profile data for all candidates (including geo + reliability)
  const [{ data: profiles }, { data: trees }, { data: queryProfile }] = await Promise.all([
    supabase.from('profiles').select('id, name, avatar_url, bio, current_streak, last_activity_date, latitude, longitude, reliability_score').in('id', candidateIds),
    supabase.from('goal_trees').select('user_id, nodes').in('user_id', candidateIds),
    supabase.from('profiles').select('latitude, longitude').eq('id', userId).single(),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const treeMap = new Map((trees ?? []).map((t: any) => [t.user_id, t.nodes ?? []]));

  const queryLat = queryProfile?.latitude;
  const queryLon = queryProfile?.longitude;

  // 4. Composite scores
  const composite = candidateIds.map(userId => {
    const p = profileMap.get(userId);
    const nodes = treeMap.get(userId) ?? [];
    const domains = [...new Set<string>(nodes.map((n: any) => n.domain).filter(Boolean))];

    if (domainFilter && !domains.includes(domainFilter)) return null;

    const goalScore = goalMatchMap.get(userId) ?? 0;
    const textScore = textScoreMap.get(userId);
    const geoScore = geoProximityScore(queryLat, queryLon, p?.latitude, p?.longitude);
    const reliability = p?.reliability_score ?? 0;
    const compositeScore = computeCompositeScore(goalScore, textScore, geoScore, reliability);

    const sharedGoals = nodes
      .filter((n: any) => n.name && typeof n.progress === 'number')
      .sort((a: any, b: any) => b.progress - a.progress)
      .slice(0, 3)
      .map((n: any) => n.name);

    return {
      userId,
      score: compositeScore,
      goalScore,
      textAffinity: textScore ?? 0,
      name: p?.name ?? `User ${userId.slice(0, 6)}`,
      avatarUrl: p?.avatar_url,
      bio: p?.bio,
      currentStreak: p?.current_streak ?? 0,
      lastCheckinDate: p?.last_activity_date,
      latitude: p?.latitude,
      longitude: p?.longitude,
      domains,
      sharedGoals,
    };
  }).filter(Boolean);

  composite.sort((a, b) => b!.score - a!.score);

  logger.info(`[Matching] Composite match complete (${Date.now() - startTime}ms) for ${userId} — ${composite.length} results`);

  MATCH_CACHE.set(cacheKey, { data: composite, timestamp: Date.now() });
  res.json(composite);
});
