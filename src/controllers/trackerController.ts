import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';
import { writeStructured, isStructuredType } from '../services/StructuredTrackerWriter';
import { recordActivity } from '../utils/recordActivity';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('42P01') || msg?.includes('does not exist');

const PP_PER_LOG = 1; // Praxis Points awarded per tracker log
const MAX_TRACKER_LOGS_PER_DAY = 3; // Max tracker entries per goal per day

/**
 * GET /trackers/calendar
 * Returns combined activity data for calendar view (trackers + notes + goal updates)
 * Query param: ?days=N (default 112, max 365)
 */
export const getCalendarData = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const days = Math.min(Math.max(Number(req.query.days ?? 112), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // 1. Fetch tracker entries
  const { data: trackers } = await supabase
    .from('trackers')
    .select('id, type')
    .eq('user_id', userId);

  const trackerEntries: any[] = [];
  if (trackers && trackers.length > 0) {
    const trackerIds = trackers.map(t => t.id);
    const { data: entries } = await supabase
      .from('tracker_entries')
      .select('tracker_id, data, logged_at')
      .in('tracker_id', trackerIds)
      .gte('logged_at', since);
    
    if (entries) {
      const trackerTypeMap = Object.fromEntries(trackers.map(t => [t.id, t.type]));
      trackerEntries.push(...entries.map(e => ({
        ...e,
        tracker_type: trackerTypeMap[e.tracker_id],
        activity_type: 'tracker'
      })));
    }
  }

  // 2. Fetch journal/note entries
  const { data: notes } = await supabase
    .from('journal_entries')
    .select('node_id, note, mood, created_at')
    .eq('user_id', userId)
    .gte('created_at', since);

  // 3. Fetch goal progress updates (from goal_trees updates - approximate via updated_at)
  const { data: goalTree } = await supabase
    .from('goal_trees')
    .select('nodes')
    .eq('user_id', userId)
    .single();

  const goalUpdates: any[] = [];
  if (goalTree?.nodes) {
    // Note: This is a simplified approach - ideally you'd have a goal_progress_history table
    const nodes = goalTree.nodes as any[];
    nodes.forEach(node => {
      if (node.updated_at && new Date(node.updated_at) >= new Date(since)) {
        goalUpdates.push({
          node_id: node.id,
          node_name: node.name,
          progress: node.progress,
          timestamp: node.updated_at,
          activity_type: 'goal'
        });
      }
    });
  }

  // 4. Build day-by-day map
  const dayMap: Record<string, {
    date: string;
    count: number;
    trackers: string[];
    notes: number;
    goalUpdates: number;
    activities: Array<{ type: string; description: string; timestamp: string }>;
  }> = {};

  // Process tracker entries
  trackerEntries.forEach(entry => {
    const date = entry.logged_at.slice(0, 10);
    if (!dayMap[date]) {
      dayMap[date] = { date, count: 0, trackers: [], notes: 0, goalUpdates: 0, activities: [] };
    }
    dayMap[date].count++;
    if (!dayMap[date].trackers.includes(entry.tracker_type)) {
      dayMap[date].trackers.push(entry.tracker_type);
    }
    dayMap[date].activities.push({
      type: 'tracker',
      description: `${entry.tracker_type} entry`,
      timestamp: entry.logged_at
    });
  });

  // Process notes
  notes?.forEach(note => {
    const date = note.created_at.slice(0, 10);
    if (!dayMap[date]) {
      dayMap[date] = { date, count: 0, trackers: [], notes: 0, goalUpdates: 0, activities: [] };
    }
    dayMap[date].count++;
    dayMap[date].notes++;
    dayMap[date].activities.push({
      type: 'note',
      description: note.mood ? `Journal: ${note.mood}` : 'Journal entry',
      timestamp: note.created_at
    });
  });

  // Process goal updates
  goalUpdates.forEach(goal => {
    const date = goal.timestamp.slice(0, 10);
    if (!dayMap[date]) {
      dayMap[date] = { date, count: 0, trackers: [], notes: 0, goalUpdates: 0, activities: [] };
    }
    dayMap[date].count++;
    dayMap[date].goalUpdates++;
    dayMap[date].activities.push({
      type: 'goal',
      description: `${goal.node_name}: ${goal.progress}%`,
      timestamp: goal.timestamp
    });
  });

  // Convert to array and sort by date
  const calendarDays = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    days: days,
    calendar: calendarDays,
    summary: {
      totalActiveDays: calendarDays.filter(d => d.count > 0).length,
      totalTrackerLogs: trackerEntries.length,
      totalNotes: notes?.length ?? 0,
      totalGoalUpdates: goalUpdates.length
    }
  });
});

