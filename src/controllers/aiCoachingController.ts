import { Request, Response, NextFunction } from 'express';
import { AICoachingService, CoachingContext } from '../services/AICoachingService';
import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';
import { catchAsync, UnauthorizedError, InternalServerError } from '../utils/appErrors';

const aiCoachingService = new AICoachingService();

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
        .single(),

      // 3. Recent feedback (received by this user)
      supabase
        .from('feedback')
        .select('grade, comment, giverId')
        .eq('receiverId', userId)
        .order('createdAt', { ascending: false })
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

  logger.info(`[AI Coach] Generating full report for user ${userId}`);

  try {
    const context = await buildContext(userId);
    const report = await aiCoachingService.generateFullReport(context);
    res.json(report);
  } catch (err: any) {
    logger.error('[AI Coach] Report generation failed:', err.message);
    throw new InternalServerError(err.message || 'Failed to generate coaching report.');
  }
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

  try {
    const context = await buildContext(userId);
    const response = await aiCoachingService.generateCoachingResponse(userPrompt.trim(), context);
    res.json({ response });
  } catch (err: any) {
    logger.error('[AI Coach] Follow-up generation failed:', err.message);
    throw new InternalServerError(err.message || 'Failed to generate coaching response.');
  }
});
