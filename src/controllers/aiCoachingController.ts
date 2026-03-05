import { Request, Response, NextFunction } from 'express';
import { AICoachingService, CoachingContext } from '../services/AICoachingService';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, UnauthorizedError, InternalServerError } from '../utils/appErrors';

// Instantiate once at module load — constructor no longer throws if API key missing
const aiCoachingService = new AICoachingService();

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('does not exist') || msg?.includes('42P01');

/** Converts a raw Gemini error into a short, user-friendly message. */
function friendlyAiError(err: any): { message: string; code: string } {
  const msg: string = err?.message || String(err) || '';
  if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('too many requests')) {
    return {
      code: 'QUOTA_EXCEEDED',
      message: "Roshi is resting — the AI service has hit its daily limit. He'll be back soon. (Upgrade the Gemini API plan to remove this limit.)",
    };
  }
  if (msg.includes('GEMINI_API_KEY') || msg.toLowerCase().includes('api key')) {
    return { code: 'NOT_CONFIGURED', message: 'Master Roshi is offline — AI service not configured on this server.' };
  }
  return { code: 'UNKNOWN', message: 'Master Roshi is temporarily unavailable. Please try again in a moment.' };
}

// ---------------------------------------------------------------------------
// Rate limiter for background brief generation (in-memory, resets on deploy)
// ---------------------------------------------------------------------------

const briefCooldowns = new Map<string, number>();
const BRIEF_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

async function generateAndStoreBrief(userId: string): Promise<void> {
  const context = await buildContext(userId);
  const report = await aiCoachingService.generateFullReport(context);
  const { error } = await supabase
    .from('coaching_briefs')
    .upsert({ user_id: userId, brief: report, generated_at: new Date().toISOString() });
  if (error) {
    if (SCHEMA_MISSING(error.message)) {
      logger.warn('[AI Coach] coaching_briefs table missing — brief generated but not cached. Run migrations.');
    } else {
      logger.warn(`[AI Coach] Failed to cache brief for ${userId}:`, error.message);
    }
  } else {
    logger.info(`[AI Coach] Brief stored for user ${userId}`);
  }
}

// ---------------------------------------------------------------------------
// Context builder — gathers everything Gemini needs about the user
// ---------------------------------------------------------------------------