/**
 * GET /trackers/my
 * Returns the authenticated user's trackers, each with the last N days of entries.
 * Query param: ?days=N (default 14, max 365)
 */
export const getMyTrackers = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const days = Math.min(Math.max(Number(req.query.days ?? 14), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: trackers, error: trackerErr } = await supabase
    .from('trackers')
    .select('id, type, goal, created_at')
    .eq('user_id', userId);

  if (trackerErr) {
    if (SCHEMA_MISSING(trackerErr.message)) return res.json([]);
    return res.json([]);
  }

  if (!trackers || trackers.length === 0) return res.json([]);

  const trackerIds = trackers.map(t => t.id);
  const { data: entries } = await supabase
    .from('tracker_entries')
    .select('id, tracker_id, data, logged_at')
    .in('tracker_id', trackerIds)
    .gte('logged_at', since)
    .order('logged_at', { ascending: false });

  const entriesByTracker: Record<string, any[]> = {};
  for (const e of entries ?? []) {
    if (!entriesByTracker[e.tracker_id]) entriesByTracker[e.tracker_id] = [];
    entriesByTracker[e.tracker_id].push(e);
  }

  const result = trackers.map(t => ({
    ...t,
    entries: entriesByTracker[t.id] ?? [],
  }));

  res.json(result);
});

/**
 * PATCH /trackers/:type/objective
 * Body: { goal: Record<string, any> }
 * Saves user-defined objective targets on the tracker row.
 */
export const updateObjective = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { type } = req.params;
  const { goal } = req.body as { goal?: Record<string, any> };
  if (!goal || typeof goal !== 'object') throw new BadRequestError('goal must be an object.');

  // Upsert tracker (create if not exists) then set goal
  const { data: tracker, error: upsertErr } = await supabase
    .from('trackers')
    .upsert({ user_id: userId, type }, { onConflict: 'user_id,type' })
    .select('id')
    .single();

  if (upsertErr) {
    if (SCHEMA_MISSING(upsertErr.message)) {
      return res.status(503).json({ message: 'Trackers table not set up. Run migrations.' });
    }
    throw new Error(upsertErr.message);
  }

  const { error: updateErr } = await supabase
    .from('trackers')
    .update({ goal })
    .eq('id', tracker.id);

  if (updateErr) {
    if (SCHEMA_MISSING(updateErr.message) || updateErr.message?.includes('42703')) {
      return res.status(503).json({ message: 'Tracker goal column missing. Run: ALTER TABLE public.trackers ADD COLUMN IF NOT EXISTS goal JSONB NOT NULL DEFAULT \'{}\';' });
    }
    throw new Error(updateErr.message);
  }

  res.json({ ok: true });
});

/**
 * PUT /trackers/:type/template
 * Body: { rows: Array<{ label, unit?, ... }> }
 * Saves the user's custom row template for a tracker type.
 * Stored inside the `goal` JSONB column as `goal.template_rows`.
 */
