import { Request, Response, NextFunction } from 'express';
import { AICoachingService, CoachingContext } from '../services/AICoachingService';
import { AxiomScanService } from '../services/AxiomScanService';
import { EngagementMetricService } from '../services/EngagementMetricService';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, UnauthorizedError, InternalServerError } from '../utils/appErrors';

// Instantiate once at module load
const aiCoachingService = new AICoachingService();
const engagementMetricService = new EngagementMetricService();

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('does not exist') || msg?.includes('42P01');

/** Converts a raw Gemini error into a short, user-friendly message. 
 * If isAdmin is true, it appends the actual error message for debugging.
 */
function friendlyAiError(err: any, isAdmin: boolean = false): { message: string; code: string; detailed?: string } {
  const msg: string = err?.message || String(err) || '';
  let result: { code: string; message: string; detailed?: string };

  if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('too many requests')) {
    result = {
      code: 'QUOTA_EXCEEDED',
      message: "Axiom is resting — the AI service has hit its daily limit. If this persists, verify the GEMINI_API_KEY plan or billing in AI Studio.",
    };
  } else if (msg.includes('GEMINI_API_KEY') || msg.toLowerCase().includes('api key')) {
    result = { code: 'NOT_CONFIGURED', message: 'Axiom is offline — AI service not configured on this server.' };
  } else {
    result = { code: 'UNKNOWN', message: 'Axiom is temporarily unavailable. Please try again in a moment.' };
  }

  if (isAdmin) {
    result.detailed = msg;
  }
  return result;
}

// ---------------------------------------------------------------------------
// PP cost constants for free-tier Axiom access
// ---------------------------------------------------------------------------