async function buildContext(userId: string): Promise<CoachingContext> {
  const [profileRes, goalTreeRes, feedbackRes, achievementsRes, boardMembershipsRes, dmPartnersRes] =
    await Promise.allSettled([
      // 1. Profile
      supabase
        .from('profiles')
        .select('name, bio, current_streak, praxis_points')
        .eq('id', userId)
        .single(),

      // 2. Goal tree
      supabase
        .from('goal_trees')
        .select('nodes')
        .eq('userId', userId)
        .maybeSingle(),

      // 3. Recent feedback (received by this user)
      // Column names: try both camelCase (legacy) and snake_case — maybeSingle gracefully handles missing table
      supabase
        .from('feedback')
        .select('grade, comment')
        .or(`receiverId.eq.${userId},receiver_id.eq.${userId}`)
        .limit(5),

      // 4. Achievements
      supabase
        .from('achievements')
        .select('title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),

      // 5. Joined community boards
      supabase
        .from('chat_room_members')
        .select('chat_rooms(name, domain, description)')
        .eq('user_id', userId),

      // 6. DM conversation partner IDs (people they've messaged)
      supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .is('room_id', null) // DMs only, not group messages
        .limit(100),
    ]);

  // --- Profile ---
  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
  const userName = profile?.name || 'User';
  const bio = profile?.bio || undefined;
  const streak = profile?.current_streak ?? 0;
  const praxisPoints = profile?.praxis_points ?? 0;

  // --- Goals ---
  const rawNodes: any[] = goalTreeRes.status === 'fulfilled'
    ? (goalTreeRes.value.data?.nodes ?? [])
    : [];

  const goals = rawNodes.map((n: any) => ({
    name: n.name || n.title || 'Unnamed goal',
    domain: n.domain || 'General',
    progress: Math.round((n.progress ?? 0) * (n.progress <= 1 ? 100 : 1)), // normalise 0-1 or 0-100
    description: n.customDetails || undefined,
    completionMetric: n.completionMetric || undefined,
    targetDate: n.targetDate || undefined,
  }));

  // --- Feedback ---
  const rawFeedback: any[] = feedbackRes.status === 'fulfilled' ? (feedbackRes.value.data ?? []) : [];
  const recentFeedback = rawFeedback.map((fb: any) => ({
    grade: fb.grade,
    comment: fb.comment || undefined,
    giverName: 'Peer', // avoid extra join; giver name is secondary info
    goalName: 'Goal',
  }));

  // --- Achievements ---
  const rawAchievements: any[] = achievementsRes.status === 'fulfilled'
    ? (achievementsRes.value.data ?? [])
    : [];

  const achievements = rawAchievements.map((a: any) => ({
    goalName: a.title || 'Achievement',
    date: a.created_at ? new Date(a.created_at).toLocaleDateString() : 'recently',
  }));

  // --- Boards ---
  const rawBoardMemberships: any[] = boardMembershipsRes.status === 'fulfilled'
    ? (boardMembershipsRes.value.data ?? [])
    : [];

  const boards = rawBoardMemberships
    .map((m: any) => m.chat_rooms)
    .filter(Boolean)
    .map((r: any) => ({
      name: r.name || 'Unnamed board',
      domain: r.domain || undefined,
      description: r.description || undefined,
    }));

  // --- Network: resolve DM partner IDs → profiles + goal domains ---
  let network: CoachingContext['network'] = [];

  if (dmPartnersRes.status === 'fulfilled') {
    const msgs: any[] = dmPartnersRes.value.data ?? [];
    const partnerIdSet = new Set<string>();
    for (const m of msgs) {
      const other = m.sender_id === userId ? m.receiver_id : m.sender_id;
      if (other) partnerIdSet.add(other);
    }
    const partnerIds = Array.from(partnerIdSet).slice(0, 10); // cap at 10 contacts

    if (partnerIds.length > 0) {
      const [partnerProfilesRes, partnerTreesRes] = await Promise.allSettled([
        supabase.from('profiles').select('id, name').in('id', partnerIds),
        supabase.from('goal_trees').select('userId, nodes').in('userId', partnerIds),
      ]);

      const partnerProfiles: any[] =
        partnerProfilesRes.status === 'fulfilled' ? (partnerProfilesRes.value.data ?? []) : [];
      const partnerTrees: any[] =
        partnerTreesRes.status === 'fulfilled' ? (partnerTreesRes.value.data ?? []) : [];

      // Build a domain list per partner from their root goal nodes
      const domainsByUser = new Map<string, string[]>();
      for (const tree of partnerTrees) {
        const domains = (tree.nodes ?? [])
          .filter((n: any) => !n.parentId)
          .map((n: any) => n.domain)
          .filter(Boolean);
        domainsByUser.set(tree.userId, Array.from(new Set(domains)));
      }

      network = partnerProfiles.map((p: any) => ({
        name: p.name || 'A connection',
        domains: domainsByUser.get(p.id) ?? [],
      }));
    }
  }

  return { userName, bio, streak, praxisPoints, goals, recentFeedback, achievements, network, boards };
}

// ---------------------------------------------------------------------------
// POST /ai-coaching/report — auto-generated full coaching report
// ---------------------------------------------------------------------------

export const requestReport = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('User ID not found.');

  if (!aiCoachingService.isConfigured) {
    return res.status(503).json({
      message: 'Master Roshi is offline — the AI service is not configured on this server. Please set GEMINI_API_KEY on Railway.',
    });
  }

  logger.info(`[AI Coach] Generating full report for user ${userId}`);

  try {
    const context = await buildContext(userId);
    const report = await aiCoachingService.generateFullReport(context);
    res.json(report);
  } catch (err: any) {
    logger.error('[AI Coach] Report generation failed:', err.message);
    const { message, code } = friendlyAiError(err);
    return res.status(503).json({ message, code });
  }
});

// ---------------------------------------------------------------------------
// GET /ai-coaching/brief — return cached brief (instant, no generation)
// ---------------------------------------------------------------------------

export const getBrief = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { data, error } = await supabase
    .from('coaching_briefs')
    .select('brief, generated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && SCHEMA_MISSING(error.message)) {
    // Table hasn't been created yet — return null so client falls back to inline generation
    return res.json(null);
  }

  res.json(data ?? null);
});

