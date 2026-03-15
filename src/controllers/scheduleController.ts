import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AxiomScheduleService } from '../services/AxiomScheduleService';
import { EngagementMetricService } from '../services/EngagementMetricService';
import { catchAsync, UnauthorizedError, BadRequestError, NotFoundError } from '../utils/appErrors';

const scheduleService = new AxiomScheduleService();
const engagementMetricService = new EngagementMetricService();

/**
 * GET /api/schedule/today
 * Get today's schedule (generates if doesn't exist)
 */
export const getTodaySchedule = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const today = new Date().toISOString().slice(0, 10);
  
  // Try to get existing schedule
  let schedule = await scheduleService.getSchedule(userId, today);
  
  // Generate new schedule if doesn't exist
  if (!schedule) {
    schedule = await generateScheduleForUser(userId, today);
  }
  
  // Get completion status for each slot
  const { data: completions } = await supabase
    .from('schedule_completions')
    .select('hour, completed_at, note, mood')
    .eq('user_id', userId);
  
  const completionMap = new Map((completions || []).map(c => [c.hour, c]));
  
  const scheduleWithCompletions = {
    ...schedule,
    timeSlots: schedule.timeSlots.map(slot => ({
      ...slot,
      isCompleted: completionMap.has(slot.hour),
      completion: completionMap.get(slot.hour),
    })),
  };
  
  res.json(scheduleWithCompletions);
});

/**
 * GET /api/schedule/:date
 * Get schedule for a specific date
 */
export const getSchedule = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { date } = req.params as { date: string };
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BadRequestError('Invalid date format. Use YYYY-MM-DD');
  }
  
  const schedule = await scheduleService.getSchedule(userId, date);
  
  if (!schedule) {
    return res.json({ schedule: null, message: 'No schedule for this date' });
  }
  
  // Get completion status
  const { data: completions } = await supabase
    .from('schedule_completions')
    .select('hour, completed_at, note, mood')
    .eq('user_id', userId);
  
  const completionMap = new Map((completions || []).map(c => [c.hour, c]));
  
  const scheduleWithCompletions = {
    ...schedule,
    timeSlots: schedule.timeSlots.map(slot => ({
      ...slot,
      isCompleted: completionMap.has(slot.hour),
      completion: completionMap.get(slot.hour),
    })),
  };
  
  res.json(scheduleWithCompletions);
});

/**
 * POST /api/schedule/generate
 * Generate a new schedule for a specific date (regenerates if exists)
 */
export const generateSchedule = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { date } = req.body;
  const targetDate = date || new Date().toISOString().slice(0, 10);
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new BadRequestError('Invalid date format. Use YYYY-MM-DD');
  }
  
  const schedule = await generateScheduleForUser(userId, targetDate);
  
  res.json({
    success: true,
    schedule,
    message: 'Schedule generated successfully',
  });
});

/**
 * POST /api/schedule/:scheduleId/slots/:hour/complete
 * Mark a time slot as completed
 */
export const completeTimeSlot = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { scheduleId, hour } = req.params as { scheduleId: string; hour: string };
  const { note, mood } = req.body;

  const hourNum = parseInt(hour, 10);
  if (isNaN(hourNum) || hourNum < 6 || hourNum > 22) {
    throw new BadRequestError('Hour must be between 6 and 22');
  }

  // Verify schedule ownership
  const { data: schedule, error: scheduleError } = await supabase
    .from('axiom_schedules')
    .select('id')
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .single();

  if (scheduleError || !schedule) {
    throw new NotFoundError('Schedule not found');
  }

  // Mark as completed (with optional note)
  await scheduleService.completeTimeSlot(userId, scheduleId, hourNum);

  // If note provided, create diary entry
  if (note) {
    await scheduleService.addNoteToTimeSlot(userId, scheduleId, hourNum, note, mood);
  }

  res.json({
    success: true,
    message: 'Time slot marked as completed',
    hour: hourNum,
  });
});

/**
 * POST /api/schedule/:scheduleId/slots/:hour/note
 * Add a note to a time slot (creates linked diary entry)
 */
export const addNoteToSlot = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { scheduleId, hour } = req.params as { scheduleId: string; hour: string };
  const { note, mood } = req.body;

  const hourNum = parseInt(hour, 10);
  if (isNaN(hourNum) || hourNum < 6 || hourNum > 22) {
    throw new BadRequestError('Hour must be between 6 and 22');
  }

  if (!note || note.trim().length === 0) {
    throw new BadRequestError('Note content is required');
  }

  // Verify schedule ownership
  const { data: schedule } = await supabase
    .from('axiom_schedules')
    .select('id')
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .single();

  if (!schedule) {
    throw new NotFoundError('Schedule not found');
  }

  // Create diary entry linked to this time slot
  const diaryEntry = await scheduleService.addNoteToTimeSlot(userId, scheduleId, hourNum, note, mood);

  res.status(201).json({
    success: true,
    diaryEntry,
    message: 'Note added to time slot',
  });
});

/**
 * GET /api/schedule/stats
 * Get schedule completion statistics
 */
