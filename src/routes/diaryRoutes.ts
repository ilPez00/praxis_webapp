import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';
import { AICoachingService } from '../services/AICoachingService';
import { getStructuredSummary } from '../services/StructuredTrackerReader';
import { renderNotebookPdf } from '../services/NotebookPdfRenderer';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /diary/entries
 * Get diary entries with filters
 */
router.get('/entries', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const {
    entry_type,
    tag,
    search,
    limit = '100',
    offset = '0',
  } = req.query as {
    entry_type?: string;
    tag?: string;
    search?: string;
    limit?: string;
    offset?: string;
  };

  // Use the database function for filtered queries
  const { data, error } = await supabase.rpc('get_diary_entries', {
    p_user_id: userId,
    p_entry_type: entry_type === 'all' ? null : entry_type,
    p_tag: tag === 'all' ? null : tag,
    p_search: search || null,
    p_limit: Math.min(parseInt(limit, 10) || 100, 200),
    p_offset: parseInt(offset, 10) || 0,
  });

  if (error) throw error;
  res.json(data || []);
}));

/**
 * GET /diary/stats
 * Get diary statistics for user
 */
router.get('/stats', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data, error } = await supabase.rpc('get_diary_stats', {
    p_user_id: userId,
  });

  if (error) throw error;
  res.json(data || {});
}));

/**
 * POST /diary/entries
 * Create a new diary entry
 */