// ---------------------------------------------------------------------------
// GET /ai-coaching/weekly-narrative — short Roshi "this week" summary
// ---------------------------------------------------------------------------

// In-memory cache: userId → { narrative, generatedAt }
const narrativeCache = new Map<string, { narrative: string; generatedAt: number }>();
const NARRATIVE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const getWeeklyNarrative = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  // Serve from cache if fresh
  const cached = narrativeCache.get(userId);
  if (cached && Date.now() - cached.generatedAt < NARRATIVE_COOLDOWN_MS) {
    return res.json({ narrative: cached.narrative, cached: true });
  }

  if (!aiCoachingService.isConfigured) {
    return res.status(503).json({ message: 'AI service not configured.' });
  }

  // Gather weekly stats
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [profileRes, checkinsRes, goalTreeRes] = await Promise.allSettled([
    supabase.from('profiles').select('name, current_streak').eq('id', userId).single(),
    supabase.from('checkins').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('checked_in_at', sevenDaysAgo.toISOString()),
    supabase.from('goal_trees').select('nodes').eq('userId', userId).maybeSingle(),
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
  const checkinsCount: number = checkinsRes.status === 'fulfilled' ? (checkinsRes.value.count ?? 0) : 0;
  const nodes: any[] = goalTreeRes.status === 'fulfilled' ? (goalTreeRes.value.data?.nodes ?? []) : [];

  // Find top goal (highest progress root node)
  const rootNodes = nodes.filter(n => !n.parentId);
  const topNode = rootNodes.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];
  const avgProgress = rootNodes.length > 0
    ? Math.round(rootNodes.reduce((s, n) => s + (n.progress ?? 0), 0) / rootNodes.length)
    : undefined;

  try {
    const narrative = await aiCoachingService.generateWeeklyNarrative({
      userName: profile?.name || 'there',
      streak: profile?.current_streak ?? 0,
      checkinsThisWeek: checkinsCount,
      topGoal: topNode ? (topNode.name || topNode.title) : undefined,
      topDomain: topNode?.domain,
      overallProgress: avgProgress,
    });

    narrativeCache.set(userId, { narrative, generatedAt: Date.now() });
    return res.json({ narrative, cached: false });
  } catch (err: any) {
    logger.error('[AI Coach] Weekly narrative failed:', err.message);
    const { message, code } = friendlyAiError(err);
    return res.status(503).json({ message, code });
  }
});

// ---------------------------------------------------------------------------
// POST /ai-coaching/trigger — kick off a background brief update (rate limited)
// ---------------------------------------------------------------------------

export const triggerBriefUpdate = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const now = Date.now();
  const last = briefCooldowns.get(userId) ?? 0;
  const remaining = BRIEF_COOLDOWN_MS - (now - last);

  if (remaining > 0) {
    return res.json({ queued: false, cooldownSeconds: Math.ceil(remaining / 1000) });
  }

  briefCooldowns.set(userId, now);

  // Fire-and-forget — client doesn't wait for this
  generateAndStoreBrief(userId).catch(err =>
    logger.warn(`[AI Coach] Background brief failed for ${userId}:`, err.message)
  );

  res.json({ queued: true });
});

// ---------------------------------------------------------------------------
// POST /ai-coaching/request — follow-up conversational question
// ---------------------------------------------------------------------------

export const requestCoaching = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const { userPrompt } = req.body;
  const userId = req.user?.id;

  if (!userId) throw new UnauthorizedError('User ID not found.');
  if (!userPrompt?.trim()) {
    return res.status(400).json({ message: 'userPrompt is required.' });
  }

  if (!aiCoachingService.isConfigured) {
    return res.status(503).json({
      message: 'Master Roshi is offline — the AI service is not configured on this server.',
    });
  }

  try {
    const context = await buildContext(userId);
    const response = await aiCoachingService.generateCoachingResponse(userPrompt.trim(), context);
    res.json({ response });
  } catch (err: any) {
    logger.error('[AI Coach] Follow-up generation failed:', err.message);
    const { message, code } = friendlyAiError(err);
    return res.status(503).json({ message, code });
  }
});