export const saveTemplate = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { type } = req.params;
  const { rows } = req.body as { rows?: any[] };
  if (!Array.isArray(rows)) throw new BadRequestError('rows must be an array.');

  // Upsert tracker row
  const { data: tracker, error: upsertErr } = await supabase
    .from('trackers')
    .upsert({ user_id: userId, type }, { onConflict: 'user_id,type' })
    .select('id, goal')
    .single();

  if (upsertErr) {
    if (SCHEMA_MISSING(upsertErr.message)) {
      return res.status(503).json({ message: 'Trackers table not set up.' });
    }
    throw new Error(upsertErr.message);
  }

  // Merge template_rows into existing goal JSONB
  const existingGoal = (tracker.goal && typeof tracker.goal === 'object') ? tracker.goal : {};
  const { error: updateErr } = await supabase
    .from('trackers')
    .update({ goal: { ...existingGoal, template_rows: rows } })
    .eq('id', tracker.id);

  if (updateErr) throw new Error(updateErr.message);

  res.json({ ok: true, rows });
});

/**
 * GET /trackers/:type/suggestions
 * Analyzes recent tracker_entries to find frequently logged item names.
 * Returns top items not already in the user's template.
 */
export const getTemplateSuggestions = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { type } = req.params;

  // Get the tracker
  const { data: tracker } = await supabase
    .from('trackers')
    .select('id, goal')
    .eq('user_id', userId)
    .eq('type', type)
    .single();

  if (!tracker) return res.json({ suggestions: [] });

  // Get last 60 days of entries
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: entries } = await supabase
    .from('tracker_entries')
    .select('data')
    .eq('tracker_id', tracker.id)
    .gte('created_at', since);

  if (!entries || entries.length === 0) return res.json({ suggestions: [] });

  // Count item names from entries
  const nameCounts: Record<string, number> = {};
  for (const entry of entries) {
    const items = entry.data?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        const name = (item.name || item.label || '').trim();
        if (name) nameCounts[name] = (nameCounts[name] || 0) + 1;
      }
    } else {
      // Single-field entries (e.g. exercise, food)
      const name = (entry.data?.exercise || entry.data?.food || entry.data?.subject || entry.data?.project || entry.data?.game || '').trim();
      if (name) nameCounts[name] = (nameCounts[name] || 0) + 1;
    }
  }

  // Get existing template row labels to exclude
  const templateRows: any[] = tracker.goal?.template_rows || [];
  const existingLabels = new Set(templateRows.map((r: any) => (r.label || '').toLowerCase()));

  // Sort by frequency, exclude already-in-template, take top 10
  const suggestions = Object.entries(nameCounts)
    .filter(([name]) => !existingLabels.has(name.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  res.json({ suggestions });
});

/**
 * POST /trackers/log
 * Body: { type: string, data: Record<string, any> }
 * Upserts the tracker row (creates if missing), inserts an entry, awards +5 PP.
 */