router.post('/entries', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const {
    entry_type = 'note',
    title,
    content,
    source_table,
    source_id,
    metadata = {},
    latitude,
    longitude,
    location_name,
    location_accuracy,
    tags,
    mood,
    is_private = true,
    occurred_at,
  } = req.body;

  if (!entry_type) throw new BadRequestError('entry_type is required');

  // Validate coordinates if provided
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    throw new BadRequestError('latitude must be between -90 and 90');
  }
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    throw new BadRequestError('longitude must be between -180 and 180');
  }

  const { data, error } = await supabase
    .from('diary_entries')
    .insert({
      user_id: userId,
      entry_type,
      title: title || null,
      content: content || null,
      source_table: source_table || null,
      source_id: source_id || null,
      metadata: metadata || {},
      latitude: latitude || null,
      longitude: longitude || null,
      location_name: location_name || null,
      location_accuracy: location_accuracy || null,
      tags: tags || null,
      mood: mood || null,
      is_private,
      occurred_at: occurred_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * POST /diary/entries/share
 * Quick share to diary from chat/post/place/event
 */
router.post('/entries/share', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const {
    source_table,  // 'posts', 'profiles', 'places', 'events', 'messages'
    source_id,
    content,       // Optional note to add
    latitude,
    longitude,
    location_name,
    tags,
  } = req.body;

  if (!source_table || !source_id) {
    throw new BadRequestError('source_table and source_id are required');
  }

  // Fetch source data based on table
  let title = '';
  let entryContent = '';
  let metadata = {};
  let entryType = 'note';

  switch (source_table) {
    case 'posts':
      entryType = 'post';
      const { data: postData } = await supabase
        .from('posts')
        .select('content, user_id')
        .eq('id', source_id)
        .single();
      if (postData) {
        title = 'Saved post';
        entryContent = postData.content;
        metadata = { shared_from: 'post', original_user_id: postData.user_id };
      }
      break;

    case 'profiles':
      entryType = 'user';
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, bio, avatar_url')
        .eq('id', source_id)
        .single();
      if (profileData) {
        title = `Saved: ${profileData.name || 'User'}`;
        entryContent = profileData.bio || '';
        metadata = { shared_from: 'profile', avatar_url: profileData.avatar_url };
      }
      break;

    case 'places':
      entryType = 'place';
      const { data: placeData } = await supabase
        .from('places')
        .select('name, description, city, tags, latitude, longitude')
        .eq('id', source_id)
        .single();
      if (placeData) {
        title = `Saved place: ${placeData.name}`;
        entryContent = placeData.description || '';
        metadata = { 
          shared_from: 'place', 
          city: placeData.city,
          place_tags: placeData.tags,
          place_latitude: placeData.latitude,
          place_longitude: placeData.longitude,
        };
      }
      break;

    case 'events':
      entryType = 'event';
      const { data: eventData } = await supabase
        .from('events')
        .select('title, description, event_date, city')
        .eq('id', source_id)
        .single();
      if (eventData) {
        title = `Saved event: ${eventData.title}`;
        entryContent = eventData.description || '';
        metadata = { 
          shared_from: 'event',
          event_date: eventData.event_date,
          city: eventData.city,
        };
      }
      break;

    case 'messages':
      entryType = 'message';
      const { data: messageData } = await supabase
        .from('messages')
        .select('content, sender_id, created_at')
        .eq('id', source_id)
        .single();
      if (messageData) {
        title = 'Saved message';
        entryContent = messageData.content;
        metadata = {
          shared_from: 'message',
          sender_id: messageData.sender_id,
          sent_at: messageData.created_at,
        };
      }
      break;

    case 'notebook_entries':
      entryType = 'note';
      const { data: notebookData } = await supabase
        .from('notebook_entries')
        .select('title, content, entry_type, tags, domain')
        .eq('id', source_id)
        .single();
      if (notebookData) {
        title = `Saved note: ${notebookData.title || 'Untitled'}`;
        entryContent = notebookData.content || '';
        metadata = {
          shared_from: 'notebook_entry',
          original_entry_type: notebookData.entry_type,
          original_tags: notebookData.tags,
          original_domain: notebookData.domain,
        };
      }
      break;

    default:
      throw new BadRequestError(`Unsupported source_table: ${source_table}`);
  }

  // Add user's note if provided
  if (content) {
    entryContent = entryContent ? `${entryContent}\n\n---\n\n${content}` : content;
  }

  // Create diary entry
  const { data, error } = await supabase
    .from('diary_entries')
    .insert({
      user_id: userId,
      entry_type: entryType,
      title: title || 'Saved item',
      content: entryContent || null,
      source_table,
      source_id,
      metadata,
      latitude: latitude || null,
      longitude: longitude || null,
      location_name: location_name || null,
      tags: tags || null,
      is_private: true,
      occurred_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /diary/entries/:id
 * Update a diary entry
 */
router.patch('/entries/:id', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;
  const updates = req.body;

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('diary_entries')
    .select('user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existing) {
    throw new NotFoundError('Entry not found');
  }

  const { data, error } = await supabase
    .from('diary_entries')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/**
 * PATCH /diary/entries/:id/pin
 * Pin or unpin a diary entry
 */
router.patch('/entries/:id/pin', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;
  const { is_pinned } = req.body;

  const { data, error } = await supabase
    .from('diary_entries')
    .update({ is_pinned, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/**
 * DELETE /diary/entries/:id
 * Delete a diary entry
 */
router.delete('/entries/:id', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { id } = req.params;

  const { error } = await supabase
    .from('diary_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
  res.json({ message: 'Entry deleted' });
}));

/**
 * GET /diary/tags
 * Get user's diary tags
 */
router.get('/tags', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data, error } = await supabase
    .from('diary_entries')
    .select('tags')
    .eq('user_id', userId)
    .not('tags', 'is', null);

  if (error) throw error;

  // Flatten and deduplicate tags
  const allTags = data?.flatMap(d => d.tags || []) || [];
  const uniqueTags = [...new Set(allTags)].sort();

  res.json(uniqueTags);
}));

// ---------------------------------------------------------------------------
// Shared helper — build the full NotebookPdfInput for a user.
// Single entry point for the one-tier /export endpoint.
// ---------------------------------------------------------------------------
async function buildNotebookPdfInput(userId: string, since: Date) {
  const sinceIso = since.toISOString();

  const { data: profile } = await supabase
    .from('profiles').select('name, praxis_points, is_premium').eq('id', userId).single();

  const [journalsRes, nodeJournalsRes, checkinsRes, goalsRes, betsRes, achievementsRes, trackersRes] = await Promise.all([
    supabase.from('journal_entries').select('note, mood, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('node_journal_entries').select('node_id, note, mood, logged_at').eq('user_id', userId).order('logged_at', { ascending: true }),
    supabase.from('checkins').select('mood, win_of_the_day, checked_in_at, streak_day').eq('user_id', userId).order('checked_in_at', { ascending: true }),
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).single(),
    supabase.from('bets').select('goal_name, stake_points, status, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('achievements').select('title, domain, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('trackers').select('id, type, goal').eq('user_id', userId),
  ]);

  const journals = journalsRes.data || [];
  const nodeJournals = nodeJournalsRes.data || [];
  const checkins = checkinsRes.data || [];
  const goalNodes: any[] = goalsRes.data?.nodes || [];
  const bets = betsRes.data || [];
  const achievements = achievementsRes.data || [];
  const trackers = trackersRes.data || [];

  const structured = await getStructuredSummary(userId, sinceIso, 2000).catch(() => null);

  // Legacy JSONB tracker rows ONLY for tracker types without a structured table
  const structuredTypes = new Set(['lift','meal','cardio','steps','sleep','meditation','study','books','budget','expenses','investments','music','journal','gaming']);
  const legacyTrackers = trackers.filter((t: any) => !structuredTypes.has(t.type));
  const legacyTypeById: Record<string, string> = {};
  for (const t of legacyTrackers) legacyTypeById[t.id] = t.type;
  let legacyRows: Array<{ type: string; logged_at: string; data: any }> = [];
  if (legacyTrackers.length > 0) {
    const { data } = await supabase.from('tracker_entries')
      .select('tracker_id, data, logged_at')
      .in('tracker_id', legacyTrackers.map((t: any) => t.id))
      .order('logged_at', { ascending: true });
    legacyRows = (data || []).map((r: any) => ({ type: legacyTypeById[r.tracker_id] || 'log', logged_at: r.logged_at, data: r.data }));
  }

  // Build timeline (journals + node journals + checkins + bets + achievements)
  const nodeNameMap: Record<string, string> = {};
  for (const n of goalNodes) nodeNameMap[n.id] = n.name || 'Goal';

  const timeline: Array<{ date: string; kind: string; text: string }> = [];
  for (const e of journals) timeline.push({ date: e.created_at, kind: 'Journal', text: `${e.mood ? e.mood + ' ' : ''}${e.note || ''}`.trim() });
  for (const e of nodeJournals) timeline.push({ date: e.logged_at, kind: nodeNameMap[e.node_id] || 'Goal', text: `${e.mood ? e.mood + ' ' : ''}${e.note || ''}`.trim() });
  for (const e of checkins) timeline.push({ date: e.checked_in_at, kind: 'Check-in', text: `Day ${e.streak_day}${e.mood ? ' · ' + e.mood : ''}${e.win_of_the_day ? ' — Win: ' + e.win_of_the_day : ''}` });
  for (const e of bets) {
    const status = e.status === 'won' ? 'Won' : e.status === 'lost' ? 'Lost' : 'Placed';
    timeline.push({ date: e.created_at, kind: 'Bet', text: `${status} bet on "${e.goal_name}" (${e.stake_points} PP)` });
  }
  for (const e of achievements) timeline.push({ date: e.created_at, kind: 'Achievement', text: `${e.title} (${e.domain})` });

  return {
    userName: profile?.name || 'User',
    since,
    until: new Date(),
    isPro: !!profile?.is_premium,
    balance: profile?.praxis_points ?? 0,
    goals: goalNodes.map((n: any) => ({
      id: n.id,
      name: n.name || 'Goal',
      domain: n.domain,
      progress: n.progress,
      parentId: n.parentId ?? null,
      customDetails: n.customDetails,
    })),
    timeline,
    structured,
    legacyTrackerLogs: legacyRows,
    checkinCount: checkins.length,
    achievementCount: achievements.length,
  };
}

/**
 * POST /diary/export
 * Single notebook PDF tier. Auto-ranges from signup date to now. Gated: Pro OR 500 PP.
 * Frontend calls this; no plain/full distinction.
 */
router.post('/export', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles').select('praxis_points, is_premium, created_at').eq('id', userId).single();

  const isPro = !!profile?.is_premium;
  const balance = profile?.praxis_points ?? 0;

  if (!isPro && balance < 500) {
    throw new BadRequestError(`Not enough PP. You have ${balance}, need 500.`);
  }

  // Auto-range from signup date → now. Falls back to ~5yr if created_at missing.
  const since = profile?.created_at
    ? new Date(profile.created_at)
    : new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
  const input = await buildNotebookPdfInput(userId, since);

  // Deduct PP before streaming (so mid-stream failures don't double-charge on retry)
  if (!isPro) {
    await supabase.from('profiles').update({ praxis_points: balance - 500 }).eq('id', userId);
  }
  await supabase.from('profiles').update({
    latest_axiom_report: {
      type: 'notebook_export',
      timestamp: new Date().toISOString(),
      summary: `Goals: ${input.goals.length}, Logs: ${input.timeline.length}`,
    },
  }).eq('id', userId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="praxis-notebook-${new Date().toISOString().slice(0, 10)}.pdf"`);
  renderNotebookPdf(input, res);
}));

/**
 * POST /diary/export/axiom
 * Generate Axiom-refined diary narrative (costs 500 PP)
 */
router.post('/export/axiom', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  // Check PP balance
  const { data: profile } = await supabase
    .from('profiles').select('name, praxis_points').eq('id', userId).single();

  const balance = profile?.praxis_points ?? 0;
  if (balance < 500) {
    throw new BadRequestError(`Not enough PP. You have ${balance}, need 500.`);
  }

  const userName = profile?.name || 'User';

  // Deduct 500 PP
  const { error: ppErr } = await supabase
    .from('profiles')
    .update({ praxis_points: balance - 500 })
    .eq('id', userId);
  if (ppErr) throw ppErr;

  logger.info(`[DiaryExport] Deducted 500 PP from ${userName} for Axiom diary`);

  // Fetch all data (same as plain export)
  const [journalsRes, nodeJournalsRes, checkinsRes, goalsRes, betsRes, achievementsRes] = await Promise.all([
    supabase.from('journal_entries').select('note, mood, created_at')
      .eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('node_journal_entries').select('node_id, note, mood, logged_at')
      .eq('user_id', userId).order('logged_at', { ascending: true }),
    supabase.from('checkins').select('mood, win_of_the_day, checked_in_at, streak_day')
      .eq('user_id', userId).order('checked_in_at', { ascending: true }),
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).single(),
    supabase.from('bets').select('goal_name, stake_points, status, created_at')
      .eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('achievements').select('title, domain, created_at')
      .eq('user_id', userId).order('created_at', { ascending: true }),
  ]);

  const journals = journalsRes.data || [];
  const nodeJournals = nodeJournalsRes.data || [];
  const checkins = checkinsRes.data || [];
  const nodes: any[] = goalsRes.data?.nodes || [];
  const bets = betsRes.data || [];
  const achievements = achievementsRes.data || [];

  const nodeNameMap: Record<string, string> = {};
  for (const n of nodes) nodeNameMap[n.id] = n.name || 'Goal';

  // Build raw timeline text for the LLM
  const timeline: Array<{ date: string; text: string }> = [];
  for (const e of journals) {
    timeline.push({ date: e.created_at, text: `${e.mood ? e.mood + ' ' : ''}${e.note || ''}`.trim() });
  }
  for (const e of nodeJournals) {
    const goalName = nodeNameMap[e.node_id] || 'a goal';
    timeline.push({ date: e.logged_at, text: `[Goal: ${goalName}] ${e.mood ? e.mood + ' ' : ''}${e.note || ''}`.trim() });
  }
  for (const e of checkins) {
    timeline.push({ date: e.checked_in_at, text: `Check-in Day ${e.streak_day}${e.mood ? ' · ' + e.mood : ''}${e.win_of_the_day ? ' — Win: ' + e.win_of_the_day : ''}` });
  }
  for (const e of bets) {
    const status = e.status === 'won' ? 'Won' : e.status === 'lost' ? 'Lost' : 'Placed';
    timeline.push({ date: e.created_at, text: `${status} bet on "${e.goal_name}" (${e.stake_points} PP)` });
  }
  for (const e of achievements) {
    timeline.push({ date: e.created_at, text: `Achievement unlocked: "${e.title}" (${e.domain})` });
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  // Group by date for the prompt
  const rawDiary = timeline.map(e => {
    const d = new Date(e.date);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — ${e.text}`;
  }).join('\n');

  // Goal summary for context
  const goalSummary = nodes
    .filter((n: any) => !n.parentId)
    .map((n: any) => `"${n.name}" (${n.domain}, ${Math.round((n.progress || 0) * 100)}%)`)
    .join(', ');

  // Truncate if too long (LLM context limits)
  const maxChars = 15000;
  const truncatedDiary = rawDiary.length > maxChars
    ? rawDiary.slice(0, maxChars) + '\n\n[... diary continues ...]'
    : rawDiary;

  const prompt = `You are Axiom, a warm and wise life coach. Transform these raw diary entries into a beautifully written personal narrative — a real diary that reads like a memoir.

AUTHOR: ${userName}
GOALS: ${goalSummary || 'Various personal goals'}

RAW DIARY ENTRIES:
${truncatedDiary}

INSTRUCTIONS:
1. Write this as a coherent, chronological personal diary/memoir
2. Group entries into chapters by week or theme (whichever flows better)
3. Keep the person's authentic voice — don't sanitize or genericize their words
4. Weave check-ins, journal notes, bets, and achievements into the narrative
5. Highlight turning points, breakthroughs, and moments of struggle
6. Add chapter titles that capture the emotional arc
7. Include their actual moods and reflections — these are precious
8. End with a reflection on their growth arc and what's emerging
9. Write in first person from ${userName}'s perspective
10. Be specific — use their actual goal names, dates, and data
11. Make it feel like a real published diary, not a report

OUTPUT FORMAT:
- Title page with name and date range
- Chapters with evocative titles
- Clean prose, no bullet points or formatting artifacts
- 2000-4000 words depending on how much material there is

Write the complete diary now.`;

  try {
    const aiCoaching = new AICoachingService();
    const narrative = await aiCoaching.runWithFallback(prompt);

    logger.info(`[DiaryExport] Axiom narrative generated for ${userName} (${narrative.length} chars)`);

    // Save to user profile
    await supabase.from('profiles').update({ latest_ai_narrative: narrative }).eq('id', userId);

    res.json({
      narrative,
      entryCount: timeline.length,
      dateRange: timeline.length > 0
        ? { from: timeline[0].date.slice(0, 10), to: timeline[timeline.length - 1].date.slice(0, 10) }
        : null,
      ppSpent: 500,
    });
  } catch (err: any) {
    // Refund PP on failure
    await supabase.from('profiles').update({ praxis_points: balance }).eq('id', userId);
    logger.error(`[DiaryExport] Axiom generation failed, refunded 500 PP: ${err.message}`);
    throw new Error('Failed to generate diary narrative. Your 500 PP have been refunded.');
  }
}));

export default router;