const AXIOM_CHAT_COST = 50;       // PP per chat message (free tier)
const AXIOM_TRIGGER_COST = 100;   // PP to trigger an extra brief (free tier)

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
    item_type: amount === AXIOM_CHAT_COST ? 'axiom_chat' : 'axiom_brief_trigger',
    cost: amount,
    metadata: { label: amount === AXIOM_CHAT_COST ? 'Axiom chat message' : 'Axiom brief trigger' },
  });

  return true;
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
        .select('name, bio, current_streak, praxis_points, language')
        .eq('id', userId)
        .single(),

      // 2. Goal tree
      supabase
        .from('goal_trees')
        .select('nodes')
        .eq('user_id', userId)
        .maybeSingle(),

      // 3. Recent feedback (received by this user) - limit 3
      supabase
        .from('feedback')
        .select('grade, comment')
        .or(`receiverId.eq.${userId},receiver_id.eq.${userId}`)
        .limit(3),

      // 4. Achievements - limit 3
      supabase
        .from('achievements')
        .select('title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3),

      // 5. Joined community boards - limit 3
      supabase
        .from('chat_room_members')
        .select('chat_rooms(name, domain)')
        .eq('user_id', userId)
        .limit(3),

      // 6. DM conversation partner IDs - limit 50 for selection
      supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .is('room_id', null)
        .limit(50),
    ]);

  // --- Profile ---
  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
  const userName = (profile?.name || 'User').slice(0, 50);
  const bio = profile?.bio ? profile.bio.slice(0, 200) : undefined;
  const streak = profile?.current_streak ?? 0;
  const praxisPoints = profile?.praxis_points ?? 0;
  const language = profile?.language || 'en';

  // --- Goals (Token-optimized: only send root nodes or active sub-nodes) ---
  const rawNodes: any[] = goalTreeRes.status === 'fulfilled'
    ? (goalTreeRes.value.data?.nodes ?? [])
    : [];

  const goals = rawNodes
    .filter((n: any) => !n.parentId || (n.progress > 0 && n.progress < 1))
    .slice(0, 15) // limit total nodes sent
    .map((n: any) => ({
      name: (n.name || n.title || 'Goal').slice(0, 60),
      domain: n.domain || 'General',
      progress: Math.round((n.progress ?? 0) * (n.progress <= 1 ? 100 : 1)),
      description: n.customDetails ? n.customDetails.slice(0, 100) : undefined,
    }));

  // --- Feedback ---
  const rawFeedback: any[] = feedbackRes.status === 'fulfilled' ? (feedbackRes.value.data ?? []) : [];
  const recentFeedback = rawFeedback.map((fb: any) => ({
    grade: fb.grade,
    comment: fb.comment ? fb.comment.slice(0, 100) : undefined,
  }));

  // --- Achievements ---
  const rawAchievements: any[] = achievementsRes.status === 'fulfilled'
    ? (achievementsRes.value.data ?? [])
    : [];

  const achievements = rawAchievements.map((a: any) => ({
    goalName: (a.title || 'Achievement').slice(0, 60),
    date: a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : 'recently',
  }));

  // --- Boards ---
  const rawBoardMemberships: any[] = boardMembershipsRes.status === 'fulfilled'
    ? (boardMembershipsRes.value.data ?? [])
    : [];

  const boards = rawBoardMemberships
    .map((m: any) => m.chat_rooms)
    .filter(Boolean)
    .map((r: any) => ({
      name: r.name,
      domain: r.domain,
    }));

  // --- Network: limit to 5 partners ---
  let network: CoachingContext['network'] = [];

  if (dmPartnersRes.status === 'fulfilled') {
    const msgs: any[] = dmPartnersRes.value.data ?? [];
    const partnerIdSet = new Set<string>();
    for (const m of msgs) {
      const other = m.sender_id === userId ? m.receiver_id : m.sender_id;
      if (other) partnerIdSet.add(other);
    }
    const partnerIds = Array.from(partnerIdSet).slice(0, 5); // cap at 5 contacts

    if (partnerIds.length > 0) {
      const [partnerProfilesRes, partnerTreesRes] = await Promise.allSettled([
        supabase.from('profiles').select('id, name').in('id', partnerIds),
        supabase.from('goal_trees').select('user_id, nodes').in('user_id', partnerIds),
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
        domainsByUser.set(tree.user_id, Array.from(new Set(domains)));
      }

      network = partnerProfiles.map((p: any) => ({
        name: p.name || 'A connection',
        domains: domainsByUser.get(p.id) ?? [],
      }));
    }
  }

  // --- Engagement Metrics (for template personalization) ---
  // Fetch from cache or calculate on-demand
  let engagementMetrics: CoachingContext['engagementMetrics'];
  try {
    let metrics = await engagementMetricService.getCachedMetrics(userId);
    if (!metrics) {
      metrics = await engagementMetricService.calculateMetrics(userId);
      await engagementMetricService.storeMetrics(userId, metrics);
    }
    engagementMetrics = {
      archetype: metrics.archetype,
      motivationStyle: metrics.motivationStyle,
      weeklyActivityScore: metrics.weeklyActivityScore,
      stagnationRisk: metrics.stagnationRisk,
    };
  } catch (err) {
    logger.warn('[AI Coach] Failed to load engagement metrics:', err);
    engagementMetrics = undefined;
  }

  return { 
    userName, 
    bio, 
    streak, 
    praxisPoints, 
    language, 
    goals, 
    recentFeedback, 
    achievements, 
    network, 
    boards,
    engagementMetrics,
  };
}

// ---------------------------------------------------------------------------
// POST /ai-coaching/report — auto-generated full coaching report
// ---------------------------------------------------------------------------

