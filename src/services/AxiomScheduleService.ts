import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from './AICoachingService';
import logger from '../utils/logger';

export interface TimeSlot {
  hour: number; // 6-22 (6am to 10pm)
  timeLabel: string; // "06:00 - 07:00"
  task: string;
  alignment: string;
  duration: string;
  preparation: string;
  isFlexible: boolean;
  priority: 'high' | 'medium' | 'low';
  category: 'deep_work' | 'admin' | 'rest' | 'exercise' | 'social' | 'learning' | 'planning' | 'reflection';
  suggestedMatchId?: string;
  suggestedMatchName?: string;
  suggestedPlaceId?: string;
  suggestedPlaceName?: string;
  suggestedEventId?: string;
  suggestedEventName?: string;
}

export interface DailySchedule {
  date: string;
  wakeTime: string;
  sleepTime: string;
  totalWorkHours: number;
  totalRestHours: number;
  timeSlots: TimeSlot[];
  focusTheme: string;
  energyCurve: 'morning_peak' | 'evening_peak' | 'balanced';
}

interface ScheduleContext {
  userName: string;
  archetype: string;
  motivationStyle: string;
  riskFactors: string[];
  checkinStreak: number;
  goals: Array<{ name: string; domain: string; progress: number; weight: number }>;
  trackerTrends: Array<{ trackerName: string; direction: string; weekOverWeekChange: number }>;
  topNoteThemes: string[];
  recentAchievements: string[];
  currentFocus?: string;
  interestedTopics?: string[];
  socialEngagementScore: number;
  typicalWakeTime?: number;
  typicalSleepTime?: number;
  city?: string;
}

/**
 * AxiomScheduleService - Generates AI-powered daily schedules
 * 
 * Creates detailed hour-by-hour schedules from 6am to 10pm using Gemini AI.
 * Each time slot is interactive and can be clicked to open a diary entry.
 * 
 * Features:
 * - Person matching for accountability slots
 * - Place suggestions for location-based activities
 * - Event suggestions for scheduled activities
 * - Flexible vs fixed time blocks
 * - Energy-aware scheduling (morning/evening peaks)
 */
export class AxiomScheduleService {
  private aiCoaching: AICoachingService;

  constructor() {
    this.aiCoaching = new AICoachingService();
  }

