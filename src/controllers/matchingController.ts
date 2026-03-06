import { Request, Response, NextFunction } from 'express'; // Import NextFunction
import { MatchingEngineService } from '../services/MatchingEngineService';
import { supabase } from '../lib/supabaseClient';
import { GoalTree } from '../models/GoalTree';
import { User } from '../models/User'; // Assuming a User model exists
import logger from '../utils/logger'; // Import the logger
import { catchAsync, NotFoundError, InternalServerError } from '../utils/appErrors'; // Import custom errors and catchAsync

const matchingEngine = new MatchingEngineService();

export const getMatchesForUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  const domainFilter = req.query.domain as string | undefined;

  // --- Fast path: pgvector RPC (requires goal_embeddings table + GEMINI_API_KEY) ---
  try {
    const { data: rpcMatches, error: rpcError } = await supabase.rpc('match_users_by_goals', {
      query_user_id: userId,
      match_limit: 20,
    });
    if (!rpcError && rpcMatches && rpcMatches.length > 0) {
      logger.info(`pgvector matched ${rpcMatches.length} users for ${userId}`);
      let results = rpcMatches.map((m: { matched_user_id: string; score: number }) => ({
        userId: m.matched_user_id,
        score: Math.min(1, Math.max(0, m.score)),
        sharedGoals: [] as { domain: string }[],
      }));
      if (domainFilter) {
        results = results.filter((r: { userId: string; score: number; sharedGoals: { domain: string }[] }) =>
          r.sharedGoals.some((g: { domain: string }) => g.domain === domainFilter)
        );
      }
      return res.json(results.map((r: { userId: string; score: number }) => ({ userId: r.userId, score: r.score })));
    }
  } catch (_) {
    // pgvector not available or table missing — fall through to O(n²) approach
  }

  // --- Slow path: O(n²) goal tree comparison ---

  // 1. Fetch the requesting user's goal tree + proficiency
  const [{ data: userGoalTree, error: userGoalTreeError }, { data: userProfile }] = await Promise.all([
    supabase.from('goal_trees').select('*').eq('userId', userId).single(),
    supabase.from('profiles').select('domain_proficiency').eq('id', userId).single(),
  ]);

  if (userGoalTreeError && userGoalTreeError.code !== 'PGRST116') {
    logger.error('Supabase error fetching user goal tree:', userGoalTreeError.message);
    throw new InternalServerError('Failed to fetch user goal tree.');
  }
  if (!userGoalTree) {
    throw new NotFoundError('User goal tree not found.');
  }

  // 2. Fetch all other users' goal trees + profiles (for domain_proficiency)
  const [{ data: allGoalTrees, error: allGoalTreesError }, { data: otherProfiles }] = await Promise.all([
    supabase.from('goal_trees').select('*').neq('userId', userId),
    supabase.from('profiles').select('id, domain_proficiency').neq('id', userId),
  ]);

  if (allGoalTreesError) {
    logger.error('Supabase error fetching all other goal trees:', allGoalTreesError.message);
    throw new InternalServerError('Failed to fetch other users\' goal trees.');
  }

  const userNodes: any[] = (userGoalTree as GoalTree).nodes || [];
  const myDomains = new Set<string>(userNodes.map((n: any) => n.domain).filter(Boolean));
  const myProficiency: Record<string, number> = (userProfile as any)?.domain_proficiency ?? {};

  // Build a profile map for quick lookup
  const profileProfMap = new Map<string, Record<string, number>>();
  for (const p of (otherProfiles ?? [])) {
    profileProfMap.set(p.id, (p as any).domain_proficiency ?? {});
  }

  const potentialMatches: { user: string; score: number; goalTree: GoalTree; sharedGoals: { domain: string }[] }[] = [];

  for (const otherGoalTree of allGoalTrees || []) {
    const baseScore = await matchingEngine.calculateCompatibilityScore(userGoalTree as GoalTree, otherGoalTree as GoalTree);

    const otherNodes: any[] = (otherGoalTree as GoalTree).nodes || [];
    const otherDomains = new Set<string>(otherNodes.map((n: any) => n.domain).filter(Boolean));
    const otherProficiency: Record<string, number> = profileProfMap.get(otherGoalTree.userId) ?? {};

    // Proficiency alignment bonus: average of (my proficiency in their domains) + (their proficiency in my domains)
    let profBonus = 0;
    if (myDomains.size > 0 || otherDomains.size > 0) {
      let sumA = 0; let countA = 0;
      for (const d of Array.from(otherDomains)) { sumA += (myProficiency[d] ?? 0) / 100; countA++; }
      let sumB = 0; let countB = 0;
      for (const d of Array.from(myDomains)) { sumB += (otherProficiency[d] ?? 0) / 100; countB++; }
      const avgA = countA > 0 ? sumA / countA : 0;
      const avgB = countB > 0 ? sumB / countB : 0;
      profBonus = (avgA + avgB) / 2;
    }

    // Blend: 80% goal-tree score + 20% proficiency alignment
    const score = baseScore * 0.8 + profBonus * 0.2;

    if (score > 0) {
      const sharedGoals = otherNodes
        .filter((n: any) => n.domain && myDomains.has(n.domain))
        .map((n: any) => ({ domain: n.domain }));
      potentialMatches.push({ user: otherGoalTree.userId, score, goalTree: otherGoalTree as GoalTree, sharedGoals });
    }
  }

  // Sort by score in descending order
  potentialMatches.sort((a, b) => b.score - a.score);

  // Apply domain filter if provided
  const filtered = domainFilter
    ? potentialMatches.filter(match => match.sharedGoals.some(g => g.domain === domainFilter))
    : potentialMatches;

  res.json(filtered.map(match => ({ userId: match.user, score: match.score, sharedGoals: match.sharedGoals })));
});