export const requestReport = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('User ID not found.');

  // Fetch profile for admin status and minimal_ai_mode setting
  const { data: profile } = await supabase.from('profiles').select('is_admin, minimal_ai_mode').eq('id', userId).single();
  const isAdmin = !!profile?.is_admin;
  const useLLM = !profile?.minimal_ai_mode; // true = premium LLM, false = template mode

  if (!aiCoachingService.isConfigured) {
    return res.status(503).json({
      message: 'Axiom is offline — the AI service is not configured on this server. Please set GEMINI_API_KEY on Railway.',
      detailed: isAdmin ? 'genAI instance is null in AICoachingService' : undefined
    });
  }

  logger.info(`[AI Coach] Generating full report for user ${userId} (useLLM: ${useLLM})`);

  try {
    const context = await buildContext(userId);
    const report = await aiCoachingService.generateFullReport(context, useLLM);
    res.json(report);
  } catch (err: any) {
    logger.error('[AI Coach] Report generation failed:', err.message);
    const { message, code, detailed } = friendlyAiError(err, isAdmin);
    return res.status(503).json({ message, code, detailed });
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

  res.json(data || null);
  });

  /**
  * GET /ai-coaching/daily-brief — returns the midnight automated scan result
  */
  export const getDailyBrief = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('User ID not found.');

  const { data, error } = await supabase
    .from('axiom_daily_briefs')
    .select('brief, generated_at')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Error fetching daily brief:', error.message);
  }

  res.json(data || null);
  });


// ---------------------------------------------------------------------------
// POST /ai-coaching/weekly-narrative — short Axiom "this week" summary
// ---------------------------------------------------------------------------