  /**
   * Generate a complete daily schedule using Gemini AI
   */
  async generateSchedule(userId: string, context: ScheduleContext): Promise<DailySchedule> {
    logger.info(`[AxiomSchedule] Generating schedule for ${context.userName}`);

    // Fetch suggested matches, events, and places for context
    const [matchesRes, eventsRes, placesRes] = await Promise.all([
      supabase.rpc('match_users_by_goals', { query_user_id: userId, match_limit: 10 }),
      supabase.from('events')
        .select('id, title, event_date, city, description')
        .gte('event_date', new Date().toISOString().slice(0, 10))
        .order('event_date', { ascending: true })
        .limit(5),
      supabase.from('places')
        .select('id, name, city, tags, description, latitude, longitude')
        .limit(10),
    ]);

    const matches = matchesRes.data || [];
    const events = eventsRes.data || [];
    const places = placesRes.data || [];

    // Pick best match based on goal alignment and availability
    const bestMatch = this.pickBestMatch(matches, context);
    
    // Pick best events based on city and timing
    const bestEvents = this.pickBestEvents(events, context.city, 3);
    
    // Pick best places based on city and goal alignment
    const bestPlaces = this.pickBestPlaces(places, context.city, context.goals.map(g => g.domain));

    // Build AI prompt for schedule generation
    const prompt = this.buildSchedulePrompt(context, bestMatch, bestEvents, bestPlaces);

    try {
      const rawResponse = await this.aiCoaching.runWithFallback(prompt);
      
      // Extract JSON from response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const scheduleData = JSON.parse(jsonMatch[0]);
        return this.validateAndEnrichSchedule(scheduleData, bestMatch, bestEvents, bestPlaces);
      }
      
      throw new Error('Invalid JSON response from AI');
    } catch (error: any) {
      logger.error(`[AxiomSchedule] AI generation failed: ${error.message}`);
      // Fall back to template-based schedule
      return this.generateTemplateSchedule(context, bestMatch, bestEvents, bestPlaces);
    }
  }

  /**
   * Build the AI prompt for schedule generation
   */
  private buildSchedulePrompt(
    context: ScheduleContext,
    bestMatch: any,
    bestEvents: any[],
    bestPlaces: any[]
  ): string {
    const goalsSlice = context.goals.slice(0, 5).map(g => ({
      name: g.name,
      domain: g.domain,
      progress: Math.round(g.progress * 100) + '%',
    }));

    return `You are Axiom, a wise warm and practical life coach. Generate a daily schedule for ${context.userName}.

FULL CONTEXT:
- Archetype: ${context.archetype}
- Motivation style: ${context.motivationStyle}
- Check-in streak: ${context.checkinStreak} days
- Risk factors: ${context.riskFactors.join(', ') || 'None'}
- Goals: ${JSON.stringify(goalsSlice)}
- Tracker trends: ${context.trackerTrends.map(t => `${t.trackerName}: ${t.direction}`).join(', ') || 'None'}
- Top note themes: ${context.topNoteThemes.join(', ') || 'None'}
- Recent achievements: ${context.recentAchievements.join(', ') || 'None'}
- Current focus: ${context.currentFocus || 'Not specified'}
- Interested topics: ${context.interestedTopics?.join(', ') || 'None'}
- Social engagement: ${context.socialEngagementScore}/100
${bestMatch ? `- Accountability partner: ${bestMatch.name} (${bestMatch.reason})` : ''}
${bestEvents.length > 0 ? `- Events: ${bestEvents.map(e => e.title).join(', ')}` : ''}
${bestPlaces.length > 0 ? `- Places: ${bestPlaces.map(p => p.name).join(', ')}` : ''}

Generate a schedule from 6:00 AM to 10:00 PM (16 hours, 1 block per hour).

Return ONLY valid JSON (no markdown):
{
  "date": "${new Date().toISOString().slice(0, 10)}",
  "wakeTime": "06:00",
  "sleepTime": "22:00",
  "totalWorkHours": 6,
  "totalRestHours": 4,
  "focusTheme": "One sentence theme",
  "energyCurve": "morning_peak" | "evening_peak" | "balanced",
  "timeSlots": [
    {
      "hour": 6,
      "timeLabel": "06:00 - 07:00",
      "task": "Specific task tied to their goals",
      "alignment": "Why this matters for them personally",
      "duration": "45 min",
      "preparation": "What to prepare",
      "isFlexible": true,
      "priority": "high" | "medium" | "low",
      "category": "deep_work" | "admin" | "rest" | "exercise" | "social" | "learning" | "planning" | "reflection"
    }
  ]
}

RULES:
1. **16 time slots** covering hours 6-22 (6am to 10pm)

2. **Task Specificity** - Each task must:
   - Reference their actual goals BY NAME
   - Connect to their tracker trends (mention specific trackers)
   - Reference their note themes (show you read their reflections)
   - Be concrete: exact action, not vague advice
   - Example: "Work on 'Career Certification' - complete module 3" NOT "Study for your goals"

3. **Personalization** - Use their data:
   - Mention their streak: "Your ${context.checkinStreak}-day streak shows commitment"
   - Reference tracker trends: "Your ${context.trackerTrends[0]?.trackerName || 'fitness'} is ${context.trackerTrends[0]?.direction || 'stable'}"
   - Reference note themes: "You've been reflecting on '${context.topNoteThemes[0] || 'growth'}'"
   - Acknowledge achievements: "After '${context.recentAchievements[0] || 'recent progress'}'"

4. **Energy Alignment**:
   - morning_peak: Deep work 6-10am
   - evening_peak: Creative work 6-10pm
   - balanced: Distribute evenly

5. **Category Distribution**:
   - 4-6 blocks: deep_work
   - 2-3 blocks: rest (include post-lunch ~14:00)
   - 1-2 blocks: exercise
   - 1-2 blocks: admin
   - 1 block: planning/reflection

6. **Suggestions**:
   - Social blocks: Include ${bestMatch?.name || 'partner'} check-in
   - Exercise blocks: Suggest ${bestPlaces[0]?.name || 'a place'}
   - Schedule events at their times

7. **Priorities**: 3-5 high, 6-8 medium, rest low

8. **TONE**: Warm, specific, encouraging. Reference THEIR data in every alignment. No generic advice.`;
  }

  /**
   * Validate AI response and enrich with match/event/place data
   */
  private validateAndEnrichSchedule(
    scheduleData: any,
    bestMatch: any,
    bestEvents: any[],
    bestPlaces: any[]
  ): DailySchedule {
    // Validate we have 16 time slots
    if (!scheduleData.timeSlots || scheduleData.timeSlots.length !== 16) {
      logger.warn('[AxiomSchedule] Invalid time slot count, using template');
      return this.generateTemplateSchedule({ 
        userName: scheduleData.userName || 'User',
        archetype: 'achiever',
        motivationStyle: 'routine_based',
        riskFactors: [],
        checkinStreak: 0,
        goals: [],
        trackerTrends: [],
        topNoteThemes: [],
        recentAchievements: [],
        socialEngagementScore: 50
      }, bestMatch, bestEvents, bestPlaces);
    }

    // Enrich time slots with suggestions
    const enrichedSlots = scheduleData.timeSlots.map((slot: any, index: number) => {
      const enriched: any = { ...slot };
      
      // Add match suggestion for social slots
      if (slot.category === 'social' && bestMatch) {
        enriched.suggestedMatchId = bestMatch.id;
        enriched.suggestedMatchName = bestMatch.name;
      }
      
      // Add place suggestion for exercise/deep_work slots
      if ((slot.category === 'exercise' || slot.category === 'deep_work') && bestPlaces.length > 0) {
        const placeIndex = index % bestPlaces.length;
        enriched.suggestedPlaceId = bestPlaces[placeIndex].id;
        enriched.suggestedPlaceName = bestPlaces[placeIndex].name;
      }
      
      // Add event suggestion if event time matches
      if (bestEvents.length > 0) {
        const eventHour = new Date(bestEvents[0].event_date).getHours();
        if (Math.abs(eventHour - slot.hour) <= 1) {
          enriched.suggestedEventId = bestEvents[0].id;
          enriched.suggestedEventName = bestEvents[0].title;
        }
      }
      
      return enriched as TimeSlot;
    });

    return {
      date: scheduleData.date || new Date().toISOString().slice(0, 10),
      wakeTime: scheduleData.wakeTime || '06:00',
      sleepTime: scheduleData.sleepTime || '22:00',
      totalWorkHours: scheduleData.totalWorkHours || 6,
      totalRestHours: scheduleData.totalRestHours || 4,
      focusTheme: scheduleData.focusTheme || 'Build momentum on your key goals',
      energyCurve: scheduleData.energyCurve || 'balanced',
      timeSlots: enrichedSlots,
    };
  }

  /**
   * Generate template-based schedule (fallback when AI fails)
   */
  private generateTemplateSchedule(
    context: ScheduleContext,
    bestMatch: any,
    bestEvents: any[],
    bestPlaces: any[]
  ): DailySchedule {
    const energyCurve = this.determineEnergyCurve(context);
    
    // Generate time slots based on energy curve
    const timeSlots: TimeSlot[] = [];
    
    for (let hour = 6; hour <= 22; hour++) {
      const slot = this.generateTemplateSlot(hour, context, energyCurve, bestMatch, bestEvents, bestPlaces);
      timeSlots.push(slot);
    }

    return {
      date: new Date().toISOString().slice(0, 10),
      wakeTime: '06:00',
      sleepTime: '22:00',
      totalWorkHours: 6,
      totalRestHours: 4,
      focusTheme: context.currentFocus || 'Build momentum on your key goals',
      energyCurve,
      timeSlots,
    };
  }

  /**
   * Determine energy curve based on user patterns
   */
  private determineEnergyCurve(context: ScheduleContext): 'morning_peak' | 'evening_peak' | 'balanced' {
    if (context.archetype === 'achiever' || context.archetype === 'consolidator') {
      return 'morning_peak';
    }
    if (context.archetype === 'explorer' || context.riskFactors.includes('burnout_risk')) {
      return 'evening_peak';
    }
    return 'balanced';
  }

  /**
   * Generate a single template time slot
   */
  private generateTemplateSlot(
    hour: number,
    context: ScheduleContext,
    energyCurve: string,
    bestMatch: any,
    bestEvents: any[],
    bestPlaces: any[]
  ): TimeSlot {
    // Default slot structure
    const slot: TimeSlot = {
      hour,
      timeLabel: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
      task: '',
      alignment: '',
      duration: '45 min',
      preparation: '',
      isFlexible: true,
      priority: 'medium',
      category: 'admin',
    };

    // Morning routine (6-8am)
    if (hour === 6) {
      slot.category = 'planning';
      slot.task = 'Morning intention setting and day review';
      slot.alignment = `Starting your day with clarity sets the tone. Your ${context.checkinStreak}-day streak shows you're committed.`;
      slot.duration = '15 min';
      slot.preparation = 'Keep a notebook by your bed';
      slot.priority = 'high';
      slot.isFlexible = false;
    } else if (hour === 7) {
      slot.category = 'exercise';
      slot.task = context.trackerTrends.find(t => t.trackerName === 'lift' || t.trackerName === 'cardio')
        ? `${context.trackerTrends[0]?.trackerName || 'Exercise'} session`
        : 'Morning movement routine';
      slot.alignment = 'Exercise boosts energy and mood for the day ahead.';
      slot.duration = '30-45 min';
      slot.preparation = 'Lay out workout clothes tonight';
      slot.priority = 'high';
      slot.isFlexible = true;
      if (bestPlaces.length > 0) {
        slot.suggestedPlaceId = bestPlaces[0].id;
        slot.suggestedPlaceName = bestPlaces[0].name;
      }
    } else if (hour === 8) {
      slot.category = 'deep_work';
      slot.task = context.goals[0]
        ? `Deep work on "${context.goals[0].name}"`
        : 'Most important task of the day';
      slot.alignment = `Your ${context.motivationStyle} style means you thrive with focused morning blocks.`;
      slot.duration = 'full hour';
      slot.preparation = 'Close all tabs except what you need';
      slot.priority = 'high';
      slot.isFlexible = false;
    }
    // Deep work block (9-11am)
    else if (hour === 9 || hour === 10 || hour === 11) {
      slot.category = 'deep_work';
      const goalIndex = (hour - 9) % Math.min(context.goals.length, 3);
      slot.task = context.goals[goalIndex]
        ? `Work on "${context.goals[goalIndex].name}"`
        : 'Focused goal work';
      slot.alignment = `This is your peak ${energyCurve === 'morning_peak' ? 'energy' : 'focus'} time.`;
      slot.duration = '50 min';
      slot.preparation = 'Set timer, silence notifications';
      slot.priority = hour === 9 ? 'high' : 'medium';
      slot.isFlexible = hour !== 9;
    }
    // Lunch (12-13pm)
    else if (hour === 12 || hour === 13) {
      slot.category = 'rest';
      slot.task = 'Lunch break and mental reset';
      slot.alignment = 'Rest is productive. Your brain consolidates learning during downtime.';
      slot.duration = 'full hour';
      slot.preparation = 'Step away from screens';
      slot.priority = 'medium';
      slot.isFlexible = true;
    }
    // Afternoon admin (14-15pm)
    else if (hour === 14 || hour === 15) {
      slot.category = 'admin';
      slot.task = 'Email, messages, and logistics';
      slot.alignment = 'Afternoon energy dip is perfect for lower-cognitive tasks.';
      slot.duration = '45 min';
      slot.preparation = 'Make a list of pending communications';
      slot.priority = 'low';
      slot.isFlexible = true;
    }
    // Learning/growth (16-17pm)
    else if (hour === 16 || hour === 17) {
      slot.category = 'learning';
      slot.task = context.interestedTopics?.[0]
        ? `Explore "${context.interestedTopics[0]}"`
        : 'Skill development or reading';
      slot.alignment = `Continuous learning compounds. Your interest in ${context.interestedTopics?.[0] || 'growth'} matters.`;
      slot.duration = '45 min';
      slot.preparation = 'Have your learning material ready';
      slot.priority = 'medium';
      slot.isFlexible = true;
    }
    // Social/accountability (18pm)
    else if (hour === 18) {
      slot.category = 'social';
      slot.task = bestMatch
        ? `Check in with ${bestMatch.name} - share progress and challenges`
        : 'Connect with someone in your network';
      slot.alignment = 'Social accountability multiplies your commitment.';
      slot.duration = '30 min';
      slot.preparation = 'Think of one win and one challenge to share';
      slot.priority = 'medium';
      slot.isFlexible = true;
      if (bestMatch) {
        slot.suggestedMatchId = bestMatch.id;
        slot.suggestedMatchName = bestMatch.name;
      }
    }
    // Evening routine (19-20pm)
    else if (hour === 19 || hour === 20) {
      slot.category = 'deep_work';
      slot.task = context.goals[1]
        ? `Second work block: "${context.goals[1].name}"`
        : 'Evening focused session';
      slot.alignment = energyCurve === 'evening_peak'
        ? 'Your evening energy is strong - use it wisely.'
        : 'One more push before winding down.';
      slot.duration = '45 min';
      slot.preparation = 'Quick walk or stretch to reset';
      slot.priority = 'medium';
      slot.isFlexible = true;
    }
    // Reflection (21pm)
    else if (hour === 21) {
      slot.category = 'reflection';
      slot.task = 'Evening review: What went well? What did you learn?';
      slot.alignment = `Reflection turns experience into wisdom. Your ${context.checkinStreak}-day streak proves you show up.`;
      slot.duration = '20 min';
      slot.preparation = 'Have your journal ready';
      slot.priority = 'high';
      slot.isFlexible = false;
    }
    // Wind down (22pm)
    else {
      slot.category = 'rest';
      slot.task = 'Wind down routine - prepare for restful sleep';
      slot.alignment = 'Sleep is when your brain consolidates today\'s gains. Protect it.';
      slot.duration = 'full hour';
      slot.preparation = 'Dim lights, no screens';
      slot.priority = 'high';
      slot.isFlexible = false;
    }

    return slot;
  }

  /**
   * Pick best match based on goal alignment and activity
   */
  private pickBestMatch(matches: any[], context: ScheduleContext): any | null {
    if (!matches || matches.length === 0) return null;
    
    // Score matches by goal overlap and recent activity
    const scored = matches.map((match: any) => {
      let score = 0;
      
      // Goal domain overlap
      const matchDomains = (match.sharedDomains || []).map((d: string) => d.toLowerCase());
      for (const goal of context.goals) {
        if (matchDomains.includes(goal.domain.toLowerCase())) {
          score += 2;
        }
      }
      
      // Recent activity bonus
      if (match.lastActiveDaysAgo !== undefined && match.lastActiveDaysAgo < 7) {
        score += 3;
      }
      
      // Compatibility score if available
      if (match.compatibilityScore) {
        score += match.compatibilityScore / 20;
      }
      
      return { ...match, score };
    });
    
    scored.sort((a: any, b: any) => b.score - a.score);
    
    if (scored[0]) {
      return {
        id: scored[0].id,
        name: scored[0].name,
        reason: `Shared focus on ${context.goals[0]?.domain || 'your goals'}`,
      };
    }
    
    return null;
  }

  /**
   * Pick best events based on city and date proximity
   */
  private pickBestEvents(events: any[], city?: string, limit: number = 3): any[] {
    if (!events || events.length === 0) return [];
    
    const scored = events.map((event: any) => {
      let score = 0;
      
      // City match
      if (city && event.city && event.city.toLowerCase() === city.toLowerCase()) {
        score += 5;
      }
      
      // Sooner events ranked higher
      const daysUntil = Math.max(0, Math.floor(
        (new Date(event.event_date).getTime() - Date.now()) / 86400000
      ));
      score += Math.max(0, 3 - daysUntil * 0.5);
      
      return { ...event, score };
    });
    
    scored.sort((a: any, b: any) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /**
   * Pick best places based on city and goal alignment
   */
  private pickBestPlaces(places: any[], city?: string, domains: string[] = []): any[] {
    if (!places || places.length === 0) return [];
    
    const domainLower = domains.map(d => d.toLowerCase());
    
    const scored = places.map((place: any) => {
      let score = 0;
      
      // City match
      if (city && place.city && place.city.toLowerCase() === city.toLowerCase()) {
        score += 5;
      }
      
      // Tag/domain overlap
      const tags: string[] = Array.isArray(place.tags) ? place.tags : [];
      for (const tag of tags) {
        const tagLower = (tag || '').toLowerCase();
        for (const domain of domainLower) {
          if (tagLower.includes(domain) || domain.includes(tagLower)) {
            score += 2;
            break;
          }
        }
      }
      
      return { ...place, score };
    });
    
    scored.sort((a: any, b: any) => b.score - a.score);
    return scored.slice(0, 3);
  }

  /**
   * Store generated schedule in database
   */
  async storeSchedule(userId: string, schedule: DailySchedule): Promise<string> {
    const { data, error } = await supabase
      .from('axiom_schedules')
      .insert({
        user_id: userId,
        date: schedule.date,
        focus_theme: schedule.focusTheme,
        energy_curve: schedule.energyCurve,
        wake_time: schedule.wakeTime,
        sleep_time: schedule.sleepTime,
        total_work_hours: schedule.totalWorkHours,
        total_rest_hours: schedule.totalRestHours,
      })
      .select('id')
      .single();

    if (error) throw error;
    
    const scheduleId = data.id;
    
    // Store time slots
    const timeSlotInserts = schedule.timeSlots.map((slot: TimeSlot) => ({
      schedule_id: scheduleId,
      hour: slot.hour,
      time_label: slot.timeLabel,
      task: slot.task,
      alignment: slot.alignment,
      duration: slot.duration,
      preparation: slot.preparation,
      is_flexible: slot.isFlexible,
      priority: slot.priority,
      category: slot.category,
      suggested_match_id: slot.suggestedMatchId,
      suggested_place_id: slot.suggestedPlaceId,
      suggested_event_id: slot.suggestedEventId,
    }));

    const { error: slotsError } = await supabase
      .from('schedule_time_slots')
      .insert(timeSlotInserts);

    if (slotsError) throw slotsError;
    
    return scheduleId;
  }

  /**
   * Get schedule for a specific date
   */
  async getSchedule(userId: string, date: string): Promise<DailySchedule | null> {
    const { data: schedule, error } = await supabase
      .from('axiom_schedules')
      .select('*, schedule_time_slots(*)')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error || !schedule) return null;

    // Transform database format to interface
    const timeSlots: TimeSlot[] = (schedule.schedule_time_slots || []).map((slot: any) => ({
      hour: slot.hour,
      timeLabel: slot.time_label,
      task: slot.task,
      alignment: slot.alignment,
      duration: slot.duration,
      preparation: slot.preparation,
      isFlexible: slot.is_flexible,
      priority: slot.priority,
      category: slot.category,
      suggestedMatchId: slot.suggested_match_id,
      suggestedPlaceId: slot.suggested_place_id,
      suggestedEventId: slot.suggested_event_id,
    })).sort((a: TimeSlot, b: TimeSlot) => a.hour - b.hour);

    return {
      date: schedule.date,
      wakeTime: schedule.wake_time,
      sleepTime: schedule.sleep_time,
      totalWorkHours: schedule.total_work_hours,
      totalRestHours: schedule.total_rest_hours,
      focusTheme: schedule.focus_theme,
      energyCurve: schedule.energy_curve,
      timeSlots,
    };
  }

  /**
   * Mark a time slot as completed
   */
  async completeTimeSlot(userId: string, scheduleId: string, hour: number): Promise<void> {
    const { error } = await supabase
      .from('schedule_completions')
      .insert({
        user_id: userId,
        schedule_id: scheduleId,
        hour: hour,
        completed_at: new Date().toISOString(),
      });

    if (error) throw error;
  }

  /**
   * Add a note to a time slot (creates diary entry linked to slot)
   */
  async addNoteToTimeSlot(
    userId: string,
    scheduleId: string,
    hour: number,
    note: string,
    mood?: string
  ): Promise<any> {
    // First, get the time slot details
    const { data: slot } = await supabase
      .from('schedule_time_slots')
      .select('*')
      .eq('schedule_id', scheduleId)
      .eq('hour', hour)
      .single();

    if (!slot) throw new Error('Time slot not found');

    // Create diary entry linked to this time slot
    const { data, error } = await supabase
      .from('diary_entries')
      .insert({
        user_id: userId,
        entry_type: 'schedule_note',
        title: `Note: ${slot.time_label} - ${slot.task}`,
        content: note,
        source_table: 'axiom_schedules',
        source_id: scheduleId,
        metadata: {
          hour,
          time_label: slot.time_label,
          task: slot.task,
          mood,
        },
        mood,
        is_private: true,
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