export const logTracker = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { type, data } = req.body as { type?: string; data?: Record<string, any> };
  if (!type) throw new BadRequestError('type is required.');
  if (!data || typeof data !== 'object') throw new BadRequestError('data must be an object.');

  // Upsert tracker row (get-or-create)
  const { data: tracker, error: upsertErr } = await supabase
    .from('trackers')
    .upsert({ user_id: userId, type }, { onConflict: 'user_id,type' })
    .select('id')
    .single();

  if (upsertErr) {
    if (SCHEMA_MISSING(upsertErr.message)) {
      return res.status(503).json({ message: 'Trackers table not set up. Run migrations.' });
    }
    throw new Error(`Failed to upsert tracker: ${upsertErr.message}`);
  }

  // Check daily limit (3 per tracker per day)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from('tracker_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tracker_id', tracker.id)
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString());

  if ((todayCount ?? 0) >= MAX_TRACKER_LOGS_PER_DAY) {
    return res.status(429).json({
      message: `Daily limit reached (${MAX_TRACKER_LOGS_PER_DAY} logs per goal). Free notes are unlimited.`,
      limitReached: true,
    });
  }

  // Insert entry (returning id for structured dual-write)
  const { data: inserted, error: insertErr } = await supabase
    .from('tracker_entries')
    .insert({ tracker_id: tracker.id, user_id: userId, data })
    .select('id, logged_at')
    .single();

  if (insertErr || !inserted) {
    throw new Error(`Failed to insert tracker entry: ${insertErr?.message ?? 'no row returned'}`);
  }

  // Dual-write into the structured per-category table so Axiom + notebook
  // export can read typed rows with computed metrics (volume_kg, calories,
  // pace_min_per_km, total_eur, …) instead of parsing JSONB blobs.
  if (isStructuredType(type)) {
    try {
      await writeStructured(type, data, {
        userId,
        trackerId: tracker.id,
        trackerEntryId: inserted.id,
        nodeId: (data as any)?.node_id ?? (data as any)?.nodeId ?? null,
        loggedAt: inserted.logged_at,
      });
    } catch (err: any) {
      // Non-fatal: JSONB row already persisted.
      // eslint-disable-next-line no-console
      console.warn(`[logTracker] structured write failed for ${type}:`, err?.message);
    }
  }

  // Award PP (fire-and-forget)
  supabase
    .from('profiles')
    .select('praxis_points')
    .eq('id', userId)
    .single()
    .then(({ data: profile }) => {
      if (profile) {
        supabase
          .from('profiles')
          .update({ praxis_points: (profile.praxis_points ?? 0) + PP_PER_LOG })
          .eq('id', userId);
      }
    });

  // Progress daily quest for tracker logging (fire-and-forget)
  (async () => {
    try {
      await supabase.rpc('progress_user_quest', {
        p_user_id: userId,
        p_quest_type: 'log_tracker',
        p_amount: 1,
      });
    } catch { /* ignore */ }
  })();

  // Record activity for streak (fire-and-forget)
  recordActivity(userId).catch(() => {});

  res.json({ ok: true, ppAwarded: PP_PER_LOG });
});

/**
 * DELETE /trackers/entries/:id
 * Delete a tracker entry (only if owned by the user)
 */
export const deleteTrackerEntry = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { id } = req.params;
  if (!id) throw new BadRequestError('Entry ID is required.');

  // Verify the entry belongs to the user
  const { data: entry, error: fetchErr } = await supabase
    .from('tracker_entries')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !entry) {
    return res.status(404).json({ message: 'Entry not found.' });
  }

  const { error: delErr } = await supabase
    .from('tracker_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (delErr) throw new Error(`Failed to delete entry: ${delErr.message}`);

  res.json({ ok: true });
});

/**
 * GET /trackers/node-activity/:nodeId
 * Returns activity counts per day for a specific goal node
 * Query params: ?days=30 (default 30, max 90)
 */
export const getNodeActivity = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated.');

  const { nodeId } = req.params;
  const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const result: Record<string, { date: string; count: number }> = {};

  // 1. Query tracker_entries linked to this node (via trackers table)
  const { data: linkedTrackers } = await supabase
    .from('trackers')
    .select('id')
    .eq('user_id', userId)
    .eq('node_id', nodeId);

  if (linkedTrackers && linkedTrackers.length > 0) {
    const trackerIds = linkedTrackers.map(t => t.id);
    const { data: entries } = await supabase
      .from('tracker_entries')
      .select('logged_at')
      .in('tracker_id', trackerIds)
      .gte('logged_at', since);

    entries?.forEach(entry => {
      const date = entry.logged_at.slice(0, 10);
      result[date] = result[date] || { date, count: 0 };
      result[date].count++;
    });
  }

  // 2. Query notebook_entries linked to this node
  const { data: notes } = await supabase
    .from('notebook_entries')
    .select('occurred_at')
    .eq('user_id', userId)
    .eq('goal_id', nodeId)
    .gte('occurred_at', since);

  notes?.forEach(note => {
    const date = (note.occurred_at || '').slice(0, 10);
    if (!date) return;
    result[date] = result[date] || { date, count: 0 };
    result[date].count++;
  });

  // 3. Sort by date
  const sorted = Object.values(result).sort((a, b) => a.date.localeCompare(b.date));

  res.json({ node_id: nodeId, days, activities: sorted });
});