export const getWeeklyNarrative = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  // Fetch minimal_ai_mode setting
  const { data: profile } = await supabase.from('profiles').select('language, minimal_ai_mode').eq('id', userId).single();
  const useLLM = !profile?.minimal_ai_mode; // true = premium LLM, false = template mode

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  const [journalRes, checkinRes, goalRes] = await Promise.all([
    supabase.from('node_journal_entries')
      .select('node_id, note, mood, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: true }),
    supabase.from('checkins')
      .select('streak_day, mood, win_of_the_day, checked_in_at')
      .eq('user_id', userId)
      .gte('checked_in_at', since),
    supabase.from('goal_trees')
      .select('nodes')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const entries = journalRes.data ?? [];
  const checkins = checkinRes.data ?? [];
  const nodes: any[] = goalRes.data?.nodes ?? [];
  const nodeMap: Record<string, string> = {};
  nodes.forEach((n: any) => { nodeMap[n.id] = n.name || n.title || 'Goal'; });

  const journalText = entries.length > 0
    ? entries.map((e: any) => `[${e.logged_at.slice(0, 10)}] ${nodeMap[e.node_id] ?? e.node_id} ${e.mood ?? ''}: ${e.note ?? '(no note)'}`).join('\n')
    : 'No journal entries this week.';

  const checkinText = checkins.length > 0
    ? `${checkins.length}/7 days checked in. Wins: ${(checkins as any[]).map((c: any) => c.win_of_the_day).filter(Boolean).join(', ') || 'none logged'}.`
    : 'No check-ins this week.';

  const stats = {
    language: profile?.language || 'en',
    checkinsThisWeek: checkins.length,
    goalsUpdatedThisWeek: nodes.filter((n: any) => n.updated_at && new Date(n.updated_at) >= sevenDaysAgo).length,
    journalEntries: entries.length,
  };

  try {
    const narrative = await aiCoachingService.generateWeeklyNarrative(stats, useLLM);
    res.json({ narrative, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    const { message, code, detailed } = friendlyAiError(err);
    res.status(503).json({ message, code, detailed });
  }
});

// ---------------------------------------------------------------------------
// POST /ai-coaching/trigger — kick off a background brief update (rate limited)
// ---------------------------------------------------------------------------

export const triggerBriefUpdate = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  // Free-tier: charge PP
  const { data: profile } = await supabase.from('profiles').select('is_premium, is_admin, praxis_points').eq('id', userId).single();
  const isPro = profile?.is_premium || profile?.is_admin;

  if (!isPro) {
    const balance: number = profile?.praxis_points ?? 0;
    if (balance < AXIOM_TRIGGER_COST) {
      return res.status(402).json({
        error: 'INSUFFICIENT_POINTS',
        message: `Triggering an extra Axiom brief costs ${AXIOM_TRIGGER_COST} PP. You have ${balance} PP.`,
        needed: AXIOM_TRIGGER_COST,
        have: balance,
      });
    }
    await deductPP(userId, AXIOM_TRIGGER_COST);
  }

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
  const { userPrompt, useBoost } = req.body;
  const userId = req.user?.id;

  if (!userId) throw new UnauthorizedError('User ID not found.');
  if (!userPrompt?.trim()) {
    return res.status(400).json({ message: 'userPrompt is required.' });
  }

  // Fetch profile for tier check and minimal_ai_mode setting
  const { data: profile } = await supabase.from('profiles').select('is_admin, is_premium, praxis_points, minimal_ai_mode').eq('id', userId).single();
  const isAdmin = !!profile?.is_admin;
  const isPro = profile?.is_premium || isAdmin;
  // Axiom Boost (useBoost=true) lets premium/admin users force LLM even when minimal_ai_mode is on
  const useLLM = isPro && (useBoost === true || !profile?.minimal_ai_mode);

  // Free-tier: charge PP per message
  if (!isPro) {
    const balance: number = profile?.praxis_points ?? 0;
    if (balance < AXIOM_CHAT_COST) {
      return res.status(402).json({
        error: 'INSUFFICIENT_POINTS',
        message: `Each Axiom message costs ${AXIOM_CHAT_COST} PP on the free tier. You have ${balance} PP.`,
        needed: AXIOM_CHAT_COST,
        have: balance,
      });
    }
    await deductPP(userId, AXIOM_CHAT_COST);
  }

  if (!aiCoachingService.isConfigured) {
    return res.status(503).json({
      message: 'Axiom is offline — the AI service is not configured on this server.',
      detailed: isAdmin ? 'genAI instance is null in AICoachingService' : undefined
    });
  }

  try {
    const context = await buildContext(userId);

    // Log user's question to the database
    await supabase.from('messages').insert({
      sender_id: userId,
      content: userPrompt.trim(),
      message_type: 'text'
    });

    const response = await aiCoachingService.generateCoachingResponse(userPrompt.trim(), context, useLLM);

    // Log Axiom's answer to the database
    await supabase.from('messages').insert({
      sender_id: userId, // technically receiver is userId, sender is AI
      receiver_id: userId,
      content: response,
      message_type: 'text',
      is_ai: true
    });

    res.json({ response });
  } catch (err: any) {
    logger.error('[AI Coach] Follow-up generation failed:', err.message);
    const { message, code, detailed } = friendlyAiError(err, isAdmin);
    return res.status(503).json({ message, code, detailed });
  }
});

// ---------------------------------------------------------------------------
// POST /ai-coaching/generate-axiom-brief
// On-demand generation of today's Axiom daily brief.
// Returns the existing brief immediately if one was already generated today.
// ---------------------------------------------------------------------------

export const generateAxiomBrief = catchAsync(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const force = req.query.force === '1' || req.body?.force === true;
  const today = new Date().toISOString().slice(0, 10);

  // Return cached brief if already generated today (unless force refresh)
  if (!force) {
    const { data: existing } = await supabase
      .from('axiom_daily_briefs')
      .select('date, brief, generated_at')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (existing) return res.json(existing);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, city, minimal_ai_mode, is_premium, is_admin')
    .eq('id', userId)
    .single();

  // Daily briefs ALWAYS try LLM — it's once-daily, not per-request
  // Force refresh also bypasses any remaining gates
  const useLLM = true;

  await AxiomScanService.generateDailyBrief(
    userId,
    profile?.name ?? 'User',
    profile?.city ?? 'Unknown',
    useLLM,
  );

  const { data: fresh } = await supabase
    .from('axiom_daily_briefs')
    .select('date, brief, generated_at')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  res.json(fresh ?? null);
});