export const getScheduleStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { startDate, endDate } = req.query;
  
  const start = startDate as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = endDate as string || new Date().toISOString().slice(0, 10);
  
  const { data, error } = await supabase.rpc('get_schedule_completion_stats', {
    p_user_id: userId,
    p_start_date: start,
    p_end_date: end,
  });
  
  if (error) throw error;
  
  res.json(data || {
    total_slots: 0,
    completed_slots: 0,
    completion_rate: 0,
    completions_by_category: {},
    completions_by_hour: {},
  });
});

/**
 * GET /api/schedule/:scheduleId/slots/:hour/share
 * Get shareable data for a time slot (for diary share integration)
 */
export const getShareableSlot = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { scheduleId, hour } = req.params as { scheduleId: string; hour: string };

  const hourNum = parseInt(hour, 10);
  if (isNaN(hourNum) || hourNum < 6 || hourNum > 22) {
    throw new BadRequestError('Hour must be between 6 and 22');
  }

  // Get schedule and slot
  const { data: schedule } = await supabase
    .from('axiom_schedules')
    .select('*')
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .single();

  if (!schedule) {
    throw new NotFoundError('Schedule not found');
  }
  
  const { data: slot } = await supabase
    .from('schedule_time_slots')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('hour', hourNum)
    .single();
  
  if (!slot) {
    throw new NotFoundError('Time slot not found');
  }
  
  // Get suggested match details if exists
  let matchDetails = null;
  if (slot.suggested_match_id) {
    const { data: match } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, bio')
      .eq('id', slot.suggested_match_id)
      .single();
    matchDetails = match;
  }
  
  // Get suggested place details if exists
  let placeDetails = null;
  if (slot.suggested_place_id) {
    const { data: place } = await supabase
      .from('places')
      .select('id, name, description, city, tags, latitude, longitude')
      .eq('id', slot.suggested_place_id)
      .single();
    placeDetails = place;
  }
  
  // Get suggested event details if exists
  let eventDetails = null;
  if (slot.suggested_event_id) {
    const { data: event } = await supabase
      .from('events')
      .select('id, title, description, event_date, city')
      .eq('id', slot.suggested_event_id)
      .single();
    eventDetails = event;
  }
  
  res.json({
    schedule: {
      id: schedule.id,
      date: schedule.date,
      focusTheme: schedule.focus_theme,
    },
    slot: {
      id: slot.id,
      hour: slot.hour,
      timeLabel: slot.time_label,
      task: slot.task,
      alignment: slot.alignment,
      duration: slot.duration,
      category: slot.category,
      priority: slot.priority,
    },
    suggestions: {
      match: matchDetails,
      place: placeDetails,
      event: eventDetails,
    },
  });
});

/**
 * Helper: Generate schedule for a user
 */
async function generateScheduleForUser(userId: string, date: string) {
  // Get user context
  const [profile, metrics, goalTree] = await Promise.all([
    supabase.from('profiles').select('name, city, minimal_ai_mode').eq('id', userId).single(),
    engagementMetricService.getCachedMetrics(userId),
    supabase.from('goal_trees').select('nodes').eq('user_id', userId).single(),
  ]);
  
  const userName = profile.data?.name || 'Student';
  const userCity = profile.data?.city;
  
  // Calculate metrics or use defaults
  let engagementMetrics = metrics;
  if (!engagementMetrics) {
    engagementMetrics = await engagementMetricService.calculateMetrics(userId);
    await engagementMetricService.storeMetrics(userId, engagementMetrics);
  }
  
  // Build context for schedule generation
  const nodes: any[] = goalTree.data?.nodes || [];
  const goals = nodes
    .filter(n => !n.parentId)
    .slice(0, 5)
    .map(n => ({
      name: n.name,
      domain: n.domain,
      progress: n.progress || 0,
      weight: n.weight || 1,
    }));
  
  const context = {
    userName,
    archetype: engagementMetrics.archetype || 'achiever',
    motivationStyle: engagementMetrics.motivationStyle || 'routine_based',
    riskFactors: engagementMetrics.riskFactors || [],
    checkinStreak: engagementMetrics.checkinStreak || 0,
    goals,
    trackerTrends: engagementMetrics.trackerTrends || [],
    topNoteThemes: engagementMetrics.topNoteThemes || [],
    recentAchievements: (engagementMetrics.recommendationContext?.recentAchievements as string[]) || [],
    currentFocus: (engagementMetrics.recommendationContext?.currentFocus as string) || undefined,
    interestedTopics: (engagementMetrics.recommendationContext?.interestedTopics as string[]) || [],
    socialEngagementScore: engagementMetrics.socialEngagementScore || 50,
    city: userCity,
  };
  
  // Generate schedule
  const schedule = await scheduleService.generateSchedule(userId, context);
  
  // Store in database
  const scheduleId = await scheduleService.storeSchedule(userId, schedule);
  
  // Fetch the stored schedule with IDs
  const storedSchedule = await scheduleService.getSchedule(userId, date);
  
  if (!storedSchedule) {
    throw new Error('Failed to retrieve generated schedule');
  }
  
  return storedSchedule;
}
