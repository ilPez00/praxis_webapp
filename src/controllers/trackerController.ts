import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';

const SCHEMA_MISSING = (msg: string) =>
  msg?.includes('schema cache') || msg?.includes('42P01') || msg?.includes('does not exist');

const PP_PER_LOG = 10; // Praxis Points awarded per tracker log

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
    .select('tracker_id, data, logged_at')
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

  // Insert entry
  const { error: insertErr } = await supabase
    .from('tracker_entries')
    .insert({ tracker_id: tracker.id, user_id: userId, data });

  if (insertErr) {
    throw new Error(`Failed to insert tracker entry: ${insertErr.message}`);
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

  res.json({ ok: true, ppAwarded: PP_PER_LOG });
});
