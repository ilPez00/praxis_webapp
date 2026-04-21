import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';
import { AICoachingService } from '../services/AICoachingService';
import { getStructuredSummary } from '../services/StructuredTrackerReader';
import { renderNotebookPdf } from '../services/NotebookPdfRenderer';
import { renderNarrativePdf } from '../services/NarrativePdfRenderer';
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

  const checkinByDay: Record<string, number> = {};
  for (const c of checkins) {
    const day = (c.checked_in_at || '').slice(0, 10);
    if (day) checkinByDay[day] = (checkinByDay[day] || 0) + 1;
  }

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
    checkinByDay,
  };
}

// ---------------------------------------------------------------------------
// Timeline + evidence helpers shared by narrative tiers
// ---------------------------------------------------------------------------
async function fetchNarrativeData(userId: string) {
  const [journalsRes, nodeJournalsRes, checkinsRes, goalsRes, betsRes, achievementsRes, profileRes] = await Promise.all([
    supabase.from('journal_entries').select('note, mood, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('node_journal_entries').select('node_id, note, mood, logged_at').eq('user_id', userId).order('logged_at', { ascending: true }),
    supabase.from('checkins').select('mood, win_of_the_day, checked_in_at, streak_day').eq('user_id', userId).order('checked_in_at', { ascending: true }),
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).single(),
    supabase.from('bets').select('goal_name, stake_points, status, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('achievements').select('title, domain, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('profiles').select('name, praxis_points, created_at').eq('id', userId).single(),
  ]);
  return {
    journals: journalsRes.data || [],
    nodeJournals: nodeJournalsRes.data || [],
    checkins: checkinsRes.data || [],
    nodes: (goalsRes.data?.nodes as any[]) || [],
    bets: betsRes.data || [],
    achievements: achievementsRes.data || [],
    profile: profileRes.data,
  };
}

/**
 * POST /diary/export
 * FREE raw notebook PDF, rate-limited to one per 24h.
 * Includes charts, heatmap, tracker tables, goal hierarchy, life-log timeline.
 */
router.post('/export', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles').select('created_at, last_raw_export_at').eq('id', userId).single();

  // Daily rate limit: 1 raw PDF per 24h.
  const lastExportMs = profile?.last_raw_export_at ? new Date(profile.last_raw_export_at).getTime() : 0;
  const DAY = 24 * 60 * 60 * 1000;
  if (lastExportMs && Date.now() - lastExportMs < DAY) {
    const nextAt = new Date(lastExportMs + DAY);
    throw new BadRequestError(
      `Daily limit reached. Next free export available at ${nextAt.toLocaleString()}. ` +
      `(Use the Axiom Narrative or Self-Authoring tiers for more frequent exports.)`,
    );
  }

  const since = profile?.created_at
    ? new Date(profile.created_at)
    : new Date(Date.now() - 5 * 365 * DAY);
  const input = await buildNotebookPdfInput(userId, since);

  await supabase.from('profiles').update({
    last_raw_export_at: new Date().toISOString(),
  }).eq('id', userId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="praxis-notebook-${new Date().toISOString().slice(0, 10)}.pdf"`);
  renderNotebookPdf(input, res);
}));

/**
 * POST /diary/export/axiom
 * 300 PP. Axiom writes a memoir in markdown, rendered as a styled PDF.
 */
router.post('/export/axiom', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const data = await fetchNarrativeData(userId);
  const balance = data.profile?.praxis_points ?? 0;
  if (balance < 300) throw new BadRequestError(`Not enough PP. You have ${balance}, need 300.`);

  const userName = data.profile?.name || 'User';
  await supabase.from('profiles').update({ praxis_points: balance - 300 }).eq('id', userId);
  logger.info(`[DiaryExport] Deducted 300 PP from ${userName} for Axiom narrative`);

  try {
    const { journals, nodeJournals, checkins, nodes, bets, achievements } = data;
    const nodeNameMap: Record<string, string> = {};
    for (const n of nodes) nodeNameMap[n.id] = n.name || 'Goal';

    const timeline: Array<{ date: string; text: string }> = [];
    for (const e of journals) timeline.push({ date: e.created_at, text: `${e.mood ? e.mood + ' ' : ''}${e.note || ''}`.trim() });
    for (const e of nodeJournals) {
      timeline.push({ date: e.logged_at, text: `[Goal: ${nodeNameMap[e.node_id] || 'a goal'}] ${e.mood ? e.mood + ' ' : ''}${e.note || ''}`.trim() });
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

    const rawDiary = timeline.map(e => {
      const d = new Date(e.date);
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — ${e.text}`;
    }).join('\n');

    const goalSummary = nodes
      .filter((n: any) => !n.parentId)
      .map((n: any) => `"${n.name}" (${n.domain}, ${Math.round((n.progress || 0) * 100)}%)`)
      .join(', ');

    const maxChars = 18000;
    const truncated = rawDiary.length > maxChars
      ? rawDiary.slice(0, maxChars) + '\n\n[... continues ...]'
      : rawDiary;

    const sinceIso = timeline[0]?.date.slice(0, 10);
    const untilIso = timeline[timeline.length - 1]?.date.slice(0, 10);

    const prompt = `You are Axiom, a wise and emotionally literate memoirist. Transform the raw diary data below into a short personal memoir — prose, not a report.

AUTHOR: ${userName}
TOP GOALS: ${goalSummary || 'Various personal goals'}
DATE RANGE: ${sinceIso || '—'} to ${untilIso || '—'}

RAW DIARY DATA:
${truncated}

WRITE A MEMOIR IN MARKDOWN. Use this exact skeleton:

# Chapter One: [Evocative title for the opening arc]

[3-6 paragraphs of rich first-person prose narrating the earliest entries. Weave moods, wins, struggles naturally. Occasionally include a pull-quote:]

> [One line from the author that captures a core insight or turning moment.]

[Continue prose.]

## [Optional subsection heading if the mood shifts inside the chapter]

[More prose.]

# Chapter Two: [Title tracking the middle arc]

[Same pattern — prose, rare pull-quotes, maybe one section break.]

# Chapter Three: [Title capturing the present and what's emerging]

[Bring the reader to today. Name the growth arc and what is still unresolved.]

---

# Coda: What the Pages Say

[2-3 paragraphs from Axiom to ${userName}, written in SECOND person. Point to the pattern the author might not see. Reflective, affectionate, not prescriptive.]

RULES:
- Markdown only: \`#\` for chapters, \`##\` for subsections, \`>\` for pull-quotes, \`**bold**\` for emphasis, \`*italic*\` for voice/mood.
- 3-5 chapters. Each 400-800 words. Pull-quotes rare: 1-3 per chapter.
- First person from ${userName} for chapters. Second person from Axiom for the Coda.
- Use real goal names, real dates, actual moods. Specific beats generic.
- No bullet lists in chapters. This is prose.
- Do NOT write a cover title or byline — the PDF wrapper adds those. Start directly with \`# Chapter One: ...\`.

WRITE THE FULL MEMOIR NOW.`;

    const aiCoaching = new AICoachingService();
    const narrative = await aiCoaching.runWithFallback(prompt);
    logger.info(`[DiaryExport] Axiom narrative generated for ${userName} (${narrative.length} chars)`);

    await supabase.from('profiles').update({ latest_ai_narrative: narrative }).eq('id', userId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="praxis-axiom-${new Date().toISOString().slice(0, 10)}.pdf"`);
    renderNarrativePdf({
      title: 'The Book of You',
      subtitle: 'An Axiom-written memoir of your becoming',
      author: userName,
      tierLabel: 'Axiom Narrative',
      accentColor: '#F59E0B',
      dateRangeText: sinceIso && untilIso ? `${sinceIso} to ${untilIso}` : undefined,
      body: narrative,
    }, res);
  } catch (err: any) {
    await supabase.from('profiles').update({ praxis_points: balance }).eq('id', userId);
    logger.error(`[DiaryExport] Axiom generation failed, refunded 300 PP: ${err.message}`);
    throw new Error('Failed to generate diary narrative. Your 300 PP have been refunded.');
  }
}));

/**
 * POST /diary/export/self-authoring
 * 500 PP. Structured three-part workbook (past / present / future) inspired by
 * the Self-Authoring Program but built on the user's actual Praxis data.
 */
router.post('/export/self-authoring', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const data = await fetchNarrativeData(userId);
  const balance = data.profile?.praxis_points ?? 0;
  if (balance < 500) throw new BadRequestError(`Not enough PP. You have ${balance}, need 500.`);

  const userName = data.profile?.name || 'User';
  await supabase.from('profiles').update({ praxis_points: balance - 500 }).eq('id', userId);
  logger.info(`[DiaryExport] Deducted 500 PP from ${userName} for self-authoring`);

  try {
    const { journals, nodeJournals, checkins, nodes, achievements } = data;
    const sinceIso = data.profile?.created_at
      ? new Date(data.profile.created_at).toISOString()
      : new Date(Date.now() - 5 * 365 * 86400000).toISOString();
    const structured = await getStructuredSummary(userId, sinceIso, 2000).catch(() => null);

    const nodeNameMap: Record<string, string> = {};
    for (const n of nodes) nodeNameMap[n.id] = n.name || 'Goal';

    // Build evidence bundle — recent journal/check-in/achievement, trimmed for LLM window.
    const evidence: string[] = [];
    for (const e of journals.slice(-80)) {
      evidence.push(`${(e.created_at || '').slice(0, 10)} [journal${e.mood ? '/' + e.mood : ''}]: ${(e.note || '').slice(0, 220)}`);
    }
    for (const e of nodeJournals.slice(-80)) {
      evidence.push(`${(e.logged_at || '').slice(0, 10)} [goal:${nodeNameMap[e.node_id] || '?'}]: ${(e.note || '').slice(0, 220)}`);
    }
    for (const e of checkins.slice(-40)) {
      evidence.push(`${(e.checked_in_at || '').slice(0, 10)} [checkin]: mood=${e.mood || '—'} win=${e.win_of_the_day || '—'}`);
    }
    for (const e of achievements) {
      evidence.push(`${(e.created_at || '').slice(0, 10)} [unlocked:${e.domain}]: ${e.title}`);
    }
    const evidenceBlock = evidence.slice(-260).join('\n');

    const goalTreeText = nodes.map((n: any) => {
      const pct = Math.round((n.progress || 0) * 100);
      return `${n.parentId ? '  ' : ''}- "${n.name}" (${n.domain || '—'}, ${pct}%)${n.customDetails ? ' — ' + String(n.customDetails).slice(0, 160) : ''}`;
    }).join('\n');

    const structuredSummary = structured ? [
      structured.lifts && `Strength: ${structured.lifts.total_volume_kg} kg across ${structured.lifts.row_count} sets`,
      structured.cardio && `Cardio: ${structured.cardio.total_duration_min} min`,
      structured.sleep && `Sleep: avg ${structured.sleep.avg_duration_h}h/night over ${structured.sleep.night_count} nights`,
      structured.study && `Study: ${structured.study.total_duration_min} min`,
      structured.meditation && `Meditation: ${structured.meditation.total_duration_min} min`,
      structured.books && `Reading: ${structured.books.total_pages_read} pages`,
      structured.steps && `Steps: ${structured.steps.total_steps.toLocaleString()} total`,
    ].filter(Boolean).join(' · ') : '';

    const prompt = `You are Axiom, a depth-psychology-informed guide running a structured SELF-AUTHORING workbook, inspired by (but distinct from) the Past/Present/Future Authoring tradition. Your task is to write a PERSONAL WORKBOOK — filled in, not a template — for ${userName}, using their Praxis data as evidence.

AUTHOR: ${userName}

GOAL TREE:
${goalTreeText || '(no goals yet — invite ${userName} to seed them)'}

TRACKER ROLLUP: ${structuredSummary || '(no structured tracker data yet)'}

RECENT JOURNAL + CHECK-IN + ACHIEVEMENT EVIDENCE:
${evidenceBlock || '(no entries yet)'}

WRITE THE WORKBOOK IN MARKDOWN. Follow this EXACT three-part structure. Do NOT invent biographical details you cannot support from the evidence. When you lack data (especially early epochs), say so and invite ${userName} to fill them in.

# Part One: Past Authoring

A brief preamble (1 paragraph) on why facing the past precedes present and future. Then six epochs:

## Epoch I — Ages 0 to 5 (Formation)
[What is not in the evidence. Ask three precise questions for ${userName} to answer — about earliest memory, caretakers, first fear, first comfort. Do not fabricate.]

## Epoch II — Ages 5 to 12 (School and Self-Image)
[Same — targeted questions, no fabrication.]

## Epoch III — Ages 12 to 18 (Identity and Rupture)
[Same.]

## Epoch IV — Ages 18 to 25 (Leaving the Familiar)
[Same.]

## Epoch V — The Last Five Years
[Use the evidence. Name actual goals begun or abandoned, recurring moods, recurring wins. One rich paragraph.]

## Epoch VI — The Last Twelve Months
[Most specific. Pull real dates, real wins, real struggles from the evidence block. Two paragraphs. This is the bridge to Part Two.]

---

# Part Two: Present Authoring

One sentence of preamble: a clear-eyed audit, no flattery, no cruelty.

## Faults

Identify 5-7 faults from the evidence — patterns that cost ${userName} something real. Do not use clichés. For each fault:

- **[Name it in bold.]**
  One paragraph on *how it shows up*, including one concrete example drawn from the evidence.
  *What it protects:* one line — because faults usually protect something fragile.

## Virtues

Same structure, 5-7 virtues — patterns that have earned ${userName} something real.

- **[Name it in bold.]**
  One paragraph on *how it shows up*, with a concrete example from the evidence.
  *Shadow side:* one line — every strength casts one.

---

# Part Three: Future Authoring

One sentence of preamble: three years out, vivid, not vague.

## The Life Worth Having

4-6 paragraphs in present tense describing the three-year future ${userName} wants. Use their goals above as the skeleton — name them. Describe: where they live and among whom, what they do most days, what body/mind/relationships feel like, what they have stopped doing.

> [Single pull-quote line that names the yearning beneath the vision.]

## The Life to Avoid

3-4 paragraphs of unflinching counterfactual — the life that emerges if the faults go unchecked and the goals get abandoned. Honest extrapolation of current trajectory, not catastrophizing. Reference actual fault names from Part Two.

> [Sharp one-line pull-quote that makes the cost visible.]

## The Path

A numbered list of 7-10 concrete, testable commitments. Each line pairs a habit/practice with the fault it counters or the virtue it extends. Reference the user's actual goal names when applicable.

1. **[Habit]** — counters *[fault]* / extends *[virtue]*. One sentence on how.
2. ...

---

# Closing Letter

2-3 paragraph direct address from Axiom to ${userName}, in SECOND person. Warm but not saccharine. Name one specific thing in the evidence that moved you. End with a single sentence that, if ${userName} re-reads it five years from now, they will remember.

RULES:
- Markdown only: \`#\`, \`##\`, \`>\`, \`**bold**\`, \`*italic*\`, numbered lists where called for.
- Do NOT write a cover title or byline — the PDF wrapper adds those. Start directly with \`# Part One: Past Authoring\`.
- Length target: 3500-5500 words. Dense, not padded. Specific over generic. Evidence over assertion.
- Never fabricate childhood details. If you lack data, ASK.

WRITE THE FULL WORKBOOK NOW.`;

    const aiCoaching = new AICoachingService();
    const narrative = await aiCoaching.runWithFallback(prompt);
    logger.info(`[DiaryExport] Self-authoring generated for ${userName} (${narrative.length} chars)`);

    await supabase.from('profiles').update({ latest_ai_narrative: narrative }).eq('id', userId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="praxis-self-authoring-${new Date().toISOString().slice(0, 10)}.pdf"`);
    renderNarrativePdf({
      title: 'Self-Authoring',
      subtitle: 'A structured workbook of past, present, and future',
      author: userName,
      tierLabel: 'Self-Authoring Workbook',
      accentColor: '#22C55E',
      body: narrative,
    }, res);
  } catch (err: any) {
    await supabase.from('profiles').update({ praxis_points: balance }).eq('id', userId);
    logger.error(`[DiaryExport] Self-authoring generation failed, refunded 500 PP: ${err.message}`);
    throw new Error('Failed to generate self-authoring workbook. Your 500 PP have been refunded.');
  }
}));

export default router;
